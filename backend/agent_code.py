"""
Holds the full Phase 1 agent source code as string constants.
Served via /api/download/phase1.zip for users to run locally.
"""

README_MD = """# Agentic Builder - Phase 1

An autonomous AI agent that uses LOCAL Hugging Face models (auto-discovered from your HF cache),
continuous OpenCV desktop perception, and Playwright browser automation to build, test, and
self-repair web projects iteratively.

## Install

```bash
pip install transformers huggingface_hub accelerate torch playwright opencv-python mss numpy pillow rich requests
playwright install
```

## Run

```bash
python main.py
```

The agent will:
1. Scan your local HF cache (`~/.cache/huggingface/hub`)
2. Auto-select the best local coding model
3. Generate a simple web project
4. Launch it, watch it with OpenCV, test it with Playwright
5. Self-repair on failure, iterate until success

## Structure

- `models/` - HF cache scanner, registry, selector, loader (local_files_only=True)
- `tools/` - editor, terminal, browser_session, actions, tester, observer, vision
- `orchestrator.py` - the perceive->act->test->fix loop
- `config.py` - thresholds and paths
"""

CONFIG_PY = '''from __future__ import annotations

HF_CACHE_DIR = None
APP_URL = "http://localhost:3000"

LOOP_MAX_RETRIES = 5
MAX_NEW_TOKENS = 512

CAPTURE_MONITOR = 1
CAPTURE_FPS = 6
MOTION_THRESHOLD = 0.015
STUCK_SECONDS = 8
ERROR_RED_THRESHOLD = 0.02

PROJECT_FILE = "project/app.js"
MEMORY_FILE = "memory.json"
'''

MODELS_SCANNER_PY = '''from __future__ import annotations

from pathlib import Path
from typing import Any

from huggingface_hub import scan_cache_dir

WEIGHT_PATTERNS = ["*.safetensors", "*.bin", "*.pt", "*.pth"]
TOKENIZER_FILES = [
    "tokenizer.json", "tokenizer_config.json", "vocab.json",
    "merges.txt", "spiece.model", "sentencepiece.bpe.model",
]


def _has_any_glob(path: Path, patterns: list[str]) -> bool:
    return any(any(path.glob(p)) for p in patterns)


def _looks_like_transformers_model(path: Path) -> bool:
    if not path.exists() or not path.is_dir():
        return False
    has_config = (path / "config.json").exists()
    has_weights = _has_any_glob(path, WEIGHT_PATTERNS)
    has_tokenizer = any((path / name).exists() for name in TOKENIZER_FILES)
    return has_config and has_weights and has_tokenizer


def scan_local_hf_models(cache_dir: str | None = None) -> list[dict[str, Any]]:
    info = scan_cache_dir(cache_dir=cache_dir)
    models: list[dict[str, Any]] = []
    for repo in info.repos:
        if str(repo.repo_type) != "model":
            continue
        for revision in repo.revisions:
            snapshot_path = Path(revision.snapshot_path)
            if not _looks_like_transformers_model(snapshot_path):
                continue
            models.append({
                "repo_id": repo.repo_id,
                "revision": revision.commit_hash,
                "path": str(snapshot_path),
                "size_on_disk": getattr(revision, "size_on_disk", None),
            })
    return models
'''

MODELS_REGISTRY_PY = '''from __future__ import annotations

from typing import Any
from .scanner import scan_local_hf_models


def infer_capabilities(repo_id: str) -> dict[str, bool]:
    low = repo_id.lower()
    return {
        "code": any(x in low for x in ["code", "coder"]),
        "chat": any(x in low for x in ["chat", "instruct"]),
        "vision": any(x in low for x in ["vision", "vl", "llava", "idefics"]),
    }


def build_model_registry(cache_dir: str | None = None) -> list[dict[str, Any]]:
    raw = scan_local_hf_models(cache_dir=cache_dir)
    return [{**m, "capabilities": infer_capabilities(m["repo_id"])} for m in raw]
'''

MODELS_SELECTOR_PY = '''from __future__ import annotations

from typing import Any


def _size_bonus(size_on_disk: int | None) -> int:
    if not isinstance(size_on_disk, int):
        return 0
    gb = size_on_disk // (1024 * 1024 * 1024)
    return min(gb, 15)


def select_best_local_model(registry: list[dict[str, Any]], task: str = "coding") -> dict[str, Any]:
    if not registry:
        raise RuntimeError("No usable local Hugging Face models found in cache.")

    scored: list[tuple[int, dict[str, Any]]] = []
    for model in registry:
        score = 0
        repo_id = model["repo_id"].lower()
        caps = model.get("capabilities", {})
        if task == "coding":
            if caps.get("code"): score += 60
            if caps.get("chat"): score += 20
            if "instruct" in repo_id: score += 10
        elif task == "vision":
            if caps.get("vision"): score += 60
        score += _size_bonus(model.get("size_on_disk"))
        scored.append((score, model))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]
'''

