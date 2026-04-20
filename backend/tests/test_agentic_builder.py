"""
Backend test suite for Agentic Builder.
Covers: health, models, phases, tasks, runs, events, summary, zip download.
"""
from __future__ import annotations

import io
import os
import time
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from /app/frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Health ----------
class TestHealth:
    def test_root_health(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert "message" in d and "time" in d


# ---------- Models ----------
class TestModels:
    def test_scan(self, s):
        r = s.post(f"{API}/models/scan")
        assert r.status_code == 200
        d = r.json()
        assert "scanned_at" in d
        assert "cache_dir" in d
        assert "models" in d and isinstance(d["models"], list)
        assert len(d["models"]) == 7
        assert d["total_size_bytes"] > 0
        assert isinstance(d["suggested_model"], str) and "/" in d["suggested_model"]
        # suggested should be a coder model
        assert any(d["suggested_model"] == m["repo_id"] for m in d["models"])
        # validate shape of first model
        m0 = d["models"][0]
        for k in ("repo_id", "revision", "path", "size_on_disk",
                  "capabilities", "params_b", "context_length",
                  "quantization", "last_modified", "notes"):
            assert k in m0

    def test_list(self, s):
        r = s.get(f"{API}/models")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        assert len(d) == 7


# ---------- Phases ----------
class TestPhases:
    def test_phases(self, s):
        r = s.get(f"{API}/phases")
        assert r.status_code == 200
        d = r.json()
        assert "phases" in d
        phases = d["phases"]
        assert len(phases) == 4
        ids = [p["id"] for p in phases]
        assert ids == ["phase1", "phase2", "phase3", "phase4"]
        statuses = {p["id"]: p["status"] for p in phases}
        assert statuses["phase1"] == "active"
        assert statuses["phase2"] == "planned"
        assert statuses["phase3"] == "planned"
        assert statuses["phase4"] == "planned"


# ---------- Tasks ----------
class TestTasks:
    def test_create_and_list_task(self, s):
        payload = {
            "name": "TEST_task_1",
            "spec": "Build a simple hello world page with a heading.",
            "max_iterations": 2,
        }
        r = s.post(f"{API}/tasks", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["spec"] == payload["spec"]
        assert d["max_iterations"] == 2
        assert "id" in d
        assert d["model_repo_id"]  # default selected

        # list includes
        r2 = s.get(f"{API}/tasks")
        assert r2.status_code == 200
        ids = [t["id"] for t in r2.json()]
        assert d["id"] in ids


# ---------- Runs ----------
class TestRuns:
    @pytest.fixture(scope="class")
    def started_run(self, s):
        payload = {
            "name": "TEST_run_adhoc",
            "spec": "Build a minimal HTML page that says Hello.",
            "max_iterations": 2,
        }
        r = s.post(f"{API}/runs/start", json=payload)
        assert r.status_code == 200, r.text
        run = r.json()
        assert run["status"] in ("queued", "running")
        assert run["id"]
        return run

    def test_run_start_requires_spec_or_task(self, s):
        r = s.post(f"{API}/runs/start", json={})
        assert r.status_code == 400

    def test_run_not_found(self, s):
        r = s.get(f"{API}/runs/non-existent-id")
        assert r.status_code == 404

    def test_get_run_and_events_progress(self, s, started_run):
        rid = started_run["id"]
        # wait a bit for events to arrive
        deadline = time.time() + 20
        last_events = []
        while time.time() < deadline:
            ev = s.get(f"{API}/runs/{rid}/events").json()
            if len(ev) >= 3:
                last_events = ev
                break
            time.sleep(1.0)
        assert len(last_events) >= 3, f"Expected events to stream, got {len(last_events)}"
        # stages should include at least plan/code/test
        stages = {e["stage"] for e in last_events}
        assert "plan" in stages
        # check event shape
        e0 = last_events[0]
        for k in ("id", "run_id", "iteration", "stage", "type", "title", "data", "timestamp"):
            assert k in e0

    def test_list_runs(self, s, started_run):
        r = s.get(f"{API}/runs")
        assert r.status_code == 200
        runs = r.json()
        ids = [x["id"] for x in runs]
        assert started_run["id"] in ids

    def test_latest_summary(self, s, started_run):
        r = s.get(f"{API}/runs/latest/summary")
        assert r.status_code == 200
        d = r.json()
        assert "run" in d and "events" in d and "stats" in d
        stats = d["stats"]
        for k in ("total", "completed", "failed", "running"):
            assert k in stats
        assert stats["total"] >= 1

    def test_run_completes_eventually(self, s, started_run):
        """Wait for the run to finish (completed or failed) within a reasonable time."""
        rid = started_run["id"]
        deadline = time.time() + 90  # generous for 2 iterations
        final = None
        while time.time() < deadline:
            r = s.get(f"{API}/runs/{rid}")
            if r.status_code == 200:
                run = r.json()
                if run["status"] in ("completed", "failed"):
                    final = run
                    break
            time.sleep(2.0)
        assert final is not None, f"Run did not finish in time: last={run}"
        assert final["status"] in ("completed", "failed")
        assert final.get("iterations_used", 0) >= 1


# ---------- Download ZIP ----------
class TestDownload:
    def test_phase1_zip(self, s):
        r = s.get(f"{API}/download/phase1.zip")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/zip")
        assert "attachment" in r.headers.get("content-disposition", "")
        buf = io.BytesIO(r.content)
        zf = zipfile.ZipFile(buf)
        names = zf.namelist()
        assert len(names) > 0
        assert all(n.startswith("agentic-builder-phase1/") for n in names)
        # expect ~17 files
        assert len(names) >= 10
