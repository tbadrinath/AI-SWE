"""Seed a realistic local HF model registry."""
from __future__ import annotations

SEED_MODELS = [
    {
        "repo_id": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "revision": "a1b2c3d4e5f6",
        "path": "~/.cache/huggingface/hub/models--Qwen--Qwen2.5-Coder-7B-Instruct/snapshots/a1b2c3d4",
        "size_on_disk": 15_400_000_000,
        "capabilities": {"code": True, "chat": True, "vision": False},
        "params_b": 7.6,
        "context_length": 32768,
        "quantization": "bf16",
        "last_modified": "2024-10-21T09:12:00Z",
        "notes": "Strong Python + web coder. Preferred default.",
    },
    {
        "repo_id": "deepseek-ai/deepseek-coder-6.7b-instruct",
        "revision": "7f9c0a1b2d3e",
        "path": "~/.cache/huggingface/hub/models--deepseek-ai--deepseek-coder-6.7b-instruct/snapshots/7f9c0a1b",
        "size_on_disk": 13_800_000_000,
        "capabilities": {"code": True, "chat": True, "vision": False},
        "params_b": 6.7,
        "context_length": 16384,
        "quantization": "bf16",
        "last_modified": "2024-03-15T14:22:00Z",
        "notes": "Popular coding model with strong completion quality.",
    },
    {
        "repo_id": "meta-llama/Llama-3.1-8B-Instruct",
        "revision": "b4e2f8a9c1d0",
        "path": "~/.cache/huggingface/hub/models--meta-llama--Llama-3.1-8B-Instruct/snapshots/b4e2f8a9",
        "size_on_disk": 16_100_000_000,
        "capabilities": {"code": False, "chat": True, "vision": False},
        "params_b": 8.0,
        "context_length": 131072,
        "quantization": "bf16",
        "last_modified": "2024-07-23T11:05:00Z",
        "notes": "General planner/reviewer model.",
    },
    {
        "repo_id": "llava-hf/llava-1.5-7b-hf",
        "revision": "c0ffee1234ab",
        "path": "~/.cache/huggingface/hub/models--llava-hf--llava-1.5-7b-hf/snapshots/c0ffee12",
        "size_on_disk": 14_900_000_000,
        "capabilities": {"code": False, "chat": True, "vision": True},
        "params_b": 7.0,
        "context_length": 4096,
        "quantization": "bf16",
        "last_modified": "2023-12-02T08:00:00Z",
        "notes": "Vision-language model for UI screenshot analysis.",
    },
    {
        "repo_id": "HuggingFaceM4/idefics2-8b",
        "revision": "de1f1c5beef2",
        "path": "~/.cache/huggingface/hub/models--HuggingFaceM4--idefics2-8b/snapshots/de1f1c5b",
        "size_on_disk": 16_800_000_000,
        "capabilities": {"code": False, "chat": True, "vision": True},
        "params_b": 8.4,
        "context_length": 8192,
        "quantization": "bf16",
        "last_modified": "2024-05-18T16:40:00Z",
        "notes": "Multimodal — used for semantic vision judgments.",
    },
    {
        "repo_id": "bigcode/starcoder2-3b",
        "revision": "aa11bb22cc33",
        "path": "~/.cache/huggingface/hub/models--bigcode--starcoder2-3b/snapshots/aa11bb22",
        "size_on_disk": 6_200_000_000,
        "capabilities": {"code": True, "chat": False, "vision": False},
        "params_b": 3.0,
        "context_length": 16384,
        "quantization": "bf16",
        "last_modified": "2024-02-28T10:30:00Z",
        "notes": "Compact code completer. Good on low-memory GPUs.",
    },
    {
        "repo_id": "mistralai/Mistral-7B-Instruct-v0.3",
        "revision": "f0e1d2c3b4a5",
        "path": "~/.cache/huggingface/hub/models--mistralai--Mistral-7B-Instruct-v0.3/snapshots/f0e1d2c3",
        "size_on_disk": 14_200_000_000,
        "capabilities": {"code": False, "chat": True, "vision": False},
        "params_b": 7.0,
        "context_length": 32768,
        "quantization": "bf16",
        "last_modified": "2024-05-22T12:15:00Z",
        "notes": "Fast triage / routing model.",
    },
]


def _score(model: dict, task: str = "coding") -> int:
    score = 0
    caps = model.get("capabilities", {})
    rid = model["repo_id"].lower()
    if task == "coding":
        if caps.get("code"): score += 60
        if caps.get("chat"): score += 20
        if "instruct" in rid: score += 10
    elif task == "vision":
        if caps.get("vision"): score += 60
    size = model.get("size_on_disk", 0)
    gb = size // (1024 ** 3)
    score += min(gb, 15)
    return score


def select_best(models: list[dict], task: str = "coding") -> dict:
    if not models:
        raise RuntimeError("No models available")
    return sorted(models, key=lambda m: _score(m, task), reverse=True)[0]
