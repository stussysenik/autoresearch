# Tag Optimization Integration

**Date**: 2026-03-13
**Impact**: +29% better discoverability (7/10 -> 9/10 based on experiment)

## Summary

The tag optimization experiment found that **platform-aware prompting** produces significantly better tags. This document describes what was integrated and how.

## What Changed

### 1. Platform Detection (ai.ts)

**Before**:
```typescript
} else {
    systemPrompt = GENERIC_CLASSIFICATION_PROMPT;
}
```

**After**:
```typescript
} else {
    let detectedPlatform = 'unknown';
    if (url) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            if (hostname.includes('github')) detectedPlatform = 'github';
            else if (hostname.includes('youtube') || hostname.includes('youtu.be')) detectedPlatform = 'youtube';
            else if (hostname.includes('reddit')) detectedPlatform = 'reddit';
            else if (hostname.includes('imdb')) detectedPlatform = 'imdb';
            else if (hostname.includes('letterboxd')) detectedPlatform = 'letterboxd';
            else if (hostname.includes('medium')) detectedPlatform = 'medium';
            else if (hostname.includes('substack')) detectedPlatform = 'substack';
        } catch { /* ignore invalid URLs */ }
    }
    systemPrompt = getPlatformAwarePrompt(detectedPlatform);
}
```

### 2. Platform Support

Platforms with specialized prompts:

| Platform | Focus |
|----------|-------|
| GitHub | Tech stack, programming concepts, tools |
| YouTube | Creator, format, subject matter |
| Reddit | Community, discussion topics |
| IMDB | Genre, director, cinematic qualities |
| Letterboxd | Genre, director, cinematic qualities |
| Medium | Subject matter, writing style, author |
| Substack | Subject matter, writing style, author |
| Instagram | Visual aesthetics, creator (pre-existing) |
| Twitter/X | Ideas, discourse, personality (pre-existing) |

Unknown platforms use a default prompt (still optimized).

### 3. Vibe Vocabulary Expansion (15 -> 20)

**Original 15**: kinetic, atmospheric, minimalist, raw, nostalgic, elegant, chaotic, ethereal, tactile, visceral, contemplative, playful, precise, organic, geometric

**New 5**: luminous, bold, fluid, textural, rhythmic

### 4. Tag Structure

Enforced by prompt:
- 1-2 **SPECIFIC IDENTIFIERS**: Named entities, brands, tools, people
- 1-2 **BROADER CATEGORIES**: Subject domains, fields of study
- 1 **VIBE/AESTHETIC** (mandatory): Cross-disciplinary discovery

Total: 3-5 tags per card.

## Expected Outcomes

### Before (Generic Tags)
```json
{
  "url": "https://github.com/openai/openui",
  "tags": ["technology", "code", "developer", "ai"]
}
```

### After (Platform-Aware Tags)
```json
{
  "url": "https://github.com/openai/openui",
  "tags": ["openui", "ai-tooling", "react", "developer-tools", "precise"]
}
```

## Rollback Plan

Revert the change:
```bash
git revert HEAD
```

Or manually restore the old code in `ai.ts`:
```typescript
} else {
    systemPrompt = GENERIC_CLASSIFICATION_PROMPT;
}
```

**Why rollback is safe**:
- No database migrations required
- New prompts are backward compatible
- Can rollback at any time without data loss

## Success Metrics

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Tag quality | 7/10 | 9+/10 |
| Vibe coverage | 60% | 95%+ |
| Avg tags/card | 3.8 | 4-5 |
| Platform-specific tags | 0% | 80%+ |
| Generic tags | Common | 0% |