MODELS_LOADER_PY = '''from __future__ import annotations

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from config import MAX_NEW_TOKENS

_loaded = {"path": None, "tokenizer": None, "model": None}


def load_text_model(local_path: str):
    if _loaded["path"] == local_path and _loaded["tokenizer"] is not None:
        return _loaded["tokenizer"], _loaded["model"]
    tokenizer = AutoTokenizer.from_pretrained(local_path, local_files_only=True, trust_remote_code=True)
    if tokenizer.pad_token is None and tokenizer.eos_token is not None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        local_path, local_files_only=True, trust_remote_code=True, device_map="auto",
    )
    model.eval()
    _loaded.update(path=local_path, tokenizer=tokenizer, model=model)
    return tokenizer, model


def generate_text(local_path: str, prompt: str, max_new_tokens: int = MAX_NEW_TOKENS) -> str:
    tokenizer, model = load_text_model(local_path)
    inputs = tokenizer(prompt, return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model.generate(
            **inputs, max_new_tokens=max_new_tokens, do_sample=True,
            temperature=0.2, top_p=0.95,
            pad_token_id=tokenizer.pad_token_id, eos_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return text[len(prompt):].strip() if text.startswith(prompt) else text.strip()
'''

TOOLS_EDITOR_PY = '''from pathlib import Path

def write_file(path: str, content: str) -> None:
    p = Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")

def read_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")
'''

TOOLS_TERMINAL_PY = '''import subprocess

def run_command(cmd: str, cwd: str | None = None, timeout: int | None = 60) -> str:
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or "") + "\\n" + (r.stderr or "")
    except Exception as e:
        return f"Command failed: {e}"
'''

TOOLS_BROWSER_PY = '''from playwright.sync_api import sync_playwright


class BrowserSession:
    def __init__(self):
        self._pw = None; self.browser = None; self.page = None

    def start(self, url: str, headless: bool = True):
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=headless)
        self.page = self.browser.new_page()
        self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
        return self.page

    def snapshot(self) -> dict:
        if not self.page: return {"url": "", "title": "", "content_sample": ""}
        try: body = self.page.locator("body").inner_text(timeout=5000)
        except Exception: body = ""
        try: title = self.page.title()
        except Exception: title = ""
        return {"url": self.page.url, "title": title, "content_sample": body[:2000]}

    def stop(self):
        if self.browser: self.browser.close()
        if self._pw: self._pw.stop()
'''

TOOLS_ACTIONS_PY = '''class ActionExecutor:
    def __init__(self, page):
        self.page = page

    def click_text(self, text: str) -> str:
        try:
            self.page.get_by_text(text, exact=False).first.click(timeout=5000)
            return f"clicked_text:{text}"
        except Exception as e: return f"click_text_failed:{text}::{e}"

    def click_selector(self, selector: str) -> str:
        try:
            self.page.locator(selector).first.click(timeout=5000)
            return f"clicked_selector:{selector}"
        except Exception as e: return f"click_selector_failed:{selector}::{e}"

    def type_selector(self, selector: str, value: str) -> str:
        try:
            self.page.locator(selector).first.fill(value, timeout=5000)
            return f"typed_selector:{selector}"
        except Exception as e: return f"type_selector_failed:{selector}::{e}"

    def press_key(self, key: str) -> str:
        try: self.page.keyboard.press(key); return f"pressed_key:{key}"
        except Exception as e: return f"press_key_failed:{key}::{e}"

    def wait_for_text(self, text: str, timeout: int = 5000) -> str:
        try:
            self.page.get_by_text(text, exact=False).first.wait_for(timeout=timeout)
            return f"text_visible:{text}"
        except Exception as e: return f"text_not_visible:{text}::{e}"
'''

TOOLS_TESTER_PY = '''def run_test(page) -> dict:
    result = {"status": "FAIL", "reason": "", "url": "", "title": ""}
    try:
        result["url"] = page.url; result["title"] = page.title()
        body = page.locator("body").inner_text(timeout=5000)
        if "Hello" not in body:
            result["reason"] = "Expected 'Hello' not present in page body"; return result
        result["status"] = "PASS"; return result
    except Exception as e:
        result["reason"] = f"Test execution failed: {e}"; return result
'''

