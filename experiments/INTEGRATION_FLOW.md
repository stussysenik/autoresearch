# Experiment → Production: Integration Flow

**How findings become code** - The complete journey from experiment to production.

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: EXPERIMENT (experiments/your-experiment/)         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Fetch Data (bun run fetch)                            │
│     └─> data/input.json (test dataset)                    │
│                                                             │
│  2. Run Experiment (bun run run)                           │
│     └─> data/results.json (variant outputs)               │
│                                                             │
│  3. Analyze (bun run analyze)                              │
│     └─> ANALYSIS.md (findings + winner)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: DECISION (manual review)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Review ANALYSIS.md findings                             │
│  • Identify winning variant                                │
│  • Verify improvement is significant (+20%+)               │
│  • Check for edge cases                                    │
│                                                             │
│  Decision: Integrate? Yes/No/Iterate                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ YES
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: INTEGRATION (modify production code)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Identify Integration Points                            │
│     • Which files need to change?                          │
│     • What functions/constants to update?                  │
│     • Any new dependencies?                                │
│                                                             │
│  2. Apply Changes                                          │
│     • Copy winning prompt/logic                            │
│     • Update production files                              │
│     • Add any new configuration                            │
│                                                             │
│  3. Document Integration                                   │
│     • Create INTEGRATION.md in experiment                  │
│     • List files changed                                   │
│     • Show before/after code                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: TESTING (verify it works)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Unit Tests                                             │
│     └─> Run existing test suite                           │
│                                                             │
│  2. Integration Tests                                      │
│     └─> Test the specific integration                     │
│                                                             │
│  3. Manual Testing                                         │
│     └─> Real-world scenarios                              │
│                                                             │
│  4. Database Validation (if applicable)                    │
│     └─> Check production data quality                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ PASS
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: DEPLOYMENT                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  git add [modified files]                                  │
│  git commit -m "feat: integrate [experiment] (+X%)"        │
│  git push origin main                                      │
│                                                             │
│  Monitor: Track metrics after deployment                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Real Example: Tag Optimization

### Phase 1: Experiment ✅

**Location**: `/experiments/tag-optimization/`

```bash
bun run fetch_test_cards.ts
# → Generated: test_cards.json (23 diverse cards)

bun run run_experiment.ts
# → Generated: experiment_results.json (4 variants × 5 cards)

bun run analyze_results.ts
# → Generated: ANALYSIS.md
```

**Winner**: Platform-Aware Prompting (9/10 vs 7/10 baseline)

### Phase 2: Decision ✅

**Review**: Checked ANALYSIS.md
- +29% improvement in tag quality
- Platform-specific identifiers working
- Vibe coverage increased 60% → 95%

**Decision**: Integrate ✅

### Phase 3: Integration ✅

**Integration Points Identified**:

1. **Prompt definitions** → `/apps/web/lib/prompts/classification.ts`
   - Add `VIBE_VOCABULARY` (expand 15 → 20)
   - Add `PLATFORM_GUIDELINES` mapping
   - Create `getPlatformAwarePrompt(platform)` function

2. **Classification logic** → `/apps/web/lib/ai.ts`
   - Add platform detection from URL
   - Replace `GENERIC_CLASSIFICATION_PROMPT` with `getPlatformAwarePrompt()`

**Files Changed**:
```
apps/web/lib/prompts/classification.ts  (+80 lines)
apps/web/lib/ai.ts                      (+15 lines)
```

**Code Applied**:

**classification.ts** - Added winning prompt:
```typescript
// NEW: Expanded vibe vocabulary (experiment finding)
export const VIBE_VOCABULARY = [
  // Original 15
  'kinetic', 'atmospheric', 'minimalist', /* ... */
  // New 5 (from experiment)
  'luminous', 'bold', 'fluid', 'textural', 'rhythmic'
] as const;

// NEW: Platform-specific guidelines (experiment finding)
const PLATFORM_GUIDELINES: Record<string, string> = {
  github: 'Focus on tech stack, programming concepts, tools',
  youtube: 'Focus on creator, format, subject matter',
  reddit: 'Focus on community, discussion topics',
  // ... 8 platforms total
};

// NEW: Platform-aware prompt generator (winning variant)
export function getPlatformAwarePrompt(platform?: string): string {
  const guideline = PLATFORM_GUIDELINES[platform] || PLATFORM_GUIDELINES.default;
  // ... returns customized prompt
}
```

**ai.ts** - Added platform detection:
```typescript
// NEW: Platform detection logic
let detectedPlatform = 'unknown';
if (url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('github')) detectedPlatform = 'github';
    else if (hostname.includes('youtube')) detectedPlatform = 'youtube';
    // ... 8 platforms
  } catch { /* ignore */ }
}

// NEW: Use platform-aware prompt instead of generic
systemPrompt = getPlatformAwarePrompt(detectedPlatform);
```

**Documentation Created**:
```
experiments/tag-optimization/INTEGRATION_COMPLETE.md
```

### Phase 4: Testing ⏳

**Status**: Ready for testing

**Test Plan**:
1. ✅ Unit tests (platform detection logic)
2. ⏳ Manual save tests (5 platforms)
3. ⏳ Database validation (SQL queries)

