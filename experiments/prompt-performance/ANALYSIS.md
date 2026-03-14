# Prompt Performance Analysis Report

> Generated 2026-03-14 — Heuristic analysis, no LLM calls

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total prompts analyzed | **3,444** |
| With session enrichment | 971 (28%) |
| Unique projects | 61 |
| Time span | 2025-10-01 → 2026-03-14 |
| Overall grade | **C-** |
| Average composite | 42.7 |
| Median composite | 42.8 |
| 90th percentile | 55.2 |
| 10th percentile | 32.0 |

### Grade Distribution

| Grade | Count | % |
|-------|-------|---|
| A+ | 7 | 0.2% |
| A | 53 | 1.5% |
| A- | 65 | 1.9% |
| B+ | 100 | 2.9% |
| B | 132 | 3.8% |
| B- | 339 | 9.8% |
| C+ | 371 | 10.8% |
| C | 511 | 14.8% |
| C- | 380 | 11.0% |
| D+ | 401 | 11.6% |
| D | 452 | 13.1% |
| D- | 362 | 10.5% |
| F | 271 | 7.9% |

---

## 2. Top 10 Golden Prompts

These prompts scored highest across all dimensions. They represent your best prompt engineering practices.

### #1 — Score: 84.1 (A+) | instagram-evolution-mentions | 2026-01-17 23:35

```
Implement the following plan:

# Fix Accessibility & UX Issues in Horizontal Scroll Implementation

## Problem Summary

The horizontal scroll implementation has critical accessibility and UX issues discovered via browser inspection:

### Issues Identified (via Chrome DevTools)

1. **Text Illegibility - Horizontal Page**
   - Title "For The Gram" appears as very light gray on white (nearly invisible)
   - Subtitle uses `--gray-500` (#868E96) on white - borderline WCAG compliance
   - Screensho...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 100 |
| Action Density | 80 |
| Context Loading | 81 |
| Iteration | 50 |
| Compound Efficiency | 96 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • References line numbers • Includes code/error context • Uses numbered steps

### #2 — Score: 81.4 (A+) | v0-clone | 2026-01-19 03:31

```
Implement the following plan:

# OpenSpec Proposal: Bedrock Precision Engine

## Change ID: `009-bedrock-precision-engine`

**Status**: PROPOSED
**Type**: Architecture Enhancement (Multi-Phase System Overhaul)
**Priority**: All phases in sequential order
**Architecture Decision**: Keep Svelte 5 reactivity (no HTMX migration)

---

## Executive Summary

Transform v0-clone from a "rapid prototyper" into a **precision design instrument** as outlined in the PRD vision. This is a foundational shif...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 80 |
| Context Loading | 81 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #3 — Score: 80.4 (A+) | instagram-evolution-mentions | 2026-01-17 18:32

```
Implement the following plan:

# "For The Gram" - Instagram's Evolution in Music Lyrics

## Project Summary
An interactive data journalism project (Pudding-style) exploring how Instagram references in song lyrics evolved from 2010 to present. Uses scrollytelling with D3.js visualizations.

## Current State Analysis
The foundation has been set up:
- **SvelteKit project** initialized with dependencies (D3, LayerCake)
- **TypeScript types** defined (`src/lib/types.ts`)
- **CSS styling** complete...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 80 |
| Context Loading | 76 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #4 — Score: 80.4 (A+) | instagram-evolution-mentions | 2026-01-17 18:50

```
Implement the following plan:

# "For The Gram" - Instagram's Evolution in Music Lyrics

## Project Summary
An interactive data journalism project (Pudding-style) exploring how Instagram references in song lyrics evolved from 2010 to present. Uses scrollytelling with D3.js visualizations.

## Current State Analysis
The foundation has been set up:
- **SvelteKit project** initialized with dependencies (D3, LayerCake)
- **TypeScript types** defined (`src/lib/types.ts`)
- **CSS styling** complete...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 80 |
| Context Loading | 76 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #5 — Score: 80 (A+) | convex-playground | 2026-01-19 16:24

