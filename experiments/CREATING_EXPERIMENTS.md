# Creating Autoresearch Experiments

This guide walks you through creating a new autoresearch experiment from scratch using the provided template.

## When to Create an Experiment

Create an experiment when you need to:
- **A/B test prompts or algorithms** with systematic evaluation
- **Evaluate new features** before production deployment
- **Analyze production data** for insights and patterns
- **Compare variations** of parameters, models, or approaches
- **Research optimizations** with measurable outcomes

**Don't create an experiment for:**
- Quick one-off tests (use console/REPL instead)
- Production debugging (use logging/monitoring)
- Simple data queries (use Supabase dashboard)

## Setup Steps

### 1. Copy the Template

```bash
# Navigate to experiments directory
cd /Users/s3nik/Desktop/autoresearch-playground/experiments

# Copy template with your experiment name
cp -r _template my-experiment-name
cd my-experiment-name
```

**Naming conventions:**
- Use lowercase with hyphens: `tag-optimization`, `prompt-testing`, `model-comparison`
- Be descriptive but concise: avoid generic names like `experiment1` or `test`

### 2. Configure Environment

```bash
# Create .env from example
cp .env.example .env

# Edit .env with your credentials
# nano .env  # or use your preferred editor
```

**Required environment variables:**
```env
# Supabase connection (if fetching from database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Optional: OpenAI API key (if using external LLM)
OPENAI_API_KEY=sk-...

# Optional: Custom configuration
SAMPLE_SIZE=30
MAX_VARIANTS=4
```

**Security reminder:**
- ✅ `.env` is already in `.gitignore` (never commit it!)
- ✅ Use service role keys only for backend experiments
- ✅ Rotate keys after completing experiments

### 3. Install Dependencies

```bash
bun install
```

The template includes these default dependencies:
- `@supabase/supabase-js` - Database client
- `typescript` - Type safety
- `@types/node` - Node.js types

**Add more as needed:**
```bash
bun add openai          # If using OpenAI API
bun add zod             # For schema validation
bun add csv-parser      # For CSV data processing
```

### 4. Customize the Experiment

Now customize the template files for your specific use case:

#### A. Define Your Data Source (`src/fetch_data.ts`)

**Default template:**
```typescript
// Fetches from Supabase cards table
const { data: cards } = await supabase
  .from('cards')
  .select('*')
  .limit(30)
```

**Customize for your needs:**
```typescript
// Example: Fetch specific card types
const { data: cards } = await supabase
  .from('cards')
  .select('id, title, content, tags, metadata')
  .eq('type', 'text')
  .not('content', 'is', null)
  .order('created_at', { ascending: false })
  .limit(50)

// Example: Join with users table
const { data: cards } = await supabase
  .from('cards')
  .select(`
    *,
    user:users(email, created_at)
  `)
  .limit(30)

// Example: Filter by date range
const { data: cards } = await supabase
  .from('cards')
  .select('*')
  .gte('created_at', '2025-01-01')
  .lte('created_at', '2025-01-31')
```

**Non-Supabase sources:**
```typescript
// Example: Fetch from external API
const response = await fetch('https://api.example.com/data')
const data = await response.json()

// Example: Read local CSV
import fs from 'fs/promises'
import csvParser from 'csv-parser'

const data = []
fs.createReadStream('input.csv')
  .pipe(csvParser())
  .on('data', (row) => data.push(row))
  .on('end', () => {
    fs.writeFile('data/input.json', JSON.stringify(data, null, 2))
  })
```

#### B. Define Your Variants (`src/variants.ts`)

**Template structure:**
```typescript
export const variants = [
  {
    name: 'variant_a',
    description: 'Baseline approach',
    prompt: 'Your prompt template here...',
  },
  {
    name: 'variant_b',
    description: 'Improved approach',
    prompt: 'Alternative prompt template...',
  },
]
```

**Example: Prompt testing**
```typescript
export const variants = [
  {
    name: 'baseline',
    description: 'Current production prompt',
    prompt: `Generate tags for this content:\n\n{content}\n\nReturn 3-5 tags.`,
  },
  {
    name: 'lexical_guided',
    description: 'Using linguistic categories',
    prompt: `Analyze this content using lexical categories:

Content: {content}

Generate exactly 3-5 tags:
1. ENTITY (1): Named person/brand/place
2. CONCEPT (1-2): Abstract field/domain
3. QUALITY (1): Adjective describing mood/aesthetic

