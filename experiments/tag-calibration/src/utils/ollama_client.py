"""
Ollama HTTP client for local Gemma 3 inference.

Calls Ollama's /api/chat endpoint for fast local inference.
No API key needed — just ollama serve running locally.
"""

from __future__ import annotations

import json
import logging

import httpx

from src.config import OLLAMA_BASE, OLLAMA_MODEL

logger = logging.getLogger(__name__)

TIMEOUT = 120  # seconds per call


def call_ollama(
    system: str,
    user: str,
    *,
    model: str = OLLAMA_MODEL,
    base_url: str = OLLAMA_BASE,
    timeout: int = TIMEOUT,
) -> str:
    """Call Ollama chat API, return raw text response.

    Args:
        system: System prompt.
        user: User message.
        model: Ollama model name (e.g., "gemma3:12b").
        base_url: Ollama server URL.
        timeout: Request timeout in seconds.

    Returns:
        Raw text from the model.
    """
    response = httpx.post(
        f"{base_url}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def call_ollama_json(
    system: str,
    user: str,
    *,
    model: str = OLLAMA_MODEL,
    base_url: str = OLLAMA_BASE,
    timeout: int = TIMEOUT,
) -> dict:
    """Call Ollama chat API with forced JSON output.

    Uses Ollama's format="json" parameter to guarantee valid JSON.

    Args:
        system: System prompt (should mention JSON output).
        user: User message.
        model: Ollama model name.
        base_url: Ollama server URL.
        timeout: Request timeout in seconds.

    Returns:
        Parsed JSON dict.
    """
    response = httpx.post(
        f"{base_url}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "format": "json",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    content = response.json()["message"]["content"]
    return json.loads(content)