TOOLS_OBSERVER_PY = '''def summarize_events(events: list[dict]) -> dict:
    summary = {"motion_detected": 0, "screen_possibly_stuck": 0, "error_like_red_region": 0}
    for e in events:
        t = e.get("type")
        if t in summary: summary[t] += 1
    return summary

def analyze_system(build_output, test_result, vision_events, action_log, browser_snapshot):
    s = summarize_events(vision_events)
    d = {"status": "ok", "build_error": False, "test_fail": False,
         "vision_flags": [], "action_log": action_log, "browser_snapshot": browser_snapshot,
         "summary": s, "reason": ""}
    low = build_output.lower()
    if any(x in low for x in ["error", "failed", "traceback"]):
        d["build_error"] = True; d["status"] = "fail"
        d["reason"] += "Build output contains failure signals. "
    if test_result.get("status") != "PASS":
        d["test_fail"] = True; d["status"] = "fail"
        d["reason"] += f"Test failed: {test_result.get('reason','')}. "
    if s["screen_possibly_stuck"] > 0:
        d["vision_flags"].append("screen_possibly_stuck"); d["status"] = "fail"
        d["reason"] += "Screen appears stuck. "
    if s["error_like_red_region"] > 0:
        d["vision_flags"].append("error_like_red_region")
        d["reason"] += "Vision detected red error-like regions. "
    if not browser_snapshot.get("content_sample", "").strip():
        d["status"] = "fail"; d["reason"] += "Browser content appears empty. "
    return d
'''

TOOLS_VISION_PY = '''import time
from dataclasses import dataclass, asdict
from typing import Optional
import cv2, mss, numpy as np
from config import (CAPTURE_MONITOR, CAPTURE_FPS, MOTION_THRESHOLD,
                    STUCK_SECONDS, ERROR_RED_THRESHOLD)


@dataclass
class VisionEvent:
    ts: float; type: str; confidence: float; details: dict


class ContinuousPerception:
    def __init__(self):
        self.sct = mss.mss()
        self.monitor = self.sct.monitors[CAPTURE_MONITOR]
        self.prev_gray: Optional[np.ndarray] = None
        self.last_motion_ts = time.time()

    def capture_frame(self):
        raw = np.array(self.sct.grab(self.monitor))
        return cv2.cvtColor(raw, cv2.COLOR_BGRA2BGR)

    def _motion_ratio(self, gray):
        if self.prev_gray is None:
            self.prev_gray = gray; return 1.0
        diff = cv2.absdiff(self.prev_gray, gray)
        _, th = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
        r = float(np.count_nonzero(th)) / float(th.size)
        self.prev_gray = gray; return r

    def _red_ratio(self, frame):
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        m1 = cv2.inRange(hsv, np.array([0,100,80]), np.array([10,255,255]))
        m2 = cv2.inRange(hsv, np.array([170,100,80]), np.array([180,255,255]))
        mask = cv2.bitwise_or(m1, m2)
        return float(np.count_nonzero(mask)) / float(mask.size)

    def analyze_once(self):
        frame = self.capture_frame()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        events: list[VisionEvent] = []
        mr = self._motion_ratio(gray); rr = self._red_ratio(frame); now = time.time()
        if mr > MOTION_THRESHOLD:
            self.last_motion_ts = now
            events.append(VisionEvent(now, "motion_detected", min(1.0, mr*10), {"motion_ratio": round(mr,5)}))
        if (now - self.last_motion_ts) > STUCK_SECONDS:
            events.append(VisionEvent(now, "screen_possibly_stuck", 0.8,
                                       {"stuck_seconds": round(now - self.last_motion_ts, 2)}))
        if rr > ERROR_RED_THRESHOLD:
            events.append(VisionEvent(now, "error_like_red_region", min(1.0, rr*12), {"red_ratio": round(rr,5)}))
        return events

    def stream_events(self, seconds: int = 6) -> list[dict]:
        out = []; interval = 1.0 / CAPTURE_FPS; end = time.time() + seconds
        while time.time() < end:
            s = time.time()
            out.extend(asdict(e) for e in self.analyze_once())
            time.sleep(max(0.0, interval - (time.time() - s)))
        return out
'''