```
Implement the following plan:

# Plan: Full-Stack Prototyping Engine with LM Studio + Convex Chef

## Summary

Set up a "full-stack prototyping engine" combining:
- **LM Studio** for local LLM inference (privacy, no cloud costs)
- **Convex Chef** (forked) for AI-powered code generation
- **Hot-swappable database** abstraction supporting Convex and PostgreSQL

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 Playground App (Vite+React)...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 99 |
| Action Density | 80 |
| Context Loading | 68 |
| Iteration | 50 |
| Compound Efficiency | 88 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • References line numbers • Includes code/error context • Uses numbered steps

### #6 — Score: 79.8 (A+) | mymind-clone-web | 2026-01-25 17:33

```
Implement the following plan:

# Plan: Document Nix as Default Development Environment

## Summary

**Goal:** Update project documentation to reflect Nix as the default dev environment, following OpenSpec workflow.

**Current State:**
- `flake.nix` exists and is comprehensive (1000+ lines, pinned Node 20.x, multiple shells)
- OpenSpec proposal #011 exists but tasks aren't marked complete
- README.md, DOCS.md, PROGRESS.md have **zero Nix mentions**

---

## Phase 1: Update Proposal 011 Tasks

...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 80 |
| Context Loading | 73 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #7 — Score: 78.7 (A+) | mymind-clone-web | 2026-01-20 11:02

```
Implement the following plan:

# ScreenshotOne Setup Guide

## Your Questions Answered

### 1. **Do I need both keys?**
**No, only ONE key needed: ScreenshotOne**
- **ScreenshotOne API key**: Required for 1080p+ high-quality screenshots
- **Microlink**: No key needed! It's a public API used as automatic fallback

### 2. **Is there a free tier?**
**Yes! ScreenshotOne offers:**
- **Free tier**: 100 screenshots/month
- No credit card required
- Perfect for testing and small projects

**Paid tier...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 84 |
| Action Density | 80 |
| Context Loading | 75 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #8 — Score: 77.6 (A) | clean-writer | 2026-01-20 16:19

```
Implement the following plan:

# Plan: Elevate Motion Design to Studio Quality

## Summary

Implement premium motion design for Clean Writer's syntax panel, separating desktop/mobile UI paradigms and adding spring-based animations inspired by Zajno, Animations.dev, and Devouring Details. Uses **GSAP** for professional-grade animation control.

## Key Changes

1. **Responsive Paradigm Separation** (1024px breakpoint)
   - Desktop: Left-positioned syntax panel (`left: 2rem; bottom: 2rem`)
   - ...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 80 |
| Context Loading | 68 |
| Iteration | 50 |
| Compound Efficiency | 92 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #9 — Score: 76.2 (A) | fulala-live-menu | 2026-01-21 00:46

```
Implement the following plan:

# Plan: Fulala Menu Enhancement System

## Vision
Transform Fulala into a **modern Asian restaurant menu platform** that's:
- Open to diverse customers (tourists, locals, dietary restrictions)
- Configurable display modes (Standard List, Dim Sum Grid, Card Grid)
- Rich food attributes with intuitive icons
- Self-order capability with McDonald's receipt-style running total

---

## Phase 1: Layout Configuration System

### Goal
Add **Dim Sum Grid** and **Card Gri...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 89 |
| Action Density | 70 |
| Context Loading | 68 |
| Iteration | 50 |
| Compound Efficiency | 96 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • Includes code/error context • Uses numbered steps

### #10 — Score: 74.7 (A) | clean-writer | 2026-01-17 00:04

```
Implement the following plan:

# OpenSpec Proposal: unified-syntax-panel-ux-fixes

## Summary
Fix UX issues with UnifiedSyntaxPanel: binary click toggle, word count on bookmark tab, theme selector alignment, simplify toggle section, **plus emoji/UTF display toggle and international language support (Chinese, Japanese, German)**.

---

## Issues to Fix

### 1. Theme Selector Alignment
- **Problem:** Theme dots in top left NOT aligned with gear icon on right
- **Fix:** Change `items-start` to `...
```

| Dimension | Score |
|-----------|-------|
| Specificity | 100 |
| Action Density | 80 |
| Context Loading | 81 |
| Iteration | 50 |
| Compound Efficiency | 100 |

**Why it works:** High specificity (file refs, identifiers) • Strong action density • Rich task-specific context • Multi-step structure • Includes file paths • References line numbers • Includes code/error context • Uses numbered steps

---

## 3. Bottom 10 — Improvement Opportunities

