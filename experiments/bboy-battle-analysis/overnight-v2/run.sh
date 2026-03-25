#!/usr/bin/env bash
# Launch TRIVIUM v0.2 Multi-Agent Research Loop in tmux
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="overnight-v2"

# Kill existing session if running
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo "━━━ Launching TRIVIUM v0.2 Multi-Agent Research Loop ━━━"
echo "  Session: $SESSION"
echo "  Directory: $SCRIPT_DIR"
echo "  Monitor: tmux attach -t $SESSION"
echo "  Tail log: tail -f $SCRIPT_DIR/run.log"
echo ""

tmux new-session -d -s "$SESSION" -c "$SCRIPT_DIR" \
  "source ~/.zshrc 2>/dev/null; export PATH=\"/Users/s3nik/.local/bin:/Users/s3nik/.bun/bin:\$PATH\"; bun run run-loop.ts 2>&1 | tee run.log; echo '━━━ LOOP COMPLETE ━━━'; sleep 999999"

echo "Started! Attach with: tmux attach -t $SESSION"