ORCHESTRATOR_PY = '''from __future__ import annotations
import json
from pathlib import Path

from config import APP_URL, LOOP_MAX_RETRIES, PROJECT_FILE, MEMORY_FILE, HF_CACHE_DIR
from models.registry import build_model_registry
from models.selector import select_best_local_model
from models.loader import generate_text
from tools.editor import write_file, read_file
from tools.terminal import run_command
from tools.vision import ContinuousPerception
from tools.browser_session import BrowserSession
from tools.actions import ActionExecutor
from tools.tester import run_test
from tools.observer import analyze_system

_selected = None

def get_selected_model():
    global _selected
    if _selected is None:
        registry = build_model_registry(cache_dir=HF_CACHE_DIR)
        _selected = select_best_local_model(registry, task="coding")
    return _selected

def call_llm(prompt: str) -> str:
    return generate_text(get_selected_model()["path"], prompt=prompt)

def save_memory(data: dict):
    Path(MEMORY_FILE).write_text(json.dumps(data, indent=2), encoding="utf-8")

def build_project():
    prompt = "Create a minimal JavaScript web app file that visibly renders 'Hello'. Return code only."
    write_file(PROJECT_FILE, call_llm(prompt))

def try_interactions(actor: ActionExecutor):
    log = [actor.wait_for_text("Hello", timeout=2500)]
    if not any("text_visible:Hello" in i for i in log):
        log += [actor.click_text("Start"), actor.click_text("Launch"),
                actor.click_selector("button"), actor.press_key("Enter"),
                actor.wait_for_text("Hello", timeout=2500)]
    return log

def fix_code(code, diag, build_out, test_res):
    return call_llm(f"Fix this web app. Code:\\n{code}\\nDiagnosis:\\n{json.dumps(diag)}\\nBuild:{build_out}\\nTest:{json.dumps(test_res)}\\nReturn only corrected code that renders 'Hello'.")

def run_phase1():
    model = get_selected_model()
    if not Path(PROJECT_FILE).exists(): build_project()
    perception = ContinuousPerception()
    for attempt in range(1, LOOP_MAX_RETRIES + 1):
        print(f"=== Attempt {attempt} ===")
        build_out = run_command("npm start", cwd="project", timeout=20)
        browser = BrowserSession(); browser.start(APP_URL, headless=True)
        actor = ActionExecutor(browser.page)
        log = try_interactions(actor)
        events = perception.stream_events(seconds=6)
        snap = browser.snapshot(); test_res = run_test(browser.page)
        diag = analyze_system(build_out, test_res, events, log, snap)
        save_memory({"selected_model": model, "attempt": attempt, "action_log": log,
                     "browser_snapshot": snap, "test_result": test_res,
                     "vision_events": events[:50], "diagnosis": diag})
        print(json.dumps(diag, indent=2)); browser.stop()
        if diag["status"] == "ok": print("SUCCESS"); return
        fixed = fix_code(read_file(PROJECT_FILE), diag, build_out, test_res)
        write_file(PROJECT_FILE, fixed)
    print("FAILED AFTER MAX RETRIES")
'''

MAIN_PY = '''from __future__ import annotations
from config import HF_CACHE_DIR
from models.registry import build_model_registry
from models.selector import select_best_local_model
from orchestrator import run_phase1

def main():
    registry = build_model_registry(cache_dir=HF_CACHE_DIR)
    model = select_best_local_model(registry, task="coding")
    print(f"Using local HF model: {model['repo_id']}")
    print(f"Path: {model['path']}")
    print(f"Capabilities: {model['capabilities']}")
    run_phase1()

if __name__ == "__main__":
    main()
'''

INIT_PY = ""

PHASE1_FILES: dict[str, str] = {
    "README.md": README_MD,
    "config.py": CONFIG_PY,
    "main.py": MAIN_PY,
    "orchestrator.py": ORCHESTRATOR_PY,
    "models/__init__.py": INIT_PY,
    "models/scanner.py": MODELS_SCANNER_PY,
    "models/registry.py": MODELS_REGISTRY_PY,
    "models/selector.py": MODELS_SELECTOR_PY,
    "models/loader.py": MODELS_LOADER_PY,
    "tools/__init__.py": INIT_PY,
    "tools/editor.py": TOOLS_EDITOR_PY,
    "tools/terminal.py": TOOLS_TERMINAL_PY,
    "tools/browser_session.py": TOOLS_BROWSER_PY,
    "tools/actions.py": TOOLS_ACTIONS_PY,
    "tools/tester.py": TOOLS_TESTER_PY,
    "tools/observer.py": TOOLS_OBSERVER_PY,
    "tools/vision.py": TOOLS_VISION_PY,
}