These prompts had the lowest scores. Each includes a concrete rewrite suggestion.

### #1 — Score: 0 (F) | breakdex

**Original:**
```
are we stuck?
```

**Anti-patterns:** `terse-implicit` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
[Be specific about what to do next, e.g.:]
Fix the remaining TypeScript errors in src/components/Button.tsx
[or]
Run the test suite and show me failures in the auth module
```

### #2 — Score: 0 (F) | breakdex

**Original:**
```
are we stuck?
```

**Anti-patterns:** `terse-implicit` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
[Be specific about what to do next, e.g.:]
Fix the remaining TypeScript errors in src/components/Button.tsx
[or]
Run the test suite and show me failures in the auth module
```

### #3 — Score: 5.3 (F) | clean-writer

**Original:**
```
it would also be freaking awesome if you could display emojis or somehow enable that's just like copy/paste its utf code or something so if you paste in or type in an emoji you get to choose to display either the emoji, or utf! then make sure that chinese mandarin is also supported as input, germ...
```

**Anti-patterns:** `boilerplate-paste` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
then make sure that chinese mandarin is also supported as input, german, japanese (kawaki emojis too).  use the internet to search what to help you as helper tools some nifty/
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #4 — Score: 5.3 (F) | clean-writer

**Original:**
```
it would also be freaking awesome if you could display emojis or somehow enable that's just like copy/paste its utf code or something so if you paste in or type in an emoji you get to choose to display either the emoji, or utf! then make sure that chinese mandarin is also supported as input, germ...
```

**Anti-patterns:** `boilerplate-paste` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
then make sure that chinese mandarin is also supported as input, german, japanese (kawaki emojis too).  use the internet to search what to help you as helper tools some nifty/
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #5 — Score: 5.3 (F) | clean-writer

**Original:**
```
it would also be freaking awesome if you could display emojis or somehow enable that's just like copy/paste its utf code or something so if you paste in or type in an emoji you get to choose to display either the emoji, or utf! then make sure that chinese mandarin is also supported as input, germ...
```

**Anti-patterns:** `boilerplate-paste` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
then make sure that chinese mandarin is also supported as input, german, japanese (kawaki emojis too).  use the internet to search what to help you as helper tools some nifty/
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #6 — Score: 10.5 (F) | BreakingFlashcards

**Original:**
```
I'd like to think about this from first principles and really get deep on the issue before applying any changes to the code. Come backwith critical thinking, evidence (perhaps thinking about it in the terms of category theory - only for the analysis part might behelpful: "Model via category theor...
```

**Anti-patterns:** `boilerplate-paste` (-15), `meta-overload` (-8)

**Suggested rewrite:**
```
Categorize issues. " Come back with your analysis, think step by step
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #7 — Score: 10.5 (F) | BreakingFlashcards

**Original:**
```
I'd like to think about this from first principles and really get deep on the issue before applying any changes to the code. Come backwith critical thinking, evidence (perhaps thinking about it in the terms of category theory - only for the analysis part might behelpful: "Model via category theor...
```

**Anti-patterns:** `boilerplate-paste` (-15), `meta-overload` (-8)

**Suggested rewrite:**
```
Categorize issues. " Come back with your analysis, think step by step
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #8 — Score: 10.5 (F) | BreakingFlashcards

**Original:**
```
I'd like to think about this from first principles and really get deep on the issue before applying any changes to the code. Come backwith critical thinking, evidence (perhaps thinking about it in the terms of category theory - only for the analysis part might behelpful: "Model via category theor...
```

**Anti-patterns:** `boilerplate-paste` (-15), `meta-overload` (-8)

