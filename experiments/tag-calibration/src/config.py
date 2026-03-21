"""
Shared configuration: env vars, Supabase client, LM setup.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from experiment root
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def get_supabase():
    """Lazy Supabase client — only import when needed."""
    from supabase import create_client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------------
# Claude Code CLI (primary LLM provider)
# ---------------------------------------------------------------------------
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "sonnet")

# ---------------------------------------------------------------------------
# GLM 4.7 via OpenAI-compatible API (optional, legacy)
# ---------------------------------------------------------------------------
ZHIPU_API_KEY = os.environ.get("ZHIPU_API_KEY", "")
ZHIPU_API_BASE = os.environ.get("ZHIPU_API_BASE", "https://api.z.ai/api/coding/paas/v4")
GLM_MODEL = os.environ.get("GLM_MODEL", "glm-4-plus")

# ---------------------------------------------------------------------------
# Ollama / Gemma
# ---------------------------------------------------------------------------
OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:12b")

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
GLM_RPM = int(os.environ.get("GLM_RPM", "30"))
GLM_BATCH_SIZE = int(os.environ.get("GLM_BATCH_SIZE", "5"))

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
(DATA_DIR / "optimized_prompts").mkdir(exist_ok=True)
