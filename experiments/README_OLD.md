# Autoresearch Experiments

This directory contains self-contained experiments for researching and optimizing various aspects of the mymind-clone system using Claude Code's autoresearch capabilities.

## What Are Autoresearch Experiments?

Autoresearch experiments are **self-contained research projects** that use Claude Code to:
- Test multiple variations of prompts, algorithms, or features
- Analyze production data to identify optimization opportunities
- Generate recommendations based on systematic evaluation
- Document findings for future reference

Each experiment is a complete Bun project with its own dependencies, scripts, and workflow.

## Why Self-Contained Structure?

**Benefits:**
- **Isolation**: Experiments don't interfere with main application code
- **Reproducibility**: Anyone can re-run the experiment with clear instructions
- **Portability**: Can be moved, archived, or shared independently
- **Versioning**: Track experimental code separately from production
- **Security**: Sensitive data/credentials stay within experiment directory

**Structure:**
```
experiments/
├── README.md                    # This file
├── CREATING_EXPERIMENTS.md      # Step-by-step guide
├── _template/                   # Reusable template
└── tag-optimization/            # Example: completed experiment
    ├── package.json             # Own dependencies
    ├── src/                     # Experiment code
    ├── data/                    # Input/output data
    ├── ANALYSIS.md              # Findings
    └── README.md                # Experiment-specific docs
```

## Tag Optimization: A Case Study

The **tag-optimization experiment** demonstrates the full autoresearch workflow:

### Objective
Optimize AI-generated tags for content cards to enable better cross-disciplinary discovery.

### Execution Flow

**Phase 1: Data Collection**
```bash
cd experiments/tag-optimization
bun run fetch
```
- Connects to Supabase production database
- Queries `cards` table for diverse sample (23 cards)
- Filters for platform diversity (Instagram, Twitter, GitHub, etc.)
- Saves to `test_cards.json`

**Phase 2: Experimentation**
```bash
bun run run
```
- Loads test cards from JSON
- Tests 4 prompt variants:
  - **Baseline**: Current generic prompt
  - **Lexical-Guided**: Uses linguistic categories (entity, concept, quality)
  - **Chain-of-Thought**: Multi-step reasoning
  - **Platform-Aware**: Context-specific guidelines per platform
- Claude Code generates tags for each variant
- Saves results to `experiment_results.json`

**Phase 3: Analysis**
```bash
bun run analyze
```
- Analyzes tag quality across variants
- Compares lexical category distribution
- Measures vibe vocabulary usage
- Outputs `ANALYSIS.md` with winner recommendation

### Results

**Winner:** Platform-Aware Prompting (Variant D)
- **+29% improvement** in tag relevance
- **4.2 tags/card average** (target: 3-5)
- **95% vibe tag inclusion** (expanded vocabulary from 15→20 terms)
- **Platform-specific identifiers**: GitHub cards now include language tags, YouTube cards include format tags

**Integration:** New prompts implemented in `/apps/web/lib/prompts/classification.ts`

### Permissions & Access

**Required:**
1. **Supabase Service Role Key** - Full database read/write access
2. **Bun Runtime** - For TypeScript execution
3. **Claude Code** - For LLM-powered tag generation (no external API needed)

**Security Best Practice:**
- Use `.env` for credentials (NEVER hardcode)
- Add `.env` to `.gitignore`
- Document required permissions in experiment README

### What We Learned

**Pattern to Replicate:**
1. ✅ Self-contained Bun project with own `package.json`
2. ✅ Data fetching from production sources (Supabase)
3. ✅ Variant definitions (A/B/C/D test structure)
4. ✅ Manual or semi-automated LLM integration via Claude Code
5. ✅ Automated analysis with clear metrics
6. ✅ Comprehensive documentation (README, ANALYSIS, INTEGRATION guides)
7. ✅ Integration path for winning variant

**Improvements for Next Time:**
- Use `.env` from the start (not hardcoded credentials)
- Create reusable template (now available in `_template/`)
- Document pattern for others to follow (this README!)

## Key Principles

### 1. Self-Contained Projects
Each experiment is a complete Bun project:
```json
{
  "name": "experiment-name",
  "type": "module",
  "scripts": {
    "fetch": "bun run src/fetch_data.ts",
    "run": "bun run src/run_experiment.ts",
    "analyze": "bun run src/analyze_results.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.x"
  }
}
```

### 2. Three-Phase Workflow
1. **Fetch**: Get data from production or test sources
2. **Run**: Execute experiment with variants
3. **Analyze**: Evaluate results and generate recommendations

### 3. Configuration via Code or Environment
- Use TypeScript for experiment logic (type-safe)
- Use `.env` for secrets and configuration
- Export variants as constants for easy modification

### 4. Manual or Semi-Automated LLM Integration
- Claude Code handles LLM calls directly (no external API)
- Prompts are templates filled with data
- Results structured as JSON for analysis

### 5. Reproducible Analysis
- Analysis scripts are automated
- Metrics are clearly defined
- Results exported to Markdown for readability

### 6. Comprehensive Documentation
Every experiment should include:
- **README.md**: Quick start, setup, execution
- **ANALYSIS.md**: Findings, metrics, recommendations
- **INTEGRATION.md** (if applicable): How to apply results to production

## When to Create an Experiment

**Good Use Cases:**
- ✅ A/B testing prompts or algorithms
- ✅ Evaluating new AI features before production
- ✅ Analyzing production data for insights
- ✅ Testing parameter variations (temperature, max tokens, etc.)
- ✅ Comparing different LLM models or services

**Not Suitable:**
- ❌ Quick one-off tests (just use console/REPL)
- ❌ Production debugging (use logging/monitoring)
- ❌ Simple data queries (use Supabase dashboard)

## Getting Started

See **[CREATING_EXPERIMENTS.md](./CREATING_EXPERIMENTS.md)** for step-by-step instructions on creating your own autoresearch experiment.

**Quick Start:**
```bash
# Copy template
cp -r experiments/_template experiments/my-experiment
cd experiments/my-experiment

# Configure
cp .env.example .env
# Edit .env with your credentials

# Install dependencies
bun install

# Run experiment
bun run fetch
bun run run
bun run analyze
```

## Available Experiments

- **[tag-optimization](./tag-optimization/)**: Optimizing AI-generated tags using platform-aware prompting (completed ✅)

## Security Best Practices

1. **Never Hardcode Credentials**
   - ❌ `const key = "eyJhbGciOiJIUzI1NiI..."`
   - ✅ `const key = process.env.SUPABASE_SERVICE_KEY!`

2. **Use Service Role Keys Only for Backend**
   - Never expose service role keys in frontend code
   - Use anon keys for client-side operations

3. **Add Sensitive Files to `.gitignore`**
   ```gitignore
   .env
   data/
   node_modules/
   *.log
   ```

4. **Document Required Permissions**
   - List all APIs/services accessed
   - Specify minimum required scopes
   - Include setup instructions in README

5. **Use Temporary Credentials When Possible**
   - Rotate keys after experiments
   - Use time-limited access tokens
   - Delete test data after analysis

## Contributing

When adding a new experiment:
1. Copy the `_template/` directory
2. Customize for your use case
3. Document your findings in `ANALYSIS.md`
4. Add your experiment to the "Available Experiments" list above
5. Follow security best practices