**Suggested rewrite:**
```
Categorize issues. " Come back with your analysis, think step by step
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #9 — Score: 10.6 (F) | v0-ipod

**Original:**
```
use /openspec:proposal to fix the iPod "1 of 10" text edit just like all the other design elements in the iPod interface, use spec-driven + TDD with playwright, playwriter, dev-browser and chrome-dev-tools MCPs the first one is low-hanging fruit the second one requires to have MCPs already setup ...
```

**Anti-patterns:** `boilerplate-paste` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
use /openspec:proposal to fix the iPod "1 of 10" text edit just like all the other design elements in the iPod interface, use spec-driven + TDD with playwright, playwriter, dev-browser and chrome-dev-tools MCPs the first one is low-hanging fruit the second one requires to have MCPs already setup so yeah but I'd like to programmatically test whether you have all the access to these tools because this will immmensely open up your possibilities to just using the acces of CLI + visual feedback for quality asessment, log debugging output and just like better faster rapid-prototyping with higher design fidelity, performance, network performance, lighthouse everything
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

### #10 — Score: 10.6 (F) | v0-ipod

**Original:**
```
use /openspec:proposal to fix the iPod "1 of 10" text edit just like all the other design elements in the iPod interface, use spec-driven + TDD with playwright, playwriter, dev-browser and chrome-dev-tools MCPs the first one is low-hanging fruit the second one requires to have MCPs already setup ...
```

**Anti-patterns:** `boilerplate-paste` (-15), `no-new-info` (-15)

**Suggested rewrite:**
```
use /openspec:proposal to fix the iPod "1 of 10" text edit just like all the other design elements in the iPod interface, use spec-driven + TDD with playwright, playwriter, dev-browser and chrome-dev-tools MCPs the first one is low-hanging fruit the second one requires to have MCPs already setup so yeah but I'd like to programmatically test whether you have all the access to these tools because this will immmensely open up your possibilities to just using the acces of CLI + visual feedback for quality asessment, log debugging output and just like better faster rapid-prototyping with higher design fidelity, performance, network performance, lighthouse everything
[Remove the boilerplate template — focus 80% of tokens on task-specific context]
```

---

## 4. Score Distributions

### Composite (avg: 42.7, n=3444)

```
    0-  9 | █ 29
   10- 19 | ███ 122
   20- 29 | ███ 120
   30- 39 | ██████████████████████████████ 1071
   40- 49 | ████████████████████████████████████████ 1406
   50- 59 | █████████████ 471
   60- 69 | ████ 136
   70- 79 | ██ 84
   80- 89 |  5
   90- 99 |  0
```

### Specificity (avg: 43.4, n=3444)

```
   30- 39 | ████████████████████████████████████████ 2129
   40- 49 | ████████ 441
   50- 59 | █████ 243
   60- 69 | ████ 239
   70- 79 | ███ 154
   80- 89 | ███ 143
   90- 99 | ██ 84
  100-109 |  11
```

### Action Density (avg: 38.9, n=3444)

```
    0-  9 |  1
   10- 19 | █ 33
   20- 29 | ██ 123
   30- 39 | ████████████████████████████████████████ 2103
   40- 49 | ████████████ 617
   50- 59 | █████ 287
   60- 69 | ██ 126
   70- 79 | █ 40
   80- 89 | ██ 114
   90- 99 |  0
```

### Context Loading (avg: 40.6, n=3444)

```
   10- 19 |  2
   20- 29 | █ 24
   30- 39 | ████████████████████████████████████████ 1800
   40- 49 | █████████████████████████ 1131
   50- 59 | █████ 231
   60- 69 | ███ 137
   70- 79 | █ 52
   80- 89 | █ 67
   90- 99 |  0
```

### Iteration Pattern (avg: 57.0, n=3444)

```
   20- 29 | █ 37
   30- 39 |  7
   40- 49 |  8
   50- 59 | ████████████████████████████████████████ 2135
   60- 69 | ███ 179
   70- 79 | ███████████████████ 1008
   80- 89 | █ 62
   90- 99 |  4
  100-109 |  4
```

### Compound Efficiency (avg: 39.6, n=3444)

```
   20- 29 | ███████ 308
   30- 39 | ████████████████████████████████████████ 1876
   40- 49 | ████████████████ 770
   50- 59 | ████ 166
   60- 69 | ███ 138
   70- 79 | █ 36
   80- 89 |  18
   90- 99 | █ 27
  100-109 | ██ 105
```

### Tool Leverage (avg: 70.0, n=971)

```
   30- 39 | █ 10
   40- 49 | ███ 31
   50- 59 | ███████ 68
   60- 69 | ██████████████ 133
   70- 79 | ████████████████████████████████████████ 391
   80- 89 | ██████████████████████████████████ 330
   90- 99 | █ 8
