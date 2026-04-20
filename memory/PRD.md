# Agentic Builder — PRD

## Original Problem Statement (condensed)
User asked for an autonomous AI agentic engineering system:
- uses local LLMs auto-downloaded/discovered from Hugging Face cache
- continuous perception (OpenCV + screen streaming), not one-off screenshots
- Playwright browser control, testing, self-repair loops
- phased roadmap (Phase 1 web, Phase 2 VLM vision, Phase 3 Android, Phase 4 multi-agent)
- wants a reusable environment so they don't have to re-test each phase manually

Since the cloud container cannot run local HF models, capture a desktop, or drive a browser on
the user's machine, the delivered product is a **control-plane web dashboard + downloadable
Phase 1 Python agent**. The dashboard demonstrates the loop using Claude Sonnet 4.5 (via
emergentintegrations) and ships the full local agent source as a ZIP.

## Architecture
- **Frontend**: React 19 + shadcn/ui + Tailwind, Swiss grid-border design, Cabinet Grotesk / IBM Plex Sans / JetBrains Mono
- **Backend**: FastAPI + Motor/Mongo + emergentintegrations (Claude Sonnet 4.5)
- **Agent loop**: async background task per run, stages: `plan → code → test → perceive → diagnose → fix → done`, events persisted to `run_events` collection, polled by frontend
- **Vision events**: synthesized (motion / stuck / red-region / spinner / toast) since no real desktop
- **Model registry**: 7 curated HF models (Qwen Coder, DeepSeek Coder, Llama 3.1, LLaVA, IDEFICS2, StarCoder2, Mistral) with capability metadata
- **Downloadable Phase 1**: `/api/download/phase1.zip` returns a 17-file Python project that runs the real agent locally

## User Personas
- Autonomous-agent enthusiasts / researchers
- Devs exploring local-first AI coding agents
- Engineering managers evaluating "AI software engineer" concepts

## Implemented (v0.1 — Feb 2026)
### Backend endpoints
- `GET /api/` — health
- `POST /api/models/scan`, `GET /api/models` — seeded HF registry
- `GET /api/phases` — 4-phase roadmap
- `POST/GET /api/tasks` — task CRUD
- `POST /api/runs/start`, `GET /api/runs`, `GET /api/runs/{id}`, `GET /api/runs/{id}/events`, `GET /api/runs/latest/summary`
- `GET /api/download/phase1.zip`

### Frontend pages
- Dashboard (metrics + live iteration timeline + live code viewer + perception + diagnosis, polling every 1.2s)
- Models (7 cards with capability pills, suggested highlighted)
- Task Builder (form + JSON preview + quick examples + start-run)
- Runs (history table with status pills + duration)
- Run Detail (iteration tabs, per-iter code, event log, perception, diagnosis)
- Phases (4 phases, phase1 ACTIVE in Klein Blue)
- Download (ZIP download + quickstart snippet + file tree)

### Testing
- Testing agent iteration 1: **100% backend / 100% frontend, 0 issues**
- pytest suite at `/app/backend/tests/test_agentic_builder.py`

## Prioritized Backlog
### P0
- (none — MVP complete)

### P1
- Phase 2: Region-aware watchers, VLM semantic judgments (LLaVA/IDEFICS2)
- Replace seeded model list with real `huggingface_hub.scan_cache_dir()` when running locally
- Stop dashboard polling when run is not active
- Validate `max_iterations` range (1–10) on both client and server

### P2
- Phase 3: Appium/Android desktop stream
- Phase 4: Planner / Coder / Tester / Debugger multi-agent routing with policy engine
- Auth (JWT + Emergent Google)
- Run audit log export
- Live server-sent-events instead of polling

## Integrations
- **Claude Sonnet 4.5** via `emergentintegrations` (EMERGENT_LLM_KEY) — code generation + planning
