# Autoresearch Experiments - Quick Start

**Ready to create your first experiment?** This takes < 15 minutes.

## What You Have Now

✅ **Complete Framework**: Documentation, templates, and examples
✅ **Security Built-In**: No hardcoded credentials, .env pattern established
✅ **Working Example**: Tag-optimization experiment in mymind-clone-web
✅ **Clear Guides**: Step-by-step instructions and best practices

## Creating Your First Experiment

### 1. Copy the Template (1 minute)

```bash
# Copy template with your experiment name
cp -r experiments/_template experiments/my-first-experiment
cd experiments/my-first-experiment
```

### 2. Configure Environment (2 minutes)

```bash
# Create .env from example
cp .env.example .env

# Edit .env and add your credentials
# For Supabase: add SUPABASE_URL and SUPABASE_SERVICE_KEY
nano .env  # or use your preferred editor

# Install dependencies
bun install
```

### 3. Customize for Your Use Case (5-10 minutes)

**A. Define what you're testing** (`src/variants.ts`):
```typescript
export const variants = [
  {
    name: 'baseline',
    description: 'Current approach',
    prompt: 'Your current prompt...',
  },
  {
    name: 'improved',
    description: 'Improved approach',
    prompt: 'Your new prompt...',
  },
]
```

**B. Configure data fetching** (`src/fetch_data.ts`):
```typescript
// Customize the Supabase query
const { data } = await supabase
  .from('your_table')    // Change table
  .select('your_columns') // Change columns
  .limit(30)             // Change sample size
```

**C. Define analysis metrics** (`src/analyze_results.ts`):
```typescript
// Add metrics specific to your experiment
function calculateQuality(results) {
  // Your custom analysis logic
}
```

### 4. Run the Experiment (30-60 minutes)

```bash
# Step 1: Fetch test data
bun run fetch
# Creates: data/input.json

# Step 2: Run experiment
bun run run
# Creates: data/results.json
# Note: May require manual steps (e.g., Claude Code for LLM calls)

# Step 3: Analyze results
bun run analyze
# Creates: ANALYSIS.md
```

### 5. Document Findings (10 minutes)

Review `ANALYSIS.md` and:
- Identify the winning variant
- Document key findings
- Create integration guide if applicable

## Need More Help?

📖 **Read the Guides**:
- **Overview**: `/experiments/README.md` - Understand the pattern
- **Step-by-Step**: `/experiments/CREATING_EXPERIMENTS.md` - Detailed instructions
- **Example**: `/experiments/tag-optimization/` (in mymind-clone-web) - Working experiment

🔍 **Key Concepts**:
- **Self-Contained**: Each experiment is a complete Bun project
- **Three Phases**: Fetch data → Run experiment → Analyze results
- **Secure by Default**: Uses .env for credentials (never hardcoded)
- **Reproducible**: Anyone can re-run with same inputs

🛡️ **Security Checklist**:
- [ ] Credentials in `.env` (not hardcoded)
- [ ] `.env` is gitignored (don't commit!)
- [ ] Service role keys only for backend
- [ ] Document required permissions in README

## Example Use Cases

**Good for experiments:**
- ✅ A/B testing prompts (4 variants)
- ✅ Parameter tuning (temperature, max tokens)
- ✅ Feature evaluation (before production)
- ✅ Data analysis and insights

**Not suitable:**
- ❌ Quick one-off tests (use console instead)
- ❌ Production debugging (use logging/monitoring)
- ❌ Simple data queries (use Supabase dashboard)

## Template Structure

```
my-experiment/
├── src/
│   ├── fetch_data.ts       # Customize: data source
│   ├── variants.ts         # Customize: your variants
│   ├── run_experiment.ts   # Customize: processing logic
│   └── analyze_results.ts  # Customize: metrics
├── data/                   # Generated (gitignored)
│   ├── input.json          # Fetched test data
│   └── results.json        # Experiment results
├── package.json            # Bun config (3 scripts)
├── .env                    # Your credentials (gitignored)
├── .env.example            # Template for credentials
├── .gitignore              # Security exclusions
├── README.md               # Experiment documentation
└── ANALYSIS.md             # Generated findings
```

## Real Example: Tag Optimization

The tag-optimization experiment (in mymind-clone-web) is a complete working example:

**What it tested**: 4 prompt variants for AI-generated tags
**Dataset**: 23 diverse cards from production
**Winner**: Platform-aware prompting (+29% improvement)
**Integration**: New prompts deployed to production

**Location**: `/Users/s3nik/Desktop/mymind-clone-web/experiments/tag-optimization/`

**Key files**:
- `prompts.ts` - 4 prompt variant definitions
- `ANALYSIS.md` - Experiment findings and comparison
- `INTEGRATION_COMPLETE.md` - How results were applied

## Tips for Success

1. **Start Small**: Test with 5 items per variant first
2. **Document as You Go**: Don't wait until the end
3. **Use Multiple Metrics**: Don't rely on a single number
4. **Manual Review**: Inspect samples for quality
5. **Iterate**: Refine variants based on initial results

## Quick Comparison: Before vs After

**Before (no template):**
- ❌ Hardcoded credentials in source files
- ❌ No consistent structure
- ❌ Hard to reproduce
- ❌ No documentation pattern
- ⏱️ 1-2 hours setup time

**After (with template):**
- ✅ Environment variables for credentials
- ✅ Standardized three-phase workflow
- ✅ Anyone can reproduce
- ✅ Built-in documentation
- ⏱️ < 15 minutes setup time

## Next Steps

1. **Try the template** - Create a simple experiment
2. **Review tag-optimization** - See a complete example
3. **Create your own** - Test something in your project
4. **Share findings** - Document in ANALYSIS.md
5. **Iterate** - Improve based on learnings

---

**Questions?** See `/experiments/CREATING_EXPERIMENTS.md` for detailed instructions.

**Ready to start?** Copy the template and customize for your use case! 🚀
