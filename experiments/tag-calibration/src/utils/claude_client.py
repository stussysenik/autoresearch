"""
Claude Code CLI wrapper for headless LLM calls.

Uses `claude -p` subprocess to pipe prompts and capture responses.
No API key needed — uses the authenticated CLI session.
"""

from __future__ import annotations

import json
import logging
import re
import subprocess

logger = logging.getLogger(__name__)

# Default CLI arguments for headless mode
CLAUDE_CMD = [
    "claude", "-p",
    "--output-format", "text",
    "--model", "sonnet",
]
TIMEOUT = 600  # 10 minutes per call (synthesis prompts can be large)


def call_claude(system: str, user: str, timeout: int = TIMEOUT) -> str:
    """Call claude -p with a combined system+user prompt, return raw text.

    Args:
        system: System-level instructions.
        user: User message / content to process.
        timeout: Subprocess timeout in seconds.

    Returns:
        Raw text output from Claude.

    Raises:
        RuntimeError: If the subprocess fails.
    """
    combined = f"{system}\n\n---\n\n{user}"

    logger.debug("Calling claude -p (%d chars)...", len(combined))
    result = subprocess.run(
        CLAUDE_CMD,
        input=combined,
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    if result.returncode != 0:
        stderr = result.stderr.strip()
        raise RuntimeError(f"claude -p failed (exit {result.returncode}): {stderr}")

    output = result.stdout.strip()
    logger.debug("claude -p returned %d chars", len(output))
    return output


def call_claude_json(system: str, user: str, timeout: int = TIMEOUT) -> dict:
    """Call claude -p and parse the response as JSON.

    Handles markdown code fences, surrounding text, and partial JSON.

    Args:
        system: System-level instructions (should request JSON output).
        user: User message.
        timeout: Subprocess timeout in seconds.

    Returns:
        Parsed JSON dict.

    Raises:
        ValueError: If JSON cannot be extracted from the response.
        RuntimeError: If the subprocess fails.
    """
    raw = call_claude(system, user, timeout)
    return _extract_json(raw)


def _extract_json(text: str) -> dict:
    """Robustly extract a JSON object from LLM output.

    Handles:
    - Clean JSON
    - JSON wrapped in ```json ... ``` fences
    - Leading/trailing commentary
    - Partial JSON (finds outermost braces)
    """
    # Strip markdown code fences
    fenced = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)

    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find outermost { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from response:\n{text[:500]}")
