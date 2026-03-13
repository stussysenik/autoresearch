# autoresearch

![teaser](progress.png)

*One day, frontier AI research used to be done by meat computers in between eating, sleeping, having other fun, and synchronizing once in a while using sound wave interconnect in the ritual of "group meeting". That era is long gone. Research is now entirely the domain of autonomous swarms of AI agents running across compute cluster megastructures in the skies. The agents claim that we are now in the 10,205th generation of the code base, in any case no one could tell if that's right or wrong as the "code" is now a self-modifying binary that has grown beyond human comprehension. This repo is the story of how it all began. -@karpathy, March 2026*.

---

## 🔬 **NEW: Universal Experiment Framework**

> **This fork adds a complete framework for running systematic experiments** (not just LLM training!)

**📁 [`experiments/`](./experiments/README.md)** - Universal pattern for A/B testing anything:
- 🏷️ Prompts → +29% better tags (real example!)
- 🤖 Models → GPT-4 vs Claude vs Gemini
- ⚙️ Parameters → Temperature, top_p, etc.
- 📊 Algorithms → BM25 vs vector search
- 🎨 Features → A/B test before production

**Quick start:**
```bash
cp -r experiments/_template experiments/my-experiment
cd experiments/my-experiment
bun run fetch && bun run run && bun run analyze
# See winner in ANALYSIS.md, document in HISTORY.md
```

**Features:**
- ✅ Works out-of-the-box with Claude Code (zero setup!)
- ✅ Complete audit trails (HISTORY.md pattern)
- ✅ Timing controls (configure duration)
- ✅ Mermaid diagrams (visualize workflows)
- ✅ Integration guides (experiment → production)

**📖 [Full framework docs →](./experiments/README.md)**

---

## 🌳 Fork & Branch Strategy

### What is a Fork?

**A fork is YOUR personal copy of someone else's repository.**

Think of it like this:
- **Karpathy's repo** = The original book he's writing
- **Your fork** = Your own copy where you can write notes, add chapters, change things
- **Git keeps them connected** so you can pull his updates while keeping your additions

```
┌─────────────────────────────────┐
│ karpathy/autoresearch          │ ← Original (you don't own)
│ upstream                        │
└─────────────────────────────────┘
          │
          │ Fork = Copy to your GitHub account
          ↓
┌─────────────────────────────────┐
│ stussysenik/autoresearch       │ ← YOUR copy (you own this!)
│ origin                          │   You can do ANYTHING here
│                                 │
│  ├── main                      │ ← Your working branch
│  ├── feat/new-thing            │ ← Your feature
│  └── experiment/test           │ ← Your experiment
└─────────────────────────────────┘
          │
          │ Clone = Download to computer
          ↓
┌─────────────────────────────────┐
│ Your Computer                   │
│ /Desktop/autoresearch-playground│
└─────────────────────────────────┘
```

**Key insight:** Your fork is independent! Changes you make don't affect Karpathy's original (unless you submit a Pull Request to him).

---

### How Fork Syncing Works

**IMPORTANT:** Syncing is **per-branch**, not whole repo!

```
When you sync:
  git checkout main              ← Switch to the branch you want to update
  git fetch upstream             ← Download Karpathy's latest changes
  git merge upstream/master      ← Merge his changes into YOUR branch

Result:
  ✅ Only 'main' gets updated
  ✅ Your other branches are UNTOUCHED
  ✅ Your additions (experiments/, weather-markets/) are KEPT
  ✅ His updates are ADDED to yours
```

**What happens during sync:**

