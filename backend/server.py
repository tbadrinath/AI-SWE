from __future__ import annotations

import asyncio
import io
import logging
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from agent_code import PHASE1_FILES
from agent_runner import run_agent_loop
from seed_models import SEED_MODELS, select_best

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Agentic Builder API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Capabilities(BaseModel):
    code: bool = False
    chat: bool = False
    vision: bool = False


class HFModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    repo_id: str
    revision: str
    path: str
    size_on_disk: int
    capabilities: Capabilities
    params_b: float
    context_length: int
    quantization: str
    last_modified: str
    notes: str


class ScanResponse(BaseModel):
    scanned_at: str
    cache_dir: str
    models: list[HFModel]
    total_size_bytes: int
    suggested_model: str


class TaskCreate(BaseModel):
    name: str
    spec: str
    model_repo_id: Optional[str] = None
    max_iterations: int = 4


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    spec: str
    model_repo_id: str
    max_iterations: int
    created_at: str


class RunStart(BaseModel):
    task_id: Optional[str] = None
    name: Optional[str] = None
    spec: Optional[str] = None
    model_repo_id: Optional[str] = None
    max_iterations: int = 4


class Run(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    task_id: Optional[str]
    name: str
    spec: str
    model_repo_id: str
    max_iterations: int
    status: str
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    iterations_used: Optional[int] = None
    final_code: Optional[str] = None


class RunEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    run_id: str
    iteration: int
    stage: str
    type: str
    title: str
    data: dict[str, Any]
    timestamp: str


# ---------- Health ----------
@api.get("/")
async def root():
    return {"message": "Agentic Builder API", "time": _now()}


# ---------- Models ----------
@api.post("/models/scan", response_model=ScanResponse)
async def scan_models():
    """Simulated scan of the local HF cache. Returns seeded curated models."""
    total = sum(m["size_on_disk"] for m in SEED_MODELS)
    best = select_best(SEED_MODELS, task="coding")
    return ScanResponse(
        scanned_at=_now(),
        cache_dir=os.path.expanduser("~/.cache/huggingface/hub"),
        models=[HFModel(**m) for m in SEED_MODELS],
        total_size_bytes=total,
        suggested_model=best["repo_id"],
    )


@api.get("/models", response_model=list[HFModel])
async def list_models():
    return [HFModel(**m) for m in SEED_MODELS]


# ---------- Phases ----------
@api.get("/phases")
async def list_phases():
    return {
        "phases": [
            {"id": "phase1", "name": "Phase 1 — Web + Local HF",
             "status": "active",
             "features": ["HF cache auto-scan", "Model selection", "Playwright testing",
                          "OpenCV continuous perception", "Self-repair loop"]},
            {"id": "phase2", "name": "Phase 2 — Vision QA",
             "status": "planned",
             "features": ["Region-aware watchers", "Spinner / toast detection", "DOM+CV fusion",
                          "Template matching"]},
            {"id": "phase3", "name": "Phase 3 — Android",
             "status": "planned",
             "features": ["Appium integration", "ADB actions", "Emulator perception stream"]},
            {"id": "phase4", "name": "Phase 4 — Multi-Agent",
             "status": "planned",
             "features": ["Planner/Coder/Tester/Debugger agents", "Task routing",
                          "Policy engine", "Run dashboards"]},
        ]
    }


# ---------- Tasks ----------
@api.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate):
    model_repo = payload.model_repo_id or select_best(SEED_MODELS, "coding")["repo_id"]
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "spec": payload.spec,
        "model_repo_id": model_repo,
        "max_iterations": payload.max_iterations,
        "created_at": _now(),
    }
    await db.tasks.insert_one(dict(doc))
    return Task(**doc)


@api.get("/tasks", response_model=list[Task])
async def list_tasks():
    docs = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Task(**d) for d in docs]


# ---------- Runs ----------
@api.post("/runs/start", response_model=Run)
async def start_run(payload: RunStart):
    if payload.task_id:
        task = await db.tasks.find_one({"id": payload.task_id}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        name = task["name"]
        spec = task["spec"]
        model_repo = task["model_repo_id"]
        max_iter = task["max_iterations"]
    else:
        if not payload.spec:
            raise HTTPException(status_code=400, detail="spec or task_id required")
        name = payload.name or "Ad-hoc run"
        spec = payload.spec
        model_repo = payload.model_repo_id or select_best(SEED_MODELS, "coding")["repo_id"]
        max_iter = payload.max_iterations

    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "task_id": payload.task_id,
        "name": name,
        "spec": spec,
        "model_repo_id": model_repo,
        "max_iterations": max_iter,
        "status": "queued",
        "created_at": _now(),
    }
    await db.runs.insert_one(dict(run_doc))

    # kick off background agent loop
    asyncio.create_task(run_agent_loop(run_id, spec, model_repo, max_iter, db))

    return Run(**run_doc)


@api.get("/runs", response_model=list[Run])
async def list_runs():
    docs = await db.runs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Run(**d) for d in docs]


@api.get("/runs/{run_id}", response_model=Run)
async def get_run(run_id: str):
    doc = await db.runs.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return Run(**doc)


@api.get("/runs/{run_id}/events", response_model=list[RunEvent])
async def get_run_events(run_id: str, since: Optional[str] = None):
    query: dict[str, Any] = {"run_id": run_id}
    if since:
        query["timestamp"] = {"$gt": since}
    docs = await db.run_events.find(query, {"_id": 0}).sort("timestamp", 1).to_list(5000)
    return [RunEvent(**d) for d in docs]


@api.get("/runs/latest/summary")
async def latest_run_summary():
    run = await db.runs.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not run:
        return {"run": None, "events": [], "stats": {"total": 0, "completed": 0, "failed": 0, "running": 0}}

    events = await db.run_events.find({"run_id": run["id"]}, {"_id": 0}).sort("timestamp", 1).to_list(2000)
    total = await db.runs.count_documents({})
    completed = await db.runs.count_documents({"status": "completed"})
    failed = await db.runs.count_documents({"status": "failed"})
    running = await db.runs.count_documents({"status": {"$in": ["queued", "running"]}})
    return {
        "run": run,
        "events": events,
        "stats": {"total": total, "completed": completed, "failed": failed, "running": running},
    }


# ---------- Download Phase 1 Code ----------
@api.get("/download/phase1.zip")
async def download_phase1():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel_path, content in PHASE1_FILES.items():
            zf.writestr(f"agentic-builder-phase1/{rel_path}", content)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="agentic-builder-phase1.zip"'},
    )


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