```

### Outcome Signal (avg: 61.9, n=971)

```
   30- 39 | ███████ 71
   40- 49 | ████████████████████ 199
   50- 59 | █████████ 89
   60- 69 | ████████████████████████████████████████ 401
   70- 79 | ████ 36
   80- 89 | █ 9
   90- 99 | ███████████████ 151
  100-109 | █ 15
```

---

## 5. Prompt Type Breakdown

| Type | Count | % | Avg Score | Grade | Best Dimension |
|------|-------|---|-----------|-------|----------------|
| other | 2824 | 82.0% | 40.5 | D+ | Specificity (40) |
| implement/build | 328 | 9.5% | 56.3 | B | Compound (64) |
| fix/debug | 161 | 4.7% | 53.5 | B- | Specificity (67) |
| review/analyze | 54 | 1.6% | 43.2 | C- | Compound (45) |
| run/test | 39 | 1.1% | 44.8 | C | Action Density (49) |
| update/modify | 38 | 1.1% | 41.0 | D+ | Action Density (55) |

---

## 6. Temporal Evolution

### Monthly Average Composite

| Month | Prompts | Avg Score | Grade | Trend |
|-------|---------|-----------|-------|-------|
| 2025-10 | 1488 | 41.5 | C- | — |
| 2025-11 | 67 | 41.5 | C- | ➡️ |
| 2026-01 | 707 | 43.3 | C- | ➡️ |
| 2026-02 | 523 | 43.6 | C- | ➡️ |
| 2026-03 | 659 | 44.2 | C | ➡️ |

### Performance by Hour of Day

```
  00:00 | ██████████████████████ 44.6 (n=168)
  01:00 | ███████████████████████ 46.0 (n=67)
  02:00 | █████████████████████ 42.9 (n=82)
  03:00 | ████████████████████████ 48.3 (n=15)
  04:00 | █████████████████████ 42.3 (n=10)
  05:00 | ████████████████████████ 47.0 (n=1)
  09:00 | ██████████████████ 36.3 (n=16)
  10:00 | ████████████████████ 40.8 (n=67)
  11:00 | █████████████████████ 42.6 (n=176)
  12:00 | █████████████████████ 42.7 (n=256)
  13:00 | ██████████████████████ 44.0 (n=287)
  14:00 | ██████████████████████ 43.9 (n=253)
  15:00 | █████████████████████ 42.1 (n=295)
  16:00 | ██████████████████████ 44.8 (n=258)
  17:00 | █████████████████████ 42.7 (n=230)
  18:00 | ████████████████████ 40.7 (n=172)
  19:00 | ████████████████████ 40.2 (n=221)
  20:00 | █████████████████████ 41.1 (n=208)
  21:00 | █████████████████████ 41.5 (n=205)
  22:00 | █████████████████████ 42.5 (n=236)
  23:00 | ██████████████████████ 43.3 (n=221)