Return JSON: {"entity": "...", "concepts": [...], "quality": "..."}`,
  },
  {
    name: 'chain_of_thought',
    description: 'Step-by-step reasoning',
    prompt: `Think step-by-step to tag this content:

{content}

Step 1: What is the core essence?
Step 2: What broader fields does it relate to?
Step 3: What aesthetic quality describes it?
Step 4: Final 3-5 tags?

Return JSON: {"analysis": "...", "tags": [...]}`,
  },
]
```

**Example: Parameter testing**
```typescript
export const variants = [
  {
    name: 'low_temp',
    description: 'Temperature 0.3 (more deterministic)',
    temperature: 0.3,
    max_tokens: 100,
  },
  {
    name: 'medium_temp',
    description: 'Temperature 0.7 (balanced)',
    temperature: 0.7,
    max_tokens: 100,
  },
  {
    name: 'high_temp',
    description: 'Temperature 1.0 (more creative)',
    temperature: 1.0,
    max_tokens: 100,
  },
]
```

#### C. Customize Experiment Runner (`src/run_experiment.ts`)

**Template provides:**
- Loop through variants
- Process each data item
- Structure results
- Save to JSON

**Customize for your workflow:**

```typescript
// Example: Process in parallel
const results = await Promise.all(
  variants.flatMap(variant =>
    testData.map(item => processWithVariant(item, variant))
  )
)

// Example: Subsample data per variant
for (const variant of variants) {
  const sample = testData.slice(0, 5) // First 5 items
  for (const item of sample) {
    const result = await processWithVariant(item, variant)
    results.push(result)
  }
}

// Example: Add metadata to results
const result = {
  ...generatedOutput,
  metadata: {
    variant: variant.name,
    timestamp: new Date().toISOString(),
    inputId: item.id,
    processingTime: Date.now() - startTime,
  },
}
```

#### D. Define Analysis Metrics (`src/analyze_results.ts`)

**Template provides:**
- Basic counting and grouping
- Per-variant summaries
- Markdown output

**Customize for your metrics:**

```typescript
// Example: Tag quality metrics
function analyzeTagQuality(results: Result[]) {
  return {
    avgTagCount: results.reduce((sum, r) => sum + r.tags.length, 0) / results.length,
    uniqueTags: new Set(results.flatMap(r => r.tags)).size,
    vibeTagCoverage: results.filter(r =>
      r.tags.some(tag => VIBE_VOCABULARY.includes(tag))
    ).length / results.length,
  }
}

// Example: Statistical comparison
function compareVariants(variantA: Result[], variantB: Result[]) {
  const avgA = variantA.reduce((sum, r) => sum + r.score, 0) / variantA.length
  const avgB = variantB.reduce((sum, r) => sum + r.score, 0) / variantB.length
  const improvement = ((avgB - avgA) / avgA) * 100

  return {
    variantA: avgA,
    variantB: avgB,
    improvement: `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`,
  }
}

// Example: Lexical category distribution
function analyzeLexicalCategories(tags: string[]) {
  return {
    namedEntities: tags.filter(t => /^[A-Z]/.test(t)).length,
    multiWord: tags.filter(t => t.includes('-')).length,
    singleWord: tags.filter(t => !t.includes('-')).length,
  }
}
```

### 5. Update Documentation

#### A. Update Experiment README

Edit `README.md` with:
- **Objective**: What are you testing?
- **Hypothesis**: What do you expect to find?
- **Methodology**: How will you test it?
- **Setup**: Installation and configuration steps
- **Usage**: How to run the experiment
- **Expected Output**: What files will be generated

**Template provided** - just fill in the blanks!

#### B. Document Results in ANALYSIS.md

After running the experiment, create `ANALYSIS.md`:
```markdown
# [Experiment Name] Results

## Objective
[What you were testing]

## Methodology
- Sample size: [N]
- Variants tested: [A, B, C, D]
- Evaluation criteria: [metrics]

## Results

### Variant A: [Name]
- Metric 1: [value]
- Metric 2: [value]

### Variant B: [Name]
- Metric 1: [value]
- Metric 2: [value]

## Winner
**Variant [X]** performed best with:
- [Key metric]: [value] (+X% improvement)
- [Reasoning]

## Recommendations
1. Implement variant [X] in production
2. Further testing needed for [edge cases]
3. Monitor [metrics] after deployment
```

## Execution

### Run the Experiment

