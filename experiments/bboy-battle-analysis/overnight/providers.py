# providers.py — Swap LLMs without changing loop code
import os, subprocess, tempfile, time, random

def call_llm(prompt: str, provider: str = None, timeout: int = 600, model: str = None) -> str:
    provider = provider or os.environ.get("LLM_PROVIDER", "claude")
    prompt_file = f"/tmp/autoresearch-prompt-{int(time.time())}-{random.randint(0, 9999)}.txt"
    with open(prompt_file, "w") as f:
        f.write(prompt)
    try:
        if provider == "claude":
            m = model or "sonnet"
            cmd = f'timeout {timeout} claude -p --output-format text --tools "" --model {m} < {prompt_file}'
        elif provider == "codex":
            m = model or "o4-mini"
            cmd = f"timeout {timeout} cat {prompt_file} | codex -q --model {m}"
        else:
            raise ValueError(f"Unknown provider: {provider}")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout + 30)
        if result.returncode == 124:
            raise TimeoutError(f"LLM call timed out after {timeout}s")
        return result.stdout
    finally:
        try: os.unlink(prompt_file)
        except: pass