```

### Performance by Day of Week

| Day | Prompts | Avg Score | Grade |
|-----|---------|-----------|-------|
| Sun | 408 | 41.4 | C- |
| Mon | 399 | 42.4 | C- |
| Tue | 367 | 43.9 | C- |
| Wed | 535 | 42.9 | C- |
| Thu | 463 | 43.8 | C- |
| Fri | 579 | 42.4 | C- |
| Sat | 693 | 42.4 | C- |

---

## 7. Per-Project Performance

| Project | Prompts | Avg Score | Grade | Strongest Dimension |
|---------|---------|-----------|-------|--------------------|
| BreakingFlashcards | 861 | 41.3 | C- | Specificity (50) |
| breakdex | 744 | 42.4 | C- | Iteration (53) |
| breakdex-flutter | 300 | 44.7 | C | Iteration (63) |
| mymind-clone-web | 252 | 42.6 | C- | Iteration (63) |
| clean-writer | 223 | 45.1 | C | Iteration (62) |
| fulala-live-menu | 129 | 44.1 | C | Iteration (64) |
| Desktop | 100 | 40.8 | D+ | Iteration (63) |
| fastest-music-vol-2 | 89 | 43.3 | C- | Iteration (62) |
| breaking-computer-vision | 73 | 41.1 | C- | Iteration (55) |
| v0-clone | 67 | 41.2 | C- | Iteration (62) |
| mymind-clone | 63 | 44.3 | C | Iteration (69) |
| v0-ipod | 61 | 42.0 | C- | Iteration (57) |
| samples-from-mars | 44 | 41.8 | C- | Iteration (66) |
| autoresearch-playground | 36 | 48.4 | C+ | Iteration (62) |
| hype-commerce-swiss-tool | 34 | 40.1 | D+ | Iteration (68) |
| instagram-evolution-mentions | 33 | 41.7 | C- | Iteration (59) |
| symphony-setup | 27 | 44.9 | C | Iteration (64) |
| recap | 25 | 42.5 | C- | Iteration (60) |
| breakphysics | 24 | 43.6 | C- | Iteration (52) |
| fulala | 23 | 44.0 | C | Iteration (67) |
| strava-art-work-planner | 23 | 50.1 | B- | Iteration (67) |
| convex-playground | 17 | 46.6 | C | Iteration (61) |
| fulala.cz | 17 | 43.6 | C- | Iteration (56) |
| math_reader | 13 | 53.7 | B- | Specificity (62) |
| mermaid-cli-claude-code-plan | 13 | 44.2 | C | Iteration (52) |
| src | 12 | 42.6 | C- | Iteration (60) |
| apple-music-curated-music-finder | 11 | 42.0 | C- | Iteration (64) |
| artist-os | 11 | 41.8 | C- | Iteration (64) |
| fulala-menu-print | 11 | 46.4 | C | Iteration (65) |
| free-cad-toothbrush-idea | 9 | 41.2 | C- | Iteration (69) |
| portfolio-forever | 9 | 47.0 | C | Iteration (65) |
| mengxuanzou.com | 8 | 44.1 | C | Iteration (63) |
| mxzou.com | 8 | 36.8 | D | Iteration (65) |
| onlook-ruby-elixir-clone | 8 | 44.1 | C | Iteration (60) |
| zimtohrli | 7 | 37.1 | D | Iteration (59) |
| common-lisp-koan | 7 | 41.2 | C- | Iteration (59) |
| portfolio_2026 | 6 | 45.9 | C | Iteration (63) |
| dance-hit-audio-signature-matlab... | 6 | 49.1 | C+ | Iteration (68) |
| open-ai-symphony | 5 | 40.6 | D+ | Iteration (57) |
| ytb-curated-watch | 4 | 37.4 | D | Iteration (55) |
| journal-capture-physical-form | 4 | 27.8 | F | Iteration (55) |
| kimi-playground | 3 | 27.6 | F | Iteration (50) |
| trello-clone-swift-ui | 3 | 40.1 | D+ | Iteration (57) |

---

## 8. Anti-pattern Frequency

| Anti-pattern | Count | % | Penalty | Description |
|-------------|-------|---|---------|-------------|
| `terse-implicit` | 209 | 6.1% | -15 | Ultra-short prompts relying on implicit context |
| `meta-overload` | 203 | 5.9% | -8 | >3 meta-instructions (CoT, category theory, etc.) |
| `multi-project-thrash` | 151 | 4.4% | -8 | 3+ project switches within 5 minutes |
| `boilerplate-paste` | 143 | 4.2% | -10 | Reusing >200-char prompt templates verbatim |
| `kitchen-sink` | 125 | 3.6% | -10 | 5+ unrelated action verbs in one long prompt |
| `vague-opener` | 72 | 2.1% | -5 | Starts with hedging language (can you, please, etc.) |
| `no-new-info` | 40 | 1.2% | -15 | Duplicate or near-duplicate of previous prompt |
| `frustration-signal` | 15 | 0.4% | -5 | Emotional expression reducing prompt clarity |
| `context-amnesia` | 13 | 0.4% | -5 | References prior conversation (Claude has full history) |
| `still-not-working` | 9 | 0.3% | -10 | Frustration signal without new diagnostic data |

### Examples

**`terse-implicit`** (209 occurrences)
> update the documentation
>
> execute then
>

**`meta-overload`** (203 occurrences)
> 1. Review the documented issue and CLAUDE.md guidelines. Turn on swift-expert mode to resolve the issue/implemenation...
>
> 1. /Users/s3nik/Desktop/dev playground/BreakingFlashcards/BreakingFlashcards/PRD/10-01-25/3. plan.md\ Review the docu...
>

**`multi-project-thrash`** (151 occurrences)
> btw, how come and why didn't you use openspec throghout for better context, task management and in general pushing ba...
>
> continue
>

**`boilerplate-paste`** (143 occurrences)
> Review the documented issue and CLAUDE.md guidelines. Use swift-expert agent to resolve the issue/implemenation preci...
>
> Review the documented issue and CLAUDE.md guidelines. Use swift-expert agent to resolve the issue/implemenation preci...
>

**`kitchen-sink`** (125 occurrences)
> Implement the following plan:  # Samples from Mars - 62GB Audio Extraction Fix  ## Problem Summary  Processing 62GB (...
>
> Implement the following plan:  # Plan: RAM-Safe Audio Pipeline for 62GB Mars Samples  ## Hardware Constraints - **CPU...
>

**`vague-opener`** (72 occurrences)
> could you edit /Users/s3nik/Desktop/dev playground/BreakingFlashcards/BreakingFlashcards/.prettierrc to be adherent t...
>
> could you tell me from the logs which function calls/methods are responsible for the unwanted behavior upon loading a...
>

**`no-new-info`** (40 occurrences)
> why did you create a new ~/Desktop/YTBWatch gosh work in ~/Desktop/ytb-curated-watch
>
> s3nik@seniks-Mac-Studio mymind-clone % npx cap sync ios [error] ios platform has not been added yet.         See the ...
>

**`frustration-signal`** (15 occurrences)
> just execute the plan, what's taking so long /Users/s3nik/Desktop/dev playground/BreakingFlashcards/BreakingFlashcard...
>
> not true there's a double rotation applied seems like when you quickly go back /Users/s3nik/Desktop/dev playground/Br...
>

**`context-amnesia`** (13 occurrences)
> so what do you suggest... i already have them cherry-picked
>
> Wait you've arrived this quite hastily... given that I told you to think about this from 1st principles + category th...
>

**`still-not-working`** (9 occurrences)
> this doesn't give me an idea of like: you've today implemented this and a rundown of summarized engineering efforts o...
>
> 1. info is still not showing fully 2. fix the closing + gearbox close/open bug it's like you cannot close it sometime...
>

---

## 9. Top 10 Recommendations

Ranked by impact: (% of prompts affected) × (potential score improvement)

### 1. Eliminate boilerplate template pasting

- **Affected:** 143 prompts (4.2%)
- **Current:** ~300-word template pasted verbatim 20+ times
- **Benchmark:** Top prompters: 80% task-specific, 20% meta-instructions
- **Action:** Save your template as a CLAUDE.md instruction. Each prompt should be 80%+ task context (files, errors, expected behavior).
- **Example:**
  Before: [300-word boilerplate] + "fix this error"
  After: "Fix TypeScript error in src/auth.ts:42 — Type 'string' not assignable to 'User'. Expected: login() returns User object."
- **Est. improvement:** +15 composite per affected prompt

### 2. Replace terse confirmations with specific next-steps

- **Affected:** 209 prompts (6.1%)
- **Current:** "Yes", "execute then", "continue", "let's do it"
- **Benchmark:** Every prompt should add value — name the specific action or file
- **Action:** Instead of confirming, state what you want done: which file, which change, what to verify.
- **Example:**
  Before: "Yes"
  After: "Apply the auth fix to src/middleware.ts and run the test suite"
- **Est. improvement:** +20 composite per affected prompt

### 3. Add file paths to every prompt

- **Affected:** 2450 prompts (71.1%)
- **Current:** Average specificity: 43
- **Benchmark:** Top 0.01%: 85 specificity — every prompt names a file
- **Action:** Always include the file path. Add line numbers when referring to errors.
- **Example:**
  Before: "fix the type error"
  After: "Fix the type error in src/utils/parser.ts:127 — 'undefined' is not assignable to 'string'"
- **Est. improvement:** +10-15 specificity per prompt

### 4. Include new diagnostic data in follow-ups

- **Affected:** 9 prompts (0.3%)
- **Current:** "still not working" without new error output
- **Benchmark:** Each follow-up should add new information (logs, error output, test results)
- **Action:** Paste the actual current error. Describe what changed since last attempt. Include relevant log output.
- **Example:**
  Before: "Still not working"
  After: "Still failing — new error after your fix: TypeError at line 89. Output: [paste]. The previous null check isn't reached because..."
- **Est. improvement:** +10 iteration + removes -10 penalty

### 5. Reduce meta-instructions to max 2 per prompt

- **Affected:** 203 prompts (5.9%)
- **Current:** 39 action density with 6-8 meta-instructions stacked
- **Benchmark:** Top 0.01%: max 2 meta-instructions, rest is task-specific
- **Action:** Pick your top 2 meta-instructions (e.g. 'step-by-step' + 'add logging'). Move the rest to CLAUDE.md.
- **Example:**
  Before: [chain-of-thought + category theory + first principles + Curry-Howard + ...]
  After: "Think step-by-step. Add diagnostic logging. [then the actual task]"
- **Est. improvement:** +8 action density + removes -8 penalty

### 6. Use numbered steps for multi-part requests

- **Affected:** 797 prompts
- **Current:** Average compound efficiency: 40
- **Benchmark:** Top 0.01%: 3-5 numbered steps per complex prompt
- **Action:** When asking for multiple things, number them. Each step should have a clear deliverable.
- **Example:**
  Before: "Fix the bug and add tests and update the docs"
  After: "1. Fix the null pointer in getUser() at auth.ts:42\n2. Add test case for null user ID\n3. Update API docs for /auth endpoint"
- **Est. improvement:** +15 compound efficiency

### 7. State expected vs actual behavior

- **Affected:** 1826 prompts with low context loading
- **Current:** Average context loading: 41
- **Benchmark:** Top 0.01%: 80 — always include expected vs actual
- **Action:** For every bug report: state what should happen, what actually happens, and include the error.
- **Example:**
  Before: "the login is broken"
  After: "Login should redirect to /dashboard after success. Instead it shows a blank page. Console shows: TypeError: Cannot read 'token' of undefined"
- **Est. improvement:** +15 context loading

### 8. Avoid rapid project switching

- **Affected:** 151 prompts
- **Current:** 3+ projects in 5-minute windows
- **Benchmark:** Focus on one project per session for deeper context
- **Action:** Batch work by project. Complete one project's tasks before switching.
- **Example:**
  Before: Project A → B → C → A in 5 min
  After: Finish Project A tasks, then move to B
- **Est. improvement:** +8 removes thrash penalty + better session context

### 9. Start prompts with action verbs

- **Affected:** 2681 prompts (77.8%)
- **Current:** Many prompts start with nouns, articles, or questions
- **Benchmark:** Top prompters: 80%+ start with a direct action verb
- **Action:** Lead with the verb: Fix, Implement, Add, Remove, Update, Review, etc.
- **Example:**
  Before: "The search feature needs pagination"
  After: "Add pagination to the search feature in SearchResults.tsx"
- **Est. improvement:** +5-10 action density

### 10. End sessions with a commit or test verification

- **Affected:** 753 sessions without commits/tests
- **Current:** Many sessions end without tangible artifacts
- **Benchmark:** Top 0.01%: 90% of sessions end with a commit or verified test
- **Action:** Close sessions with "commit these changes" or "run the test suite to verify".
- **Example:**
  After implementation: "Run the full test suite, then commit with message: fix(auth): handle null user token"
- **Est. improvement:** +20 outcome signal

---

## 10. Benchmark vs Top 0.01%

| Dimension | Your Avg | Top 0.01% | Gap | Verdict |
|-----------|----------|-----------|-----|---------|
| Specificity | 43.4 | 85 | 41.6 | Major opportunity |
| Action Density | 38.9 | 78 | 39.1 | Major opportunity |
| Context Loading | 40.6 | 80 | 39.4 | Major opportunity |
| Iteration | 57.0 | 75 | 18.0 | Significant gap |
| Compound Efficiency | 39.6 | 72 | 32.4 | Major opportunity |
| Tool Leverage | 70.0 | 82 | 12.0 | Room to improve |
| Outcome Signal | 61.9 | 90 | 28.1 | Major opportunity |

### Overall Assessment

- **Your average composite:** 42.7
- **Top 0.01% estimated composite:** 82
- **Gap:** 39.3 points

**Verdict:** Significant room for growth. The biggest wins: (1) always include file paths, (2) reduce boilerplate, (3) add diagnostic data to follow-ups.

---

*Generated by prompt-performance analyzer — 2026-03-14T13:43:08.442Z*
*Heuristic analysis only — no LLM API calls were made*