```bash
# Step 1: Fetch data
bun run fetch
# Creates: data/input.json

# Step 2: Run experiment
bun run run
# Creates: data/results.json

# Step 3: Analyze results
bun run analyze
# Creates: ANALYSIS.md
```

### Manual Steps (If Needed)

Some experiments require manual LLM interaction via Claude Code:

```typescript
// In run_experiment.ts
console.log(`\n=== Process this item ===`)
console.log(`Variant: ${variant.name}`)
console.log(`Prompt:\n${filledPrompt}`)
console.log(`\n[Claude Code: Generate output and save to results.json]`)

// Pause for manual execution
await new Promise(resolve => setTimeout(resolve, 5000))
```

**Workflow:**
1. Script prints filled prompt
2. You copy prompt to Claude Code
3. Claude generates output
4. You paste output into `results.json`
5. Script continues to next item

### Iterative Refinement

**Start small:**
- Test with 5 items per variant first
- Verify results structure is correct
- Check for errors or edge cases

**Scale up:**
- Once validated, process full dataset (20-30 items)
- Run multiple times to check consistency
- Document any anomalies

## Security Checklist

Before running your experiment:

- [ ] Credentials in `.env` (not hardcoded in source files)
- [ ] `.env` added to `.gitignore` (already done in template)
- [ ] No sensitive data in `data/input.json` (or add to `.gitignore`)
- [ ] Service role keys only for backend operations
- [ ] Document required permissions in README
- [ ] Plan to rotate/revoke temporary credentials after experiment

## Integration (If Applicable)

If your experiment produces a winning variant for production:

1. **Document integration path** in `INTEGRATION.md`:
   ```markdown
   # Integration Guide

   ## Winning Variant
   [Name and description]

   ## Files to Modify
   - `/path/to/file.ts` - Update prompt/logic on line X

   ## Changes Required
   [Code diff or description]

   ## Testing
   [How to verify integration works]
   ```

2. **Update production code**:
   - Apply winning variant to production files
   - Add tests if applicable
   - Document changes in commit message

3. **Monitor production**:
   - Track metrics after deployment
   - Compare to experiment results
   - Iterate if needed

## Tips & Best Practices

### Data Collection
- ✅ **Diversity**: Sample across different types/categories
- ✅ **Size**: Start with 20-30 items, scale if needed
- ✅ **Quality**: Filter out null/empty/invalid data
- ❌ **Avoid bias**: Don't cherry-pick items that favor one variant

### Variant Design
- ✅ **Clear differences**: Each variant should test a distinct hypothesis
- ✅ **Controlled changes**: Change one thing at a time when possible
- ✅ **Reproducibility**: Use consistent formatting and structure
- ❌ **Avoid too many variants**: 3-4 is optimal (more = harder to analyze)

### Analysis
- ✅ **Multiple metrics**: Don't rely on single metric
- ✅ **Qualitative review**: Manually inspect samples for quality
- ✅ **Document surprises**: Note unexpected findings
- ❌ **Avoid p-hacking**: Don't cherry-pick metrics that favor preferred variant

### Documentation
- ✅ **Write as you go**: Don't wait until the end
- ✅ **Include examples**: Show sample inputs/outputs
- ✅ **Explain reasoning**: Why did you choose these variants?
- ✅ **Record failures**: Document what didn't work and why

## Troubleshooting

### "Supabase connection failed"
- Check `.env` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Verify key has required permissions (select, insert, update)
- Test connection with Supabase dashboard

### "No data fetched"
- Check your query filters (date ranges, null checks)
- Verify table/column names are correct
- Print query results to console for debugging

### "Results JSON invalid"
- Validate JSON structure with `jq` or online validator
- Check for trailing commas or missing brackets
- Use `JSON.stringify(results, null, 2)` for pretty formatting

### "Analysis shows no clear winner"
- Re-run experiment with larger sample size
- Check if variants are actually different enough
- Consider additional metrics or qualitative review

## Examples

See these experiments for reference:
- **[tag-optimization](./tag-optimization/)**: Prompt testing with 4 variants
- _(Add your completed experiments here)_

## Next Steps

After completing your experiment:
1. ✅ Document findings in `ANALYSIS.md`
2. ✅ Add experiment to `/experiments/README.md` list
3. ✅ Create integration guide if applicable
4. ✅ Share results with team (if collaborative project)
5. ✅ Archive experiment data (or delete if sensitive)

---

**Questions or improvements?** Open an issue or submit a PR to improve this template!
