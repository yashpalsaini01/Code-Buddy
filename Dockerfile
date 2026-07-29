FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install --upgrade pip

RUN pip install \
    fastapi \
    "uvicorn[standard]" \
    groq \
    langchain \
    langchain-core \
    langchain-groq \
    langgraph \
    python-dotenv \
    pydantic

EXPOSE 9090

CMD ["python", "backend.py"]