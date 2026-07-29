"""
FastAPI backend for the Planner -> Architect -> Coder agent pipeline.

Run with:
    uvicorn backend:app --reload --port 8000

Then open http://localhost:8000 in a browser.
"""
import io
import pathlib
import threading
import time
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents import tools
from agents.graph import planner_agent, architect_agent, coder_agent
from agents.states import CoderState, Plan, TaskPlan
import os
BASE_DIR = pathlib.Path(__file__).parent.resolve()
WORKSPACE_ROOT = BASE_DIR / "workspace"
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

FRONTEND_DIR = BASE_DIR / "template"

app = FastAPI(title="Agent Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory job store. Only one generation runs at a time because the
# underlying file tools (agents/tools.py) operate on a single mutable
# PROJECT_ROOT global -- GRAPH_LOCK serializes runs so two jobs never write
# into each other's directory.
# ---------------------------------------------------------------------------
JOBS: dict[str, dict] = {}
GRAPH_LOCK = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(job: dict, message: str) -> None:
    job["logs"].append({"time": _now(), "message": message})


def _job_dir(job_id: str) -> pathlib.Path:
    return WORKSPACE_ROOT / job_id


def _safe_file_in_job(job_id: str, rel_path: str) -> pathlib.Path:
    root = _job_dir(job_id).resolve()
    candidate = (root / rel_path).resolve()
    if root != candidate and root not in candidate.parents:
        raise HTTPException(status_code=400, detail="Path escapes project root")
    return candidate


def run_pipeline(job_id: str, user_prompt: str) -> None:
    job = JOBS[job_id]
    with GRAPH_LOCK:
        try:
            job_dir = _job_dir(job_id)
            tools.PROJECT_ROOT = job_dir
            tools.init_project_root()

            job["status"] = "running"
            job["phase"] = "planning"
            _log(job, "Planner agent started")

            plan_result = planner_agent({"user_prompt": user_prompt})
            plan: Plan = plan_result["plan"]
            job["plan"] = plan.model_dump()
            _log(job, f"Plan ready: '{plan.name}' — {len(plan.files)} file(s) targeted")

            job["phase"] = "architecting"
            _log(job, "Architect agent started")

            arch_result = architect_agent({"plan": plan})
            task_plan: TaskPlan = arch_result["task_plan"]
            job["task_plan"] = task_plan.model_dump()
            total_steps = len(task_plan.implementation_steps)
            job["total_steps"] = total_steps
            _log(job, f"{total_steps} implementation step(s) planned")

            job["phase"] = "coding"
            job["current_step"] = 0

            state = {
                "task_plan": task_plan,
                "coder_state": CoderState(task_plan=task_plan, current_step_idx=0),
            }
            while True:
                coder_state: CoderState = state["coder_state"]
                steps = coder_state.task_plan.implementation_steps
                idx = coder_state.current_step_idx
                if idx >= len(steps):
                    break
                step = steps[idx]
                job["current_step"] = idx + 1
                _log(job, f"[{idx + 1}/{len(steps)}] {step.filepath} — {step.task_description}")
                state = coder_agent(state)
                _log(job, f"[{idx + 1}/{len(steps)}] {step.filepath} done")

            job["status"] = "done"
            job["phase"] = "done"
            job["finished_at"] = _now()
            _log(job, "Generation complete")
        except Exception as exc:  # noqa: BLE001
            job["status"] = "error"
            job["phase"] = "error"
            job["error"] = str(exc)
            job["finished_at"] = _now()
            _log(job, f"ERROR: {exc}")


@app.post("/api/generate")
def generate(req: GenerateRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt must not be empty")

    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "id": job_id,
        "prompt": req.prompt,
        "status": "queued",
        "phase": "queued",
        "created_at": _now(),
        "finished_at": None,
        "logs": [],
        "plan": None,
        "task_plan": None,
        "total_steps": 0,
        "current_step": 0,
        "error": None,
    }
    thread = threading.Thread(target=run_pipeline, args=(job_id, req.prompt), daemon=True)
    thread.start()
    return {"job_id": job_id}


@app.get("/api/jobs")
def list_jobs():
    return [
        {
            "id": j["id"],
            "prompt": j["prompt"],
            "status": j["status"],
            "phase": j["phase"],
            "created_at": j["created_at"],
        }
        for j in sorted(JOBS.values(), key=lambda x: x["created_at"], reverse=True)
    ]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str, since: int = Query(0, description="Return logs after this index")):
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    payload = {k: v for k, v in job.items() if k != "logs"}
    payload["logs"] = job["logs"][since:]
    payload["log_count"] = len(job["logs"])
    return payload


@app.get("/api/jobs/{job_id}/files")
def list_job_files(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    root = _job_dir(job_id)
    if not root.exists():
        return {"files": []}
    files = sorted(str(p.relative_to(root)) for p in root.glob("**/*") if p.is_file())
    return {"files": files}


@app.get("/api/jobs/{job_id}/file")
def get_job_file(job_id: str, path: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    p = _safe_file_in_job(job_id, path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="Binary file cannot be previewed")
    return {"path": path, "content": content}


@app.get("/api/jobs/{job_id}/download")
def download_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    root = _job_dir(job_id)
    if not root.exists():
        raise HTTPException(status_code=404, detail="No files generated yet")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in root.glob("**/*"):
            if p.is_file():
                zf.write(p, arcname=str(p.relative_to(root)))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{job_id}.zip"'},
    )


# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))
import uvicorn
if __name__ == "__main__":
        uvicorn.run(
            "backend:app",
            host="0.0.0.0",
            port=int(os.environ.get("PORT", 9090)),
            reload=False,
        )
