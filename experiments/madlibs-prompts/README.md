# Mermaid Mad-Libs Prompt Experiment

Test whether the M01–M08 dispatch registry in `CLAUDE.md` reliably fires the correct mermaid diagram type when given derived prompts.

## How It Works

```
registry.ts  →  derive  →  3 test prompts  →  Claude Code  →  score
     ↑                                                           |
     └───────────── tune triggers based on misses ───────────────┘
```

**Only `keywords/registry.ts` is ever hand-edited.** Everything else is derived or measured.

## Quick Start

```bash
cd experiments/madlibs-prompts
bun install    # no deps needed, but initializes bun
bun run derive # generates 3 test prompts → data/prompts.json
```

## Testing

1. Run `bun run derive` to generate prompts
2. Open a fresh Claude Code session in this repo
3. Paste each prompt from the output
4. Save Claude's plan output to `data/result-M01.md`, `data/result-M03.md`, `data/result-M05.md`
5. Run `bun run score` to check match rate

## Pass Criterion

3/3 prompts produce the expected mermaid diagram type.

## Results Log

| Date | M01 | M03 | M05 | Score | Notes |
|------|-----|-----|-----|-------|-------|
| —    | —   | —   | —   | —     | Initial setup |

## File Structure

```
madlibs-prompts/
├── keywords/
│   ├── types.ts          # Type definitions
│   └── registry.ts       # THE KERNEL — M01–M08 source of truth
├── src/
│   ├── derive.ts         # Registry → test prompts
│   └── score.ts          # Parse Claude output → score
├── data/                  # Generated prompts + result files
├── package.json
└── README.md
```
