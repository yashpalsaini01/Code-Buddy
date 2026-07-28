const form = document.getElementById("generate-form");
const promptEl = document.getElementById("prompt");
const generateBtn = document.getElementById("generate-btn");
const jobListEl = document.getElementById("job-list");
const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");
const downloadLink = document.getElementById("download-link");
const consoleEl = document.getElementById("console");
const stepCounterEl = document.getElementById("step-counter");
const fillEls = { planning: null, architecting: document.getElementById("fill-1"), coding: document.getElementById("fill-2") };

const stageEls = {
  planning: document.querySelector('.stage[data-stage="planning"]'),
  architecting: document.querySelector('.stage[data-stage="architecting"]'),
  coding: document.querySelector('.stage[data-stage="coding"]'),
};

const planEmpty = document.getElementById("plan-empty");
const planBody = document.getElementById("plan-body");
const fileListEl = document.getElementById("file-list");
const fileContentEl = document.getElementById("file-content");

let currentJobId = null;
let pollTimer = null;
let renderedLogCount = 0;
let currentFilePath = null;

const PHASE_ORDER = ["planning", "architecting", "coding"];

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}

function setPipeline(phase, status) {
  const activeIdx = PHASE_ORDER.indexOf(phase);
  PHASE_ORDER.forEach((p, i) => {
    const el = stageEls[p];
    el.classList.remove("stage-active", "stage-done");
    if (status === "done") {
      el.classList.add("stage-done");
    } else if (i < activeIdx || (i === activeIdx && status === "error")) {
      el.classList.add(i < activeIdx ? "stage-done" : "stage-active");
    } else if (i === activeIdx) {
      el.classList.add("stage-active");
    }
  });
  fillEls.architecting.style.width = activeIdx >= 1 ? "100%" : "0%";
  fillEls.coding.style.width = activeIdx >= 2 || status === "done" ? "100%" : "0%";
}

function setStatusPill(status, phase) {
  statusPill.className = "status-pill " + (status || "idle");
  statusPill.textContent = status || "idle";
}

function appendLogs(logs) {
  for (const entry of logs) {
    const line = document.createElement("div");
    line.className = "console-line" + (entry.message.startsWith("ERROR") ? " err" : "");
    line.innerHTML = `<span class="t">${fmtTime(entry.time)}</span>${escapeHtml(entry.message)}`;
    consoleEl.appendChild(line);
  }
  if (logs.length) consoleEl.scrollTop = consoleEl.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function resetRunPanels() {
  consoleEl.innerHTML = "";
  renderedLogCount = 0;
  planEmpty.classList.remove("hidden");
  planBody.classList.add("hidden");
  fileListEl.innerHTML = "";
  fileContentEl.textContent = "Select a file to preview its contents.";
  currentFilePath = null;
  downloadLink.classList.add("hidden");
  setPipeline("planning", "idle");
}

function renderPlan(plan) {
  if (!plan) return;
  planEmpty.classList.add("hidden");
  planBody.classList.remove("hidden");
  document.getElementById("plan-name").textContent = plan.name;
  document.getElementById("plan-desc").textContent = plan.description;
  document.getElementById("plan-stack").textContent = plan.techstack;

  const featuresEl = document.getElementById("plan-features");
  featuresEl.innerHTML = "";
  (plan.features || []).forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f;
    featuresEl.appendChild(li);
  });

  const filesEl = document.getElementById("plan-files");
  filesEl.innerHTML = "";
  (plan.files || []).forEach((f) => {
    const li = document.createElement("li");
    li.textContent = `${f.path} — ${f.purpose}`;
    filesEl.appendChild(li);
  });
}

async function refreshFileList(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/files`);
  if (!res.ok) return;
  const data = await res.json();
  fileListEl.innerHTML = "";
  data.files.forEach((path) => {
    const li = document.createElement("li");
    li.textContent = path;
    li.className = path === currentFilePath ? "active" : "";
    li.addEventListener("click", () => selectFile(jobId, path));
    fileListEl.appendChild(li);
  });
}

async function selectFile(jobId, path) {
  currentFilePath = path;
  [...fileListEl.children].forEach((li) => li.classList.toggle("active", li.textContent === path));
  const res = await fetch(`/api/jobs/${jobId}/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    fileContentEl.textContent = "Could not preview this file.";
    return;
  }
  const data = await res.json();
  fileContentEl.textContent = data.content || "(empty file)";
}

async function poll(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}?since=${renderedLogCount}`);
    if (!res.ok) return;
    const job = await res.json();

    appendLogs(job.logs);
    renderedLogCount = job.log_count;

    setStatusPill(job.status, job.phase);
    setPipeline(job.phase, job.status);

    if (job.total_steps) {
      stepCounterEl.textContent = `${job.current_step}/${job.total_steps}`;
    }

    statusText.textContent = statusMessage(job);

    if (job.plan) renderPlan(job.plan);
    if (job.status === "running" || job.status === "done") {
      await refreshFileList(jobId);
    }

    if (job.status === "done") {
      downloadLink.classList.remove("hidden");
      downloadLink.href = `/api/jobs/${jobId}/download`;
      stopPolling();
      refreshJobList();
    } else if (job.status === "error") {
      stopPolling();
      refreshJobList();
    }
  } catch (e) {
    // transient network hiccup — keep polling
  }
}

function statusMessage(job) {
  if (job.status === "queued") return "Queued...";
  if (job.status === "error") return `Failed: ${job.error}`;
  if (job.status === "done") return "Generation complete.";
  if (job.phase === "planning") return "Planner agent is drafting the project plan...";
  if (job.phase === "architecting") return "Architect agent is breaking the plan into tasks...";
  if (job.phase === "coding") return `Coder agent writing files (${job.current_step}/${job.total_steps})...`;
  return "Working...";
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  generateBtn.disabled = false;
}

function startPolling(jobId) {
  stopPolling();
  pollTimer = setInterval(() => poll(jobId), 1200);
  poll(jobId);
}

async function refreshJobList() {
  const res = await fetch("/api/jobs");
  if (!res.ok) return;
  const jobs = await res.json();
  jobListEl.innerHTML = "";
  jobs.forEach((j) => {
    const li = document.createElement("li");
    li.className = "job-item" + (j.id === currentJobId ? " active" : "");
    li.innerHTML = `<div class="job-item-prompt">${escapeHtml(j.prompt)}</div><div class="job-item-meta">${j.status}</div>`;
    li.addEventListener("click", () => openJob(j.id));
    jobListEl.appendChild(li);
  });
}

async function openJob(jobId) {
  currentJobId = jobId;
  resetRunPanels();
  generateBtn.disabled = true;
  await refreshJobList();
  startPolling(jobId);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;
  generateBtn.disabled = true;
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    generateBtn.disabled = false;
    statusText.textContent = "Could not start the pipeline.";
    return;
  }
  const data = await res.json();
  currentJobId = data.job_id;
  resetRunPanels();
  await refreshJobList();
  startPolling(currentJobId);
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

refreshJobList();
