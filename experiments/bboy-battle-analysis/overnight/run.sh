#!/usr/bin/env bash
# Overnight Karpathy Loop: TRIVIUM Engine Code Generation
# Uses codex (gpt-5.4) to generate analyze_motion.py + match_beats.py
# Locked evaluate.sh scores each variant 0-100
# Circuit breakers: stale=8, crash_rate=7/10
#
# Launch: ./overnight/run.sh
# Attach: tmux attach -t overnight
# Detach: Ctrl-B, D
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="overnight"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Make eval executable
chmod +x "$DIR/evaluate.sh"

# Launch Karpathy loop in tmux
tmux new-session -d -s "$SESSION" -n "karpathy" \
  "cd '$DIR' && \
   echo '━━━ TRIVIUM Karpathy Loop ━━━' && \
   echo 'Provider: codex (gpt-5.4)' && \
   echo 'Max variants: 100, stale limit: 8' && \
   echo 'Started: '$(date) && \
   echo '' && \
   bun run run-loop.ts 2>&1 | tee run.log; \
   echo ''; echo 'Loop finished at '$(date); \
   echo 'Press Enter to close'; read"

echo ""
echo "━━━ Overnight Karpathy Loop Launched ━━━"
echo ""
echo "  Session: tmux attach -t overnight"
echo "  Provider: codex (gpt-5.4)"
echo "  Eval: 5 tests × 20pts = 100 max"
echo "  Output: overnight/best/ (current best variant)"
echo "  Log: overnight/run.log"
echo "  Results: overnight/results.jsonl"
echo ""
echo "  Circuit breakers:"
echo "    - 8 iterations with no improvement → stop"
echo "    - 7/10 recent failures → stop"
echo ""
echo "  Detach from tmux: Ctrl-B, D"
echo ""
