#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RUN_UNDER_CAFFEINATE:-}" ]]; then
  exec caffeinate -dimsu env RUN_UNDER_CAFFEINATE=1 "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
RHINO_ROOT="${RHINO_NLCLI_ROOT:-/Users/s3nik/Desktop/rhino-nlcli}"
MAX_ROUNDS="${MAX_ROUNDS:-6}"
TARGET_SCORE="${TARGET_SCORE:-100}"
STOP_AT_EPOCH="${STOP_AT_EPOCH:-}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$SCRIPT_DIR/logs"
MASTER_LOG="$LOG_DIR/overnight-$TIMESTAMP.log"
LAST_MESSAGE="$LOG_DIR/overnight-$TIMESTAMP.last.txt"

mkdir -p "$LOG_DIR"

deadline_reached() {
  [[ -n "$STOP_AT_EPOCH" ]] && [[ "$(date +%s)" -ge "$STOP_AT_EPOCH" ]]
}

{
  echo "[$(date)] init"
  python3 "$SCRIPT_DIR/runner.py" init

  round=1
  while [[ "$round" -le "$MAX_ROUNDS" ]]; do
    if deadline_reached; then
      echo "[$(date)] stop deadline reached, stopping"
      break
    fi

    if ! python3 "$SCRIPT_DIR/runner.py" guard; then
      echo "[$(date)] guard requested stop before round=$round"
      break
    fi

    score="$(python3 "$SCRIPT_DIR/runner.py" best-score)"
    echo "[$(date)] round=$round best_score=$score target=$TARGET_SCORE"

    if [[ -n "$score" ]] && python3 - "$score" "$TARGET_SCORE" <<'PY'
import sys
score = float(sys.argv[1])
target = float(sys.argv[2])
raise SystemExit(0 if score >= target else 1)
PY
    then
      echo "[$(date)] target reached, stopping"
      break
    fi

    if ! codex exec \
      --dangerously-bypass-approvals-and-sandbox \
      -C "$RHINO_ROOT" \
      --add-dir "$SCRIPT_DIR" \
      -o "$LAST_MESSAGE" \
      - < "$SCRIPT_DIR/program.md"; then
      echo "[$(date)] codex exec exited non-zero, continuing to next round"
    fi

    if ! python3 "$SCRIPT_DIR/runner.py" guard; then
      echo "[$(date)] guard requested stop after round=$round"
      break
    fi

    echo "[$(date)] post-round status"
    python3 "$SCRIPT_DIR/runner.py" status
    round=$((round + 1))
  done
} | tee -a "$MASTER_LOG"