**Testing Checklist**: See `TESTING_CHECKLIST.md`

### Phase 5: Deployment ⏳

**Ready when**: All tests pass

**Command**:
```bash
git add apps/web/lib/prompts/classification.ts apps/web/lib/ai.ts
git commit -m "feat: integrate platform-aware tagging (+29% discoverability)"
git push origin main
```

---

## Generic Integration Template

For any experiment, follow this pattern:

### 1. Create INTEGRATION.md in Experiment

```markdown
# [Experiment Name] Integration Guide

## Winning Variant
**Name**: [variant name]
**Improvement**: +X%
**Why it won**: [reasoning]

## Files to Modify

### File: /path/to/file1.ts
**Lines**: X-Y
**Change**: [description]

**Before**:
\`\`\`typescript
// old code
\`\`\`

**After**:
\`\`\`typescript
// new code from winning variant
\`\`\`

### File: /path/to/file2.ts
...

## Testing Checklist
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Edge cases verified
- [ ] Production metrics tracked

## Deployment
\`\`\`bash
git add [files]
git commit -m "feat: integrate [experiment] (+X%)"
git push origin main
\`\`\`
```

### 2. Identify Integration Points

**Ask yourself**:
- What code does this experiment replace?
- What new code does it introduce?
- What files need to change?
- Are there dependencies?

**Common patterns**:
- **Prompt experiments** → Update prompt constants/functions
- **Algorithm experiments** → Update processing logic
- **Parameter experiments** → Update configuration values
- **Feature experiments** → Add new functions/components

### 3. Apply Changes Atomically

**Best practice**:
```typescript
// ❌ DON'T: Mix experiment changes with other work
git commit -m "feat: add platform detection and fix bug and refactor"

// ✅ DO: Separate commits
git commit -m "feat: integrate platform-aware tagging (+29%)"
git commit -m "fix: handle edge case in URL parsing"
```

### 4. Test Thoroughly

**Minimum testing**:
- [ ] Existing tests still pass
- [ ] New functionality works as expected
- [ ] Edge cases handled
- [ ] No regressions

**Document test results** in INTEGRATION.md

### 5. Monitor After Deployment

**Track these metrics**:
- Performance (latency, throughput)
- Quality (user feedback, error rates)
- Improvement (the +X% you promised)

**If metrics don't match experiment**: Investigate and iterate

---

## Key Principles

### 1. Experiments Are Disposable, Code Is Not

**Experiment files** (temporary):
- `test_cards.json` - Can be regenerated
- `experiment_results.json` - Historical record
- `ANALYSIS.md` - Documentation

**Production code** (permanent):
- Must be maintainable
- Must be tested
- Must be documented

### 2. Document the Integration

**Why**:
- Future you will forget the details
- Others need to understand what changed
- Helps debug if something breaks

**How**:
- Create `INTEGRATION.md` in experiment
- Show before/after code
- List all files changed
- Document testing approach

### 3. Integration Is Not Automatic

**Claude Code won't**:
- Automatically apply experiment findings
- Guess which files to modify
- Know your testing strategy

**You must**:
- Review ANALYSIS.md and decide
- Identify integration points manually
- Write/run tests yourself
- Deploy when ready

### 4. Not All Experiments Should Be Integrated

**Integrate when**:
- ✅ Improvement is significant (+20%+)
- ✅ Winner is clear
- ✅ No major downsides
- ✅ Production-ready

**Don't integrate when**:
- ❌ No clear winner
- ❌ Marginal improvement (<10%)
- ❌ Needs more testing
- ❌ Too complex for production

---

## FAQ

**Q: Can integration be automated?**
A: Partially. You can script simple substitutions, but testing and validation must be manual.

**Q: What if the experiment fails (no winner)?**
A: Document findings in ANALYSIS.md, iterate with new variants, or abandon if not promising.

**Q: How do I know what files to change?**
A: Look at experiment variants - they often contain the new code. Ask: "Where is this logic used in production?"

**Q: Can I integrate multiple winners?**
A: Yes, but integrate one at a time. Test each separately to isolate improvements.

**Q: What if integration breaks something?**
A: Revert the commit, fix the issue, re-test, re-integrate. This is why we test thoroughly first.

---

## Checklist: From Experiment to Production

**Before you start**:
- [ ] Experiment complete with ANALYSIS.md
- [ ] Winner clearly identified
- [ ] Improvement significant enough to justify change

**Integration**:
- [ ] Create INTEGRATION.md in experiment
- [ ] Identify all files to modify
- [ ] Show before/after code in docs
- [ ] Apply changes to production files
- [ ] Run existing test suite
- [ ] Add new tests if needed
- [ ] Manual testing completed
- [ ] Edge cases verified

**Deployment**:
- [ ] All tests passing
- [ ] Code reviewed (if team project)
- [ ] Commit with descriptive message
- [ ] Push to production
- [ ] Monitor metrics post-deployment

**Post-deployment**:
- [ ] Track promised improvement (+X%)
- [ ] Fix any issues that arise
- [ ] Update experiment docs with actual results
- [ ] Archive experiment or keep for reference

---

**Remember**: The experiment finds the answer. Integration puts it into production. They're separate phases with different goals.
