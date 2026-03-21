# Integration Guide

How to apply the tag-calibration experiment results to the mymind-clone-web production codebase.

## Prerequisites

- Completed all 4 phases (`make all`)
- Reviewed `ANALYSIS.md` and confirmed metrics meet targets
- `data/taxonomy.json`, `data/gold_tags.json`, and `data/optimized_prompts/` exist

## Step 1: Update Tag Vocabulary

**File:** `~/Desktop/mymind-clone-web/apps/web/lib/tag-vocabulary.ts`

Replace `AESTHETIC_VOCABULARY` with the style category vocabulary from `taxonomy.json`:

```typescript
// Before: 50 hardcoded aesthetic terms
export const AESTHETIC_VOCABULARY = [...] as const;

// After: vocabulary from discovered taxonomy
import taxonomy from './taxonomy.json';
export const AESTHETIC_VOCABULARY = taxonomy.categories
  .find(c => c.name === 'style')?.vocabulary ?? [];
```

Update `BLOCKED_TAGS` similarly from `taxonomy.blocked_tags`.

## Step 2: Update Local AI Prompt

**File:** `~/Desktop/mymind-clone-web/apps/web/lib/local-ai/prompt.ts`

Replace `buildLocalClassificationMessage()` with the DSPy-optimized prompt from `data/optimized_prompts/classifyTags.optimized.ts`. The optimized version contains:
- Refined system instruction (discovered by MIPROv2)
- High-quality few-shot examples (selected by BootstrapFewShot)

## Step 3: Update DSPy Service

**File:** `~/Desktop/mymind-clone-web/dspy-service/main.py`

1. Replace `TagSignature` with the calibrated signature
2. Load the compiled DSPy program instead of raw `ChainOfThought`
3. Rename `vibe_tag` → `style_tag` (or whatever the taxonomy calls it)

## Step 4: Batch Re-tag in Supabase

Run a migration script using `data/gold_tags.json`:

```sql
-- For each entry in gold_tags.json:
UPDATE cards SET tags = $1 WHERE id = $2;
```

This is the "big bang" — all cards get new taxonomy-compliant tags at once.

## Step 5: Port Storybook Components

Move from `experiments/tag-calibration/storybook/src/components/` to `mymind-clone-web/apps/web/components/`:

- `TagChip.tsx` → replaces or augments existing `TagDisplay.tsx`
- `TagCloud.tsx` → new component for tag exploration views
- `TaxonomyBrowser.tsx` → admin/debug tool for viewing the taxonomy

## Verification

After integration:
1. Run `npx tsc --noEmit` to verify type safety
2. Test the local AI classification on 10 sample URLs
3. Verify Supabase tags match `gold_tags.json` for a random sample
4. Check that tag-based search and smart spaces still work correctly
