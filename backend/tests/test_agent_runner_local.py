from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent_runner import evaluate_code_against_spec


def test_evaluate_code_passes_basic_hello_button_spec():
    spec = "Build a single HTML page that says Hello and has one button."
    code = """
    <!doctype html>
    <html>
      <body>
        <h1>Hello</h1>
        <button>Go</button>
      </body>
    </html>
    """
    result = evaluate_code_against_spec(spec, code)
    assert result["passed"] is True
    assert result["failed"] == []


def test_evaluate_code_detects_missing_local_storage():
    spec = "Build a todo app with localStorage persistence."
    code = """
    <!doctype html>
    <html>
      <body>
        <input id="todoInput" />
        <button>Add</button>
        <button>Delete</button>
      </body>
    </html>
    """
    result = evaluate_code_against_spec(spec, code)
    assert result["passed"] is False
    assert any(item["id"] == "persistence" for item in result["failed"])
