# 👀 Where to See Everything

## 🌐 On GitHub (Live Now!)

**Your fork**: https://github.com/stussysenik/autoresearch

**What to check:**

### 1. Main README (Updated!)
**URL**: https://github.com/stussysenik/autoresearch#readme

**Look for** at the top:
```
🔬 NEW: Universal Experiment Framework

📁 experiments/ - Universal pattern for A/B testing anything:
- 🏷️ Prompts → +29% better tags (real example!)
- 🤖 Models → GPT-4 vs Claude vs Gemini
[... and more]
```

### 2. Experiments Framework Directory
**URL**: https://github.com/stussysenik/autoresearch/tree/main/experiments

**Files you'll see:**
```
experiments/
├── README.md                    ← Main framework guide (14 KB, mermaid diagrams)
├── QUICK_START.md               ← 15-minute quick start
├── CREATING_EXPERIMENTS.md      ← Step-by-step creation guide
├── INTEGRATION_FLOW.md          ← Experiment → production workflow
├── INFERENCE_INTEGRATION.md     ← Claude Code, OpenAI, Anthropic setup
├── FRAMEWORK_COMPLETE.md        ← What was built
├── DEPLOYMENT_COMPLETE.md       ← Deployment summary
└── _template/                   ← Copy this for new experiments!
    ├── HISTORY.md               ← 8-section audit trail template
    ├── package.json             ← Bun config
    ├── src/
    │   ├── fetch_data.ts
    │   ├── variants.ts
    │   ├── run_experiment.ts
    │   └── analyze_results.ts
    └── README.md
```

### 3. Contribution Guidelines
**URL**: https://github.com/stussysenik/autoresearch/blob/main/CONTRIBUTING.md

**Look for**:
- "Smallest Empowered Diffs" principle
- Conventional commits guide
- Linting setup

### 4. Package Files (Linting & Release)
- https://github.com/stussysenik/autoresearch/blob/main/package.json ← Semantic release
- https://github.com/stussysenik/autoresearch/blob/main/.prettierrc.json ← Prettier
- https://github.com/stussysenik/autoresearch/blob/main/.eslintrc.json ← ESLint
- https://github.com/stussysenik/autoresearch/blob/main/pyproject.toml ← Black + Ruff

---

## 💻 On Your Local Machine

**Location**: `/Users/s3nik/Desktop/autoresearch-playground/`

**Branch**: `main` (only branch!)

### Quick Check Commands

```bash
cd /Users/s3nik/Desktop/autoresearch-playground

# 1. Verify you're on main branch
git branch
# Should show: * main

# 2. See recent commits
git log --oneline -5
# Should show:
# 35ab822 docs: make experiments framework prominent in main README
# 7c48558 docs: add deployment completion summary
# 1406140 chore: add semantic-release, linting configs...
# b4b18d4 feat: add inference integration...
# cb5eea6 feat: add universal autoresearch experiment framework

# 3. Check remotes (fork setup)
git remote -v
# Should show:
# origin    https://github.com/stussysenik/autoresearch.git
# upstream  https://github.com/karpathy/autoresearch.git

# 4. See what's in experiments/
ls -la experiments/
# Should show: README.md, _template/, and 6 other .md files

# 5. Read the main framework guide
cat experiments/README.md | head -50
# Or open in browser:
open experiments/README.md

# 6. Check the template
ls -la experiments/_template/
# Should show: package.json, src/, HISTORY.md, etc.
```

---

## 🔀 Fork/Upstream Setup

**Perfect setup now:**

```
┌─────────────────────────────────────────────┐
│ karpathy/autoresearch (upstream)           │
│ Original LLM training experiments          │
└─────────────────────────────────────────────┘
                    ↓ forked
┌─────────────────────────────────────────────┐
│ stussysenik/autoresearch (origin)          │
│ Your fork with experiments framework       │
└─────────────────────────────────────────────┘
                    ↓ cloned
┌─────────────────────────────────────────────┐
│ /Users/s3nik/Desktop/autoresearch-playground│
│ Your local machine (main branch)          │
└─────────────────────────────────────────────┘
```

**What each remote does:**

- **`origin`** (stussysenik/autoresearch)
  - Your fork on GitHub
  - You push here: `git push origin main`
  - You own this repo

- **`upstream`** (karpathy/autoresearch)
  - Karpathy's original
  - You pull updates from here: `git fetch upstream`
  - Read-only (you don't have push access)

**Workflow:**

```bash
# Work on your fork
git checkout main
git add .
git commit -m "feat: add cool feature"
git push origin main  # Push to YOUR fork

# Get Karpathy's updates (when he releases new stuff)
git fetch upstream
git merge upstream/master  # Merge his changes into your main
git push origin main       # Update your fork with his changes
```

---

## 📋 What to Verify Right Now

### On GitHub

1. **Go to**: https://github.com/stussysenik/autoresearch
2. **Check**: Do you see the "🔬 NEW: Universal Experiment Framework" section at the top?
3. **Click**: `experiments/` folder
4. **See**: 13 files including README.md and _template/

### On Local Machine

```bash
cd /Users/s3nik/Desktop/autoresearch-playground

# Should show all your work:
ls -la experiments/
# Output: README.md, _template/, 6 other guides

# Should show main branch only:
git branch
# Output: * main

# Should show your commits:
git log --oneline -3
# Output: 35ab822, 7c48558, 1406140

# Should show origin + upstream:
git remote -v
# Output: origin (your fork), upstream (karpathy's)
```

---

## 🚀 If You Still Don't See It

### Option 1: Re-clone Fresh

```bash
cd ~/Desktop
rm -rf autoresearch-playground  # Delete old version
git clone https://github.com/stussysenik/autoresearch.git autoresearch-playground
cd autoresearch-playground
git branch  # Should show: * main
ls experiments/  # Should show all files
```

### Option 2: Force Pull

```bash
cd /Users/s3nik/Desktop/autoresearch-playground
git fetch origin
git reset --hard origin/main  # WARNING: Loses local uncommitted changes
ls experiments/  # Should now show everything
```

### Option 3: Check GitHub Web UI

Just open: https://github.com/stussysenik/autoresearch

If you see the experiments folder there but not locally, you need to pull:
```bash
git pull origin main
```

---

## ✅ Checklist

After checking, you should see:

**On GitHub** (https://github.com/stussysenik/autoresearch):
- [ ] Main README shows "🔬 NEW: Universal Experiment Framework"
- [ ] `experiments/` folder exists with 13 files
- [ ] `CONTRIBUTING.md` exists
- [ ] `package.json` exists (semantic release)

**On Local** (/Users/s3nik/Desktop/autoresearch-playground):
- [ ] `git branch` shows only `main`
- [ ] `git log` shows 5 recent commits (35ab822, 7c48558, etc.)
- [ ] `git remote -v` shows origin (your fork) + upstream (karpathy)
- [ ] `ls experiments/` shows README.md, _template/, and 6 guides
- [ ] `cat README.md` shows experiments framework at top

---

## 🆘 Still Can't Find It?

Run this diagnostic:

```bash
cd /Users/s3nik/Desktop/autoresearch-playground
echo "=== DIAGNOSTIC ==="
echo "Branch:" && git branch
echo -e "\nRemotes:" && git remote -v
echo -e "\nLast 3 commits:" && git log --oneline -3
echo -e "\nExperiments folder:" && ls -la experiments/ | head -10
echo -e "\nREADME first 30 lines:" && head -30 README.md
```

**Copy the output and I'll help you debug!**

---

**TL;DR: Everything is on the `main` branch at https://github.com/stussysenik/autoresearch** 🚀
