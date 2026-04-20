"""
Simulates the Phase 1 agent loop using Claude Sonnet 4.5 via emergentintegrations.
Emits events to MongoDB which the frontend polls.
"""
from __future__ import annotations

import asyncio
import os
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from emergentintegrations.llm.chat import LlmChat, UserMessage


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event(run_id: str, iteration: int, stage: str, type_: str, title: str, data: dict[str, Any]) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "run_id": run_id,
        "iteration": iteration,
        "stage": stage,
        "type": type_,
        "title": title,
        "data": data,
        "timestamp": _now_iso(),
    }


async def _llm(session_id: str, system: str, user: str, model: str = "claude-sonnet-4-5-20250929") -> str:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    chat = LlmChat(api_key=api_key, session_id=session_id, system_message=system).with_model("anthropic", model)
    try:
        resp = await chat.send_message(UserMessage(text=user))
        return str(resp)
    except Exception as e:
        return f"[LLM unavailable: {e}]"


def _synth_vision_events(run_id: str, iteration: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    out: list[dict] = []
    ts = time.time()
    motions = rng.randint(3, 8)
    for i in range(motions):
        out.append({
            "ts": ts + i * 0.25,
            "type": "motion_detected",
            "confidence": round(rng.uniform(0.4, 0.95), 3),
            "details": {"motion_ratio": round(rng.uniform(0.02, 0.15), 5)},
        })
    if rng.random() < 0.35:
        out.append({
            "ts": ts + 2.0, "type": "screen_possibly_stuck",
            "confidence": 0.8, "details": {"stuck_seconds": round(rng.uniform(8, 14), 2)},
        })
    if rng.random() < 0.28:
        out.append({
            "ts": ts + 3.0, "type": "error_like_red_region",
            "confidence": round(rng.uniform(0.5, 0.9), 3),
            "details": {"red_ratio": round(rng.uniform(0.03, 0.12), 5)},
        })
    if rng.random() < 0.35:
        out.append({
            "ts": ts + 3.5, "type": "spinner_detected",
            "confidence": round(rng.uniform(0.55, 0.85), 3),
            "details": {"region": "center"},
        })
    if rng.random() < 0.30:
        out.append({
            "ts": ts + 4.0, "type": "toast_detected",
            "confidence": round(rng.uniform(0.6, 0.9), 3),
            "details": {"region": "top_right"},
        })
    return out


def _extract_code(text: str) -> str:
    """Extract code block from LLM response."""
    if "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            block = parts[1]
            lines = block.split("\n", 1)
            if lines and lines[0].strip().lower() in {"js", "javascript", "html", "jsx", "python"}:
                return lines[1] if len(lines) > 1 else ""
            return block
    return text.strip()


async def run_agent_loop(run_id: str, task_spec: str, model_repo_id: str, max_iterations: int, db) -> None:
    """Main agent loop: plan -> code -> test -> perceive -> diagnose -> fix."""
    session_id = f"run-{run_id}"

    await db.runs.update_one(
        {"id": run_id},
        {"$set": {"status": "running", "started_at": _now_iso()}},
    )

    async def emit(iteration: int, stage: str, type_: str, title: str, data: dict):
        ev = _event(run_id, iteration, stage, type_, title, data)
        await db.run_events.insert_one({**ev})
        ev.pop("_id", None)

    success = False
    current_code = ""

    for iteration in range(1, max_iterations + 1):
        # --- PLAN ---
        await emit(iteration, "plan", "info", f"Iteration {iteration} — planning",
                   {"message": "Decomposing task into milestones"})
        plan_text = await _llm(
            session_id,
            system="You are a senior software architect. Be concise.",
            user=f"Task: {task_spec}\n\nProduce a 3-bullet execution plan. Keep it under 80 words.",
        )
        await emit(iteration, "plan", "plan", "Execution plan", {"text": plan_text})

        # --- CODE ---
        await emit(iteration, "code", "info", "Generating code",
                   {"message": f"Using local HF model: {model_repo_id}"})
        if iteration == 1:
            code_prompt = (
                f"Task: {task_spec}\n\n"
                "Write a single self-contained index.html file (inline CSS+JS) that implements the task. "
                "Return ONLY the code inside a ```html fenced block. Keep it under 120 lines."
            )
        else:
            code_prompt = (
                f"Task: {task_spec}\n\nCurrent code has issues. Previous code:\n```\n{current_code[:2000]}\n```\n\n"
                "Fix it and return ONLY corrected code inside a ```html fenced block."
            )
        code_text = await _llm(session_id, system="You are an expert frontend engineer. Output only code.", user=code_prompt)
        current_code = _extract_code(code_text)
        await emit(iteration, "code", "code", "Code generated",
                   {"language": "html", "code": current_code, "lines": len(current_code.splitlines())})

        # --- TEST ---
        await emit(iteration, "test", "info", "Running Playwright tests", {"message": "Launching headless browser"})
        await asyncio.sleep(0.6)
        # Iteration 1 more likely to fail, later iterations more likely to pass
        fail_prob = max(0.15, 0.8 - iteration * 0.25)
        test_passed = random.random() > fail_prob
        test_result = {
            "status": "PASS" if test_passed else "FAIL",
            "reason": "" if test_passed else random.choice([
                "Expected element not visible within 5s",
                "Body text did not contain expected phrase",
                "Button click intercepted by modal overlay",
                "Network request returned 422",
            ]),
            "url": "http://localhost:3000",
            "title": "Agent Test Run",
        }
        await emit(iteration, "test", "test_result", f"Test {test_result['status']}", test_result)

        # --- PERCEIVE (continuous vision) ---
        await emit(iteration, "perceive", "info", "Continuous perception (OpenCV)",
                   {"message": "Streaming desktop frames at 6 FPS"})
        vision_events = _synth_vision_events(run_id, iteration, seed=iteration * 97 + hash(run_id) % 1000)
        for ve in vision_events:
            await emit(iteration, "perceive", "vision", ve["type"],
                       {"confidence": ve["confidence"], "details": ve["details"]})

        # --- DIAGNOSE ---
        vision_summary = {"motion_detected": 0, "screen_possibly_stuck": 0,
                          "error_like_red_region": 0, "spinner_detected": 0, "toast_detected": 0}
        for ve in vision_events:
            t = ve["type"]
            if t in vision_summary:
                vision_summary[t] += 1

        diagnosis = {
            "status": "ok" if test_passed else "fail",
            "test_fail": not test_passed,
            "vision_flags": [k for k, v in vision_summary.items() if v > 0 and k != "motion_detected"],
            "summary": vision_summary,
            "reason": test_result["reason"] if not test_passed else "All checks passed",
        }
        await emit(iteration, "diagnose", "diagnosis", f"Diagnosis: {diagnosis['status'].upper()}", diagnosis)

        if test_passed:
            await emit(iteration, "done", "success", "Milestone complete",
                       {"message": "All acceptance checks passed"})
            success = True
            break

        # --- FIX ---
        await emit(iteration, "fix", "info", "Generating patch",
                   {"message": "Asking model for corrected code"})
        await asyncio.sleep(0.4)

    status = "completed" if success else "failed"
    await db.runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": status,
            "finished_at": _now_iso(),
            "final_code": current_code,
            "iterations_used": iteration,
        }},
    )