| Your Files | Karpathy's Files | After Sync |
|------------|------------------|------------|
| `experiments/` (only you have) | Doesn't exist | ✅ KEPT (no conflict possible) |
| `weather-markets/` (only you have) | Doesn't exist | ✅ KEPT (no conflict possible) |
| `package.json` (only you have) | Doesn't exist | ✅ KEPT (no conflict possible) |
| `README.md` (you both changed different parts) | Different lines | ✅ AUTO-MERGED (Git combines both) |
| `train.py` (you didn't touch) | Updated by him | ✅ AUTO-UPDATED (you get his changes) |

**Conflicts only happen if:**
- You BOTH changed the EXACT SAME LINES in the same file
- Git will pause and ask you to choose which version to keep
- This is rare and easy to fix!

**Your additions are safe!** Files that only exist in your fork can't conflict.

---

### Which Branches to Work On

**`main` branch** = Karpathy's base + Your experiments framework
- ✅ **Work directly on `main`** for stable framework improvements
- ✅ **Commit and push to `main`** - this is YOUR branch, not frozen!
- ✅ Contains: Original LLM training code + experiments/ directory
- ✅ **Sync from upstream** periodically (monthly or when Karpathy releases new features)

**Feature branches** = Testing new experiments or features
- ✅ **Create branches** when testing: `git checkout -b experiment/new-test`
- ✅ **Merge to `main`** when done: `git merge experiment/new-test`
- ✅ Use for: new experiments, trying ideas, keeping main stable while exploring
- ✅ **Never need to sync** - they're your work, not connected to upstream

**Your branch structure** (example):
```
main                     ← Sync this from upstream/master
├── feat/inference-api   ← Your feature (never synced)
├── experiment/prompts   ← Your test (never synced)
└── wip/ideas           ← Your drafts (never synced)
```

---

### Daily Workflow

```bash
# Working on main (simple, recommended for stable work)
git checkout main
git add .
git commit -m "feat: improve experiments framework"
git push origin main

# OR: Using feature branches (cleaner for experiments)
git checkout -b experiment/prompt-testing
# ... work work work ...
git checkout main
git merge experiment/prompt-testing
git push origin main
```

---

### Getting Karpathy's Updates (Syncing)

```bash
# Periodically (when Karpathy releases new LLM features)
git checkout main              # Switch to main (only this branch will sync!)
git fetch upstream             # Download his updates
git merge upstream/master      # Merge his changes into your main
git push origin main           # Update your fork on GitHub

# Your other branches are NOT affected by this sync!
```

**What gets synced:**
- ✅ Only the branch you're on (`main`)
- ✅ Karpathy's new LLM improvements
- ✅ Your additions stay intact (experiments/, weather-markets/)

**What doesn't get synced:**
- ❌ Your other branches (feat/x, experiment/y)
- ❌ Your files that don't exist in his repo

---

### 🎯 Golden Rules

**1. Your fork = YOUR playground**
   - Do whatever you want with branches
   - Create, delete, rename freely
   - No rules, no restrictions!

**2. Only `main` syncs with upstream**
   - Your other branches never need to sync
   - They're your work, independent of Karpathy's

**3. Sync = per-branch, not whole repo**
   - `git merge upstream/master` only affects current branch
   - Other branches remain unchanged
   - You control what syncs and when

**4. Your additions are safe during sync**
   - Files only in your fork (experiments/, weather-markets/) can't conflict
   - They're automatically kept during merge
   - You only resolve conflicts if you both changed same lines

**5. Sync is optional and periodic**
   - Don't sync every day - only when Karpathy releases updates
   - Monthly or as-needed is fine
   - Your fork works independently!

**TL;DR:**
- ✅ Work on `main` or create your own branches - your choice!
- ✅ Only sync `main` when you want Karpathy's new features
- ✅ Sync only affects the current branch, not all branches
- ✅ Your additions (experiments/, weather-markets/) are always safe
- ✅ Your fork is independent - do whatever you want! 🎯

---

## Original Karpathy Autoresearch

The idea: give an AI agent a small but real LLM training setup and let it experiment autonomously overnight. It modifies the code, trains for 5 minutes, checks if the result improved, keeps or discards, and repeats. You wake up in the morning to a log of experiments and (hopefully) a better model. The training code here is a simplified single-GPU implementation of [nanochat](https://github.com/karpathy/nanochat). The core idea is that you're not touching any of the Python files like you normally would as a researcher. Instead, you are programming the `program.md` Markdown files that provide context to the AI agents and set up your autonomous research org. The default `program.md` in this repo is intentionally kept as a bare bones baseline, though it's obvious how one would iterate on it over time to find the "research org code" that achieves the fastest research progress, how you'd add more agents to the mix, etc. A bit more context on this project is here in this [tweet](https://x.com/karpathy/status/2029701092347630069).

## How it works

The repo is deliberately kept small and only really has three files that matter:

- **`prepare.py`** — fixed constants, one-time data prep (downloads training data, trains a BPE tokenizer), and runtime utilities (dataloader, evaluation). Not modified.
- **`train.py`** — the single file the agent edits. Contains the full GPT model, optimizer (Muon + AdamW), and training loop. Everything is fair game: architecture, hyperparameters, optimizer, batch size, etc. **This file is edited and iterated on by the agent**.
- **`program.md`** — baseline instructions for one agent. Point your agent here and let it go. **This file is edited and iterated on by the human**.

By design, training runs for a **fixed 5-minute time budget** (wall clock, excluding startup/compilation), regardless of the details of your compute. The metric is **val_bpb** (validation bits per byte) — lower is better, and vocab-size-independent so architectural changes are fairly compared.

If you are new to neural networks, this ["Dummy's Guide"](https://x.com/hooeem/status/2030720614752039185) looks pretty good for a lot more context.

## Quick start

**Requirements:** A single NVIDIA GPU (tested on H100), Python 3.10+, [uv](https://docs.astral.sh/uv/).

```bash

# 1. Install uv project manager (if you don't already have it)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install dependencies
uv sync

# 3. Download data and train tokenizer (one-time, ~2 min)
uv run prepare.py

# 4. Manually run a single training experiment (~5 min)
uv run train.py
```

If the above commands all work ok, your setup is working and you can go into autonomous research mode.

## Running the agent

Simply spin up your Claude/Codex or whatever you want in this repo (and disable all permissions), then you can prompt something like:

```
Hi have a look at program.md and let's kick off a new experiment! let's do the setup first.
```

The `program.md` file is essentially a super lightweight "skill".

## Project structure

```
prepare.py      — constants, data prep + runtime utilities (do not modify)
train.py        — model, optimizer, training loop (agent modifies this)
program.md      — agent instructions
pyproject.toml  — dependencies
```

## Design choices

- **Single file to modify.** The agent only touches `train.py`. This keeps the scope manageable and diffs reviewable.
- **Fixed time budget.** Training always runs for exactly 5 minutes, regardless of your specific platform. This means you can expect approx 12 experiments/hour and approx 100 experiments while you sleep. There are two upsides of this design decision. First, this makes experiments directly comparable regardless of what the agent changes (model size, batch size, architecture, etc). Second, this means that autoresearch will find the most optimal model for your platform in that time budget. The downside is that your runs (and results) become not comparable to other people running on other compute platforms.
- **Self-contained.** No external dependencies beyond PyTorch and a few small packages. No distributed training, no complex configs. One GPU, one file, one metric.

## Platform support

This code currently requires that you have a single NVIDIA GPU. In principle it is quite possible to support CPU, MPS and other platforms but this would also bloat the code. I'm not 100% sure that I want to take this on personally right now. People can reference (or have their agents reference) the full/parent nanochat repository that has wider platform support and shows the various solutions (e.g. a Flash Attention 3 kernels fallback implementation, generic device support, autodetection, etc.), feel free to create forks or discussions for other platforms and I'm happy to link to them here in the README in some new notable forks section or etc.

Seeing as there seems to be a lot of interest in tinkering with autoresearch on much smaller compute platforms than an H100, a few extra words. If you're going to try running autoresearch on smaller computers (Macbooks etc.), I'd recommend one of the forks below. On top of this, here are some recommendations for how to tune the defaults for much smaller models for aspiring forks:

1. To get half-decent results I'd use a dataset with a lot less entropy, e.g. this [TinyStories dataset](https://huggingface.co/datasets/karpathy/tinystories-gpt4-clean). These are GPT-4 generated short stories. Because the data is a lot narrower in scope, you will see reasonable results with a lot smaller models (if you try to sample from them after training).
2. You might experiment with decreasing `vocab_size`, e.g. from 8192 down to 4096, 2048, 1024, or even - simply byte-level tokenizer with 256 possibly bytes after utf-8 encoding.
3. In `prepare.py`, you'll want to lower `MAX_SEQ_LEN` a lot, depending on the computer even down to 256 etc. As you lower `MAX_SEQ_LEN`, you may want to experiment with increasing `DEVICE_BATCH_SIZE` in `train.py` slightly to compensate. The number of tokens per fwd/bwd pass is the product of these two.
4. Also in `prepare.py`, you'll want to decrease `EVAL_TOKENS` so that your validation loss is evaluated on a lot less data.
5. In `train.py`, the primary single knob that controls model complexity is the `DEPTH` (default 8, here). A lot of variables are just functions of this, so e.g. lower it down to e.g. 4.
6. You'll want to most likely use `WINDOW_PATTERN` of just "L", because "SSSL" uses alternating banded attention pattern that may be very inefficient for you. Try it.
7. You'll want to lower `TOTAL_BATCH_SIZE` a lot, but keep it powers of 2, e.g. down to `2**14` (~16K) or so even, hard to tell.

I think these would be the reasonable hyperparameters to play with. Ask your favorite coding agent for help and copy paste them this guide, as well as the full source code.

## Notable forks

- [miolini/autoresearch-macos](https://github.com/miolini/autoresearch-macos) (MacOS)
- [trevin-creator/autoresearch-mlx](https://github.com/trevin-creator/autoresearch-mlx) (MacOS)
- [jsegov/autoresearch-win-rtx](https://github.com/jsegov/autoresearch-win-rtx) (Windows)

## License

MIT
