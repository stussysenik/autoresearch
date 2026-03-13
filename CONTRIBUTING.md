# Contributing to Autoresearch Playground

## 🎯 Core Principle: Smallest Empowered Diffs

**Make the smallest possible change that delivers value.**

### What This Means

- ✅ **Change only what's necessary** - Don't refactor surrounding code
- ✅ **One concept per commit** - Separate features, fixes, and docs
- ✅ **Add, don't rewrite** - Extend existing patterns rather than replacing them
- ✅ **Test minimally** - Only test the changed behavior
- ✅ **Document changes** - But don't rewrite existing docs

### Why This Matters

**Smaller diffs are:**
- Easier to review
- Safer to merge
- Simpler to revert
- Faster to understand
- Less likely to break things

### Examples

**❌ Large, unfocused diff:**
```diff
- const result = oldApproach(input);
+ const result = newApproach(input);
+ // Also refactored 5 other files
+ // Also updated all variable names
+ // Also changed formatting everywhere
```

**✅ Smallest empowered diff:**
```diff
- const result = oldApproach(input);
+ const result = newApproach(input);
+ // That's it. One change. One purpose.
```

---

## 📋 Contribution Guidelines

### 1. Before You Start

- Check existing issues and PRs
- Open an issue to discuss large changes
- Follow the existing code style
- Run linters before committing

### 2. Code Style

**TypeScript/JavaScript** (experiments):
```bash
bun run format       # Format with Prettier
bun run lint         # Lint with ESLint
```

**Python** (main autoresearch):
```bash
uv run black .       # Format with Black
uv run ruff check .  # Lint with Ruff
```

### 3. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new experiment template
fix: resolve timeout issue in run_experiment
docs: update HISTORY.md template
refactor: simplify variant processing
test: add unit tests for platform detection
chore: update dependencies
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 4. Pull Requests

**Title**: Same format as commit messages

**Description**:
```markdown
## Problem
[What issue does this solve?]

## Solution
[How does this PR solve it?]

## Testing
[How did you verify this works?]

## Smallest Empowered Diff?
- [ ] Changes only what's necessary
- [ ] One concept per PR
- [ ] No unnecessary refactoring
- [ ] Tests cover only new behavior
```

---

## 🔬 Experiment Contributions

### Adding a New Experiment Template

1. **Copy `_template/`** to `experiments/your-experiment/`
2. **Customize** for your use case
3. **Run** and document results in `HISTORY.md`
4. **PR** with:
   - Your experiment code
   - Filled `HISTORY.md`
   - `INTEGRATION.md` if applicable

### Improving the Framework

**Before adding new features:**
- Is it universally useful? (Not just for your experiment)
- Can it be opt-in? (Add to template, don't force on all experiments)
- Is it the smallest change that delivers value?

**Areas for improvement:**
- Better inference methods
- More analysis metrics
- Improved documentation
- Bug fixes

---

## 🧪 Testing Philosophy

### Test What You Change

**Don't:**
- Add tests for unchanged code
- Refactor tests you didn't touch
- Aim for 100% coverage of existing code

**Do:**
- Test your new feature
- Test your bug fix
- Keep tests minimal and focused

### Example

**Adding platform detection:**
```typescript
// ✅ Test only the new function
test('detectPlatform identifies GitHub URLs', () => {
  expect(detectPlatform('https://github.com/user/repo')).toBe('github');
});

// ❌ Don't also refactor and test the entire classification system
```

---

## 📝 Documentation

### Update Only What Changed

**Don't:**
- Rewrite entire READMEs
- Fix typos in unrelated docs
- Reorganize documentation structure

**Do:**
- Add docs for your new feature
- Update sections directly affected by your change
- Keep formatting consistent with existing docs

---

## 🚀 Release Process

This repo uses **semantic-release** for automated versioning:

1. **Commit** with conventional format (`feat:`, `fix:`, etc.)
2. **PR** to `main` branch
3. **Merge** → semantic-release automatically:
   - Analyzes commits
   - Determines version bump (major/minor/patch)
   - Updates CHANGELOG.md
   - Creates GitHub release
   - Publishes (if configured)

**Version bumps:**
- `feat:` → minor version (1.0.0 → 1.1.0)
- `fix:` → patch version (1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` → major version (1.0.0 → 2.0.0)

---

## 🌳 Branch Strategy

**Two branches only:**
- `main` - Stable, production-ready code
- `develop` - (Optional) Integration branch for multiple features

**Workflow:**
```bash
# 1. Create feature branch from main
git checkout -b feat/your-feature main

# 2. Make smallest empowered diffs
git add -p  # Add only relevant changes
git commit -m "feat: add your feature"

# 3. Push and create PR
git push origin feat/your-feature

# 4. After merge, delete branch
git branch -d feat/your-feature
```

**No long-lived feature branches** - Merge frequently with small changes

---

## 🐛 Bug Reports

**Good bug report:**
```markdown
## Bug Description
Platform detection fails for `youtu.be` short URLs

## Steps to Reproduce
1. Save card with URL: `https://youtu.be/dQw4w9WgXcQ`
2. Check generated tags
3. Expected: YouTube-specific tags
4. Actual: Generic tags (platform = 'unknown')

## Environment
- OS: macOS 14.0
- Node: 20.11.0
- Bun: 1.0.25

## Suggested Fix
Add `youtu.be` to hostname detection in `ai.ts` line 359
```

---

## ❓ Questions?

- Open an issue for general questions
- Start a discussion for feature ideas
- Check existing docs first

---

## 🙏 Thank You!

Every contribution makes this framework better. Remember:

**Make the smallest possible change that delivers value.** 🎯
