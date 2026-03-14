/**
 * Keyword Power Analysis
 *
 * Analyzes which specific words and phrases empirically correlate with
 * high (or low) prompt scores. Generates KEYWORDS.md with 10 sections
 * covering power verbs, grade-level vocabulary, structural features,
 * anti-patterns, co-occurrence bigrams, and an actionable cheat sheet.
 *
 * Uses the same scored dataset from data/results.json — no LLM calls.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { ScoredPrompt } from "./scoring";
import { TIER1_VERBS, TIER2_VERBS, TIER3_WORDS, TIER5_META } from "./scoring";

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_SAMPLE = 5;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "over", "after",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "shall", "can", "need", "must", "it", "its", "this", "that", "these",
  "those", "i", "you", "he", "she", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "our", "their", "what", "which",
  "who", "when", "where", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "if", "then",
  "else", "also", "as", "like", "make", "use", "get", "got", "set",
  "let", "new", "one", "two", "see", "now", "way", "any",
  // Path fragments to filter
  "users", "s3nik", "desktop", "dev", "playground", "src", "lib",
  "documents", "home", "var", "tmp", "etc", "usr", "bin", "opt",
  "node_modules", "dist", "build", "out", "public", "assets",
]);

const TECH_KEYWORDS = [
  "typescript", "javascript", "swift", "python", "rust", "go", "dart",
  "flutter", "react", "nextjs", "vue", "angular", "svelte",
  "api", "rest", "graphql", "websocket", "grpc",
  "css", "html", "tailwind", "scss",
  "sql", "postgres", "mongodb", "redis", "sqlite",
  "docker", "kubernetes", "aws", "vercel", "firebase",
  "git", "npm", "bun", "webpack", "vite",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, "")).filter(w => w.length > 1);
}

function assignGradeFromAvg(score: number): string {
  if (score >= 78) return "A+";
  if (score >= 72) return "A";
  if (score >= 66) return "A-";
  if (score >= 60) return "B+";
  if (score >= 55) return "B";
  if (score >= 50) return "B-";
  if (score >= 47) return "C+";
  if (score >= 44) return "C";
  if (score >= 41) return "C-";
  if (score >= 38) return "D+";
  if (score >= 35) return "D";
  if (score >= 30) return "D-";
  return "F";
}

// ─── Section 1: Power Verbs Ranked ──────────────────────────────────────────

function section1_PowerVerbs(prompts: ScoredPrompt[], overallAvg: number) {
  const allVerbs = [...TIER1_VERBS, ...TIER2_VERBS];
  const rankings: { verb: string; tier: number; count: number; avgScore: number; lift: number }[] = [];

  for (const verb of allVerbs) {
    const tier = TIER1_VERBS.has(verb) ? 1 : 2;
    const matching = prompts.filter(p => {
      const words = tokenize(p.text);
      return words.includes(verb);
    });
    if (matching.length < MIN_SAMPLE) continue;

    const verbAvg = avg(matching.map(p => p.composite));
    rankings.push({ verb, tier, count: matching.length, avgScore: verbAvg, lift: verbAvg - overallAvg });
  }

  rankings.sort((a, b) => b.lift - a.lift);

  let md = `## 1. Power Verbs Ranked\n\n`;
  md += `Verbs appearing in ${MIN_SAMPLE}+ prompts, ranked by score lift vs overall average (${overallAvg.toFixed(1)}).\n\n`;
  md += `| Rank | Verb | Tier | Count | Avg Score | Lift |\n`;
  md += `|------|------|------|-------|-----------|------|\n`;
  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const liftStr = r.lift >= 0 ? `+${r.lift.toFixed(1)}` : r.lift.toFixed(1);
    md += `| ${i + 1} | **${r.verb}** | T${r.tier} | ${r.count} | ${r.avgScore.toFixed(1)} | ${liftStr} |\n`;
  }
  md += "\n";

  return { md, rankings };
}

// ─── Section 2: Grade-Level Vocabulary ──────────────────────────────────────

function section2_GradeVocabulary(prompts: ScoredPrompt[]) {
  const highGrade = prompts.filter(p => p.grade === "A+" || p.grade === "A");
  const lowGrade = prompts.filter(p => p.grade === "D" || p.grade === "D-" || p.grade === "F");

  // Word doc-frequency in each group
  const highDf = new Map<string, number>();
  const lowDf = new Map<string, number>();

  for (const p of highGrade) {
    const unique = new Set(tokenize(p.text).filter(w => !STOPWORDS.has(w)));
    for (const w of unique) highDf.set(w, (highDf.get(w) || 0) + 1);
  }
  for (const p of lowGrade) {
    const unique = new Set(tokenize(p.text).filter(w => !STOPWORDS.has(w)));
    for (const w of unique) lowDf.set(w, (lowDf.get(w) || 0) + 1);
  }

  // Overrepresentation ratio: (df_high / |high|) / (df_low / |low| + smoothing)
  const smoothing = 0.5;
  const powerWords: { word: string; highCount: number; lowCount: number; ratio: number }[] = [];
  const weakWords: { word: string; highCount: number; lowCount: number; ratio: number }[] = [];

  for (const [word, hc] of highDf) {
    if (hc < MIN_SAMPLE) continue;
    const lc = lowDf.get(word) || 0;
    const ratio = (hc / highGrade.length) / ((lc + smoothing) / lowGrade.length);
    powerWords.push({ word, highCount: hc, lowCount: lc, ratio });
  }

  for (const [word, lc] of lowDf) {
    if (lc < MIN_SAMPLE) continue;
    const hc = highDf.get(word) || 0;
    const ratio = (lc / lowGrade.length) / ((hc + smoothing) / highGrade.length);
    weakWords.push({ word, highCount: hc, lowCount: lc, ratio });
  }

  powerWords.sort((a, b) => b.ratio - a.ratio);
  weakWords.sort((a, b) => b.ratio - a.ratio);

  let md = `---\n\n## 2. Grade-Level Vocabulary\n\n`;
  md += `TF-IDF-like analysis: word frequency in A+/A prompts (n=${highGrade.length}) vs D/F prompts (n=${lowGrade.length}).\n\n`;

  md += `### Power Words (overrepresented in A+/A)\n\n`;
  md += `| Rank | Word | A+/A Count | D/F Count | Overrep Ratio |\n`;
  md += `|------|------|-----------|-----------|---------------|\n`;
  for (let i = 0; i < Math.min(20, powerWords.length); i++) {
    const w = powerWords[i];
    md += `| ${i + 1} | **${w.word}** | ${w.highCount} | ${w.lowCount} | ${w.ratio.toFixed(1)}x |\n`;
  }
  md += "\n";

  md += `### Weakness Signals (overrepresented in D/F)\n\n`;
  md += `| Rank | Word | D/F Count | A+/A Count | Overrep Ratio |\n`;
  md += `|------|------|-----------|-----------|---------------|\n`;
  for (let i = 0; i < Math.min(15, weakWords.length); i++) {
    const w = weakWords[i];
    md += `| ${i + 1} | **${w.word}** | ${w.lowCount} | ${w.highCount} | ${w.ratio.toFixed(1)}x |\n`;
  }
  md += "\n";

  return { md };
}

// ─── Section 3: First-Word Impact ───────────────────────────────────────────

function section3_FirstWordImpact(prompts: ScoredPrompt[], overallAvg: number) {
  const byFirstWord = new Map<string, number[]>();

  for (const p of prompts) {
    const firstWord = p.text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
    if (!firstWord || firstWord.length < 2) continue;
    if (!byFirstWord.has(firstWord)) byFirstWord.set(firstWord, []);
    byFirstWord.get(firstWord)!.push(p.composite);
  }

  const rankings: { word: string; count: number; avgScore: number; lift: number }[] = [];
  for (const [word, scores] of byFirstWord) {
    if (scores.length < MIN_SAMPLE) continue;
    const wordAvg = avg(scores);
    rankings.push({ word, count: scores.length, avgScore: wordAvg, lift: wordAvg - overallAvg });
  }

  rankings.sort((a, b) => b.lift - a.lift);

  let md = `---\n\n## 3. First-Word Impact\n\n`;
  md += `How the opening word of a prompt correlates with score (${MIN_SAMPLE}+ occurrences).\n\n`;
  md += `| Rank | First Word | Count | Avg Score | Lift |\n`;
  md += `|------|-----------|-------|-----------|------|\n`;
  for (let i = 0; i < Math.min(25, rankings.length); i++) {
    const r = rankings[i];
    const liftStr = r.lift >= 0 ? `+${r.lift.toFixed(1)}` : r.lift.toFixed(1);
    md += `| ${i + 1} | **${r.word}** | ${r.count} | ${r.avgScore.toFixed(1)} | ${liftStr} |\n`;
  }
  md += "\n";

  return { md, rankings };
}

// ─── Section 4: Structural Feature Impact ───────────────────────────────────

function section4_StructuralFeatures(prompts: ScoredPrompt[], overallAvg: number) {
  const features: { name: string; getter: (p: ScoredPrompt) => boolean }[] = [
    { name: "Has file path", getter: p => p.features.hasFilePath },
    { name: "Has code block", getter: p => p.features.hasCodeBlock },
    { name: "Has line reference", getter: p => p.features.hasLineRef },
    { name: "Has numbered list", getter: p => p.features.hasNumberedList },
    { name: "Has bullet list", getter: p => p.features.hasBulletList },
    { name: "Has pasted content", getter: p => p.features.hasPastedContent },
    { name: "Starts with verb", getter: p => p.features.startsWithVerb },
    { name: "Has file reference", getter: p => p.features.hasFileRef },
    { name: "Is question", getter: p => p.features.isQuestion },
  ];

  const rankings: { name: string; withCount: number; withAvg: number; withoutAvg: number; lift: number }[] = [];

  for (const f of features) {
    const withFeature = prompts.filter(p => f.getter(p));
    const withoutFeature = prompts.filter(p => !f.getter(p));
    if (withFeature.length < MIN_SAMPLE || withoutFeature.length < MIN_SAMPLE) continue;

    const withAvg = avg(withFeature.map(p => p.composite));
    const withoutAvg = avg(withoutFeature.map(p => p.composite));
    rankings.push({
      name: f.name,
      withCount: withFeature.length,
      withAvg,
      withoutAvg,
      lift: withAvg - withoutAvg,
    });
  }

  rankings.sort((a, b) => b.lift - a.lift);

  let md = `---\n\n## 4. Structural Feature Impact\n\n`;
  md += `Score difference when a structural feature is present vs absent.\n\n`;
  md += `| Feature | With (n) | Avg With | Avg Without | Lift |\n`;
  md += `|---------|----------|----------|-------------|------|\n`;
  for (const r of rankings) {
    const liftStr = r.lift >= 0 ? `+${r.lift.toFixed(1)}` : r.lift.toFixed(1);
    md += `| ${r.name} | ${r.withCount} | ${r.withAvg.toFixed(1)} | ${r.withoutAvg.toFixed(1)} | ${liftStr} |\n`;
  }
  md += "\n";

  // Word count sweet spot
  const buckets = [
    { label: "1-5", min: 1, max: 5 },
    { label: "6-15", min: 6, max: 15 },
    { label: "16-30", min: 16, max: 30 },
    { label: "31-60", min: 31, max: 60 },
    { label: "61-100", min: 61, max: 100 },
    { label: "101-200", min: 101, max: 200 },
    { label: "201-500", min: 201, max: 500 },
    { label: "500+", min: 501, max: Infinity },
  ];

  md += `### Word Count Sweet Spot\n\n`;
  md += `| Word Count | Prompts | Avg Score | Grade |\n`;
  md += `|-----------|---------|-----------|-------|\n`;
  for (const b of buckets) {
    const group = prompts.filter(p => p.features.wordCount >= b.min && p.features.wordCount <= b.max);
    if (group.length < MIN_SAMPLE) continue;
    const groupAvg = avg(group.map(p => p.composite));
    md += `| ${b.label} | ${group.length} | ${groupAvg.toFixed(1)} | ${assignGradeFromAvg(groupAvg)} |\n`;
  }
  md += "\n";

  return { md, rankings };
}

// ─── Section 5: Anti-Pattern Keywords ───────────────────────────────────────

function section5_AntiPatternKeywords(prompts: ScoredPrompt[], overallAvg: number) {
  const dangerPhrases: { pattern: RegExp; label: string }[] = [
    { pattern: /^(can you|could you)/i, label: "can you / could you" },
    { pattern: /^please\b/i, label: "please (opener)" },
    { pattern: /^hey\b/i, label: "hey (opener)" },
    { pattern: /^help me\b/i, label: "help me (opener)" },
    { pattern: /^(would you|I need you to)\b/i, label: "would you / I need you to" },
    { pattern: /still\s+(not|have|having|getting|seeing)/i, label: "still not working" },
    { pattern: /doesn'?t\s+work/i, label: "doesn't work" },
    { pattern: /isn'?t\s+working/i, label: "isn't working" },
    { pattern: /what'?s?\s+taking\s+so\s+long/i, label: "what's taking so long" },
    { pattern: /you'?re?\s+stuck/i, label: "you're stuck" },
    { pattern: /wrong again/i, label: "wrong again" },
    { pattern: /^(yes|ok|sure|yep|continue|proceed|go ahead)$/i, label: "terse confirmation" },
    { pattern: /^(do it|let'?s?\s+(do|go))$/i, label: "do it / let's go" },
    { pattern: /as I (said|mentioned)/i, label: "as I said/mentioned" },
    { pattern: /I told you/i, label: "I told you" },
  ];

  const results: { label: string; count: number; avgScore: number; damage: number }[] = [];

  for (const dp of dangerPhrases) {
    const matching = prompts.filter(p => dp.pattern.test(p.text.trim()));
    if (matching.length < MIN_SAMPLE) continue;
    const matchAvg = avg(matching.map(p => p.composite));
    results.push({ label: dp.label, count: matching.length, avgScore: matchAvg, damage: matchAvg - overallAvg });
  }

  results.sort((a, b) => a.damage - b.damage);

  let md = `---\n\n## 5. Anti-Pattern Keywords\n\n`;
  md += `Phrases that correlate with lower scores, ranked by score damage.\n\n`;
  md += `| Rank | Phrase | Count | Avg Score | Damage |\n`;
  md += `|------|--------|-------|-----------|--------|\n`;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    md += `| ${i + 1} | "${r.label}" | ${r.count} | ${r.avgScore.toFixed(1)} | ${r.damage.toFixed(1)} |\n`;
  }
  md += "\n";

  return { md };
}

// ─── Section 6: Keyword Density Sweet Spot ──────────────────────────────────

function section6_KeywordDensity(prompts: ScoredPrompt[]) {
  // Count tier 1+2 verbs per prompt
  const densityData: { count: number; scores: number[] }[] = [];

  for (const p of prompts) {
    const words = tokenize(p.text);
    let verbCount = 0;
    for (const w of words) {
      if (TIER1_VERBS.has(w) || TIER2_VERBS.has(w)) verbCount++;
    }
    while (densityData.length <= verbCount) densityData.push({ count: densityData.length, scores: [] });
    densityData[verbCount].scores.push(p.composite);
  }

  let md = `---\n\n## 6. Keyword Density Sweet Spot\n\n`;
  md += `How many action verbs (Tier 1 + Tier 2) per prompt correlates with score.\n\n`;
  md += `\`\`\`\n`;
  md += `  Verb Count | Avg Score | n\n`;
  md += `  -----------+-----------+-----\n`;

  const maxScore = Math.max(...densityData.filter(d => d.scores.length >= MIN_SAMPLE).map(d => avg(d.scores)));

  for (const d of densityData) {
    if (d.scores.length < MIN_SAMPLE) continue;
    const dAvg = avg(d.scores);
    const barLen = Math.round((dAvg / maxScore) * 30);
    const bar = "\u2588".repeat(barLen);
    md += `  ${String(d.count).padStart(10)} | ${bar} ${dAvg.toFixed(1)} | ${d.scores.length}\n`;
  }
  md += `\`\`\`\n\n`;

  return { md };
}

// ─── Section 7: Meta-Instruction Impact ─────────────────────────────────────

function section7_MetaInstructions(prompts: ScoredPrompt[], overallAvg: number) {
  const patternLabels = [
    "chain-of-thought", "category theory", "first principles", "curry-howard",
    "functor", "morphism", "isomorphism", "think step-by-step",
    "model via", "natural transformation", "commutative diagram", "infer deeply",
  ];

  const results: { label: string; count: number; avgScore: number; lift: number }[] = [];

  for (let i = 0; i < TIER5_META.length; i++) {
    const matching = prompts.filter(p => TIER5_META[i].test(p.text));
    if (matching.length < MIN_SAMPLE) continue;
    const matchAvg = avg(matching.map(p => p.composite));
    results.push({ label: patternLabels[i], count: matching.length, avgScore: matchAvg, lift: matchAvg - overallAvg });
  }

  results.sort((a, b) => b.lift - a.lift);

  let md = `---\n\n## 7. Meta-Instruction Impact\n\n`;
  md += `Individual meta-instruction pattern performance (${MIN_SAMPLE}+ occurrences).\n\n`;

  if (results.length === 0) {
    md += `*No meta-instruction patterns appeared in ${MIN_SAMPLE}+ prompts.*\n\n`;
  } else {
    md += `| Pattern | Count | Avg Score | Lift |\n`;
    md += `|---------|-------|-----------|------|\n`;
    for (const r of results) {
      const liftStr = r.lift >= 0 ? `+${r.lift.toFixed(1)}` : r.lift.toFixed(1);
      md += `| ${r.label} | ${r.count} | ${r.avgScore.toFixed(1)} | ${liftStr} |\n`;
    }
    md += "\n";
  }

  // Meta count vs score
  const metaCounts: Map<number, number[]> = new Map();
  for (const p of prompts) {
    let count = 0;
    for (const pattern of TIER5_META) {
      if (pattern.test(p.text)) count++;
    }
    if (!metaCounts.has(count)) metaCounts.set(count, []);
    metaCounts.get(count)!.push(p.composite);
  }

  md += `### Meta-Instruction Count vs Score\n\n`;
  md += `| Meta Count | Prompts | Avg Score | Grade |\n`;
  md += `|-----------|---------|-----------|-------|\n`;
  for (const [count, scores] of [...metaCounts.entries()].sort((a, b) => a[0] - b[0])) {
    if (scores.length < MIN_SAMPLE) continue;
    const countAvg = avg(scores);
    md += `| ${count} | ${scores.length} | ${countAvg.toFixed(1)} | ${assignGradeFromAvg(countAvg)} |\n`;
  }
  md += "\n";

  return { md };
}

// ─── Section 8: Technology Keywords ─────────────────────────────────────────

function section8_TechKeywords(prompts: ScoredPrompt[], overallAvg: number) {
  const rankings: { keyword: string; count: number; avgScore: number; lift: number }[] = [];

  for (const kw of TECH_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    const matching = prompts.filter(p => regex.test(p.text));
    if (matching.length < MIN_SAMPLE) continue;

    const kwAvg = avg(matching.map(p => p.composite));
    rankings.push({ keyword: kw, count: matching.length, avgScore: kwAvg, lift: kwAvg - overallAvg });
  }

  rankings.sort((a, b) => b.lift - a.lift);

  let md = `---\n\n## 8. Technology Keywords\n\n`;
  md += `Tech terms by domain quality — how prompts mentioning each technology score.\n\n`;
  md += `| Rank | Technology | Count | Avg Score | Lift |\n`;
  md += `|------|-----------|-------|-----------|------|\n`;
  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const liftStr = r.lift >= 0 ? `+${r.lift.toFixed(1)}` : r.lift.toFixed(1);
    md += `| ${i + 1} | **${r.keyword}** | ${r.count} | ${r.avgScore.toFixed(1)} | ${liftStr} |\n`;
  }
  md += "\n";

  return { md, rankings };
}

// ─── Section 9: Co-occurrence Winners ───────────────────────────────────────

function section9_Cooccurrence(prompts: ScoredPrompt[]) {
  const sorted = [...prompts].sort((a, b) => b.composite - a.composite);
  const top10pct = sorted.slice(0, Math.ceil(sorted.length * 0.1));
  const bottom10pct = sorted.slice(-Math.ceil(sorted.length * 0.1));

  function extractBigrams(group: ScoredPrompt[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const p of group) {
      const words = tokenize(p.text).filter(w => !STOPWORDS.has(w) && w.length > 2);
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        counts.set(bigram, (counts.get(bigram) || 0) + 1);
      }
    }
    return counts;
  }

  const topBigrams = extractBigrams(top10pct);
  const bottomBigrams = extractBigrams(bottom10pct);
  const smoothing = 0.5;

  // Winning bigrams: overrepresented in top 10%
  const winners: { bigram: string; topCount: number; bottomCount: number; ratio: number }[] = [];
  for (const [bigram, tc] of topBigrams) {
    if (tc < 3) continue;
    const bc = bottomBigrams.get(bigram) || 0;
    const ratio = (tc / top10pct.length) / ((bc + smoothing) / bottom10pct.length);
    winners.push({ bigram, topCount: tc, bottomCount: bc, ratio });
  }
  winners.sort((a, b) => b.ratio - a.ratio);

  // Losing bigrams: overrepresented in bottom 10%
  const losers: { bigram: string; topCount: number; bottomCount: number; ratio: number }[] = [];
  for (const [bigram, bc] of bottomBigrams) {
    if (bc < 3) continue;
    const tc = topBigrams.get(bigram) || 0;
    const ratio = (bc / bottom10pct.length) / ((tc + smoothing) / top10pct.length);
    losers.push({ bigram, topCount: tc, bottomCount: bc, ratio });
  }
  losers.sort((a, b) => b.ratio - a.ratio);

  let md = `---\n\n## 9. Co-occurrence Winners\n\n`;
  md += `Bigrams overrepresented in top 10% (n=${top10pct.length}) vs bottom 10% (n=${bottom10pct.length}) prompts.\n\n`;

  md += `### Winning Bigrams (top 10%)\n\n`;
  md += `| Rank | Bigram | Top 10% | Bottom 10% | Overrep |\n`;
  md += `|------|--------|---------|------------|--------|\n`;
  for (let i = 0; i < Math.min(20, winners.length); i++) {
    const w = winners[i];
    md += `| ${i + 1} | "${w.bigram}" | ${w.topCount} | ${w.bottomCount} | ${w.ratio.toFixed(1)}x |\n`;
  }
  md += "\n";

  md += `### Losing Bigrams (bottom 10%)\n\n`;
  md += `| Rank | Bigram | Bottom 10% | Top 10% | Overrep |\n`;
  md += `|------|--------|------------|---------|--------|\n`;
  for (let i = 0; i < Math.min(10, losers.length); i++) {
    const l = losers[i];
    md += `| ${i + 1} | "${l.bigram}" | ${l.bottomCount} | ${l.topCount} | ${l.ratio.toFixed(1)}x |\n`;
  }
  md += "\n";

  return { md };
}

// ─── Section 10: Cheat Sheet ────────────────────────────────────────────────

function section10_CheatSheet(
  verbRankings: { verb: string; lift: number }[],
  firstWordRankings: { word: string; lift: number; count: number }[],
  featureRankings: { name: string; lift: number }[],
  techRankings: { keyword: string; lift: number }[],
) {
  let md = `---\n\n## 10. Keyword Cheat Sheet\n\n`;
  md += `Actionable summary synthesized from all sections above.\n\n`;

  // Always use (top 10 positive-lift verbs)
  const topVerbs = verbRankings.filter(v => v.lift > 0).slice(0, 10);
  md += `### Always Use These Verbs\n\n`;
  if (topVerbs.length > 0) {
    md += topVerbs.map(v => `\`${v.verb}\` (+${v.lift.toFixed(1)})`).join(", ") + "\n\n";
  }

  // Best openers
  const bestOpeners = firstWordRankings.filter(w => w.lift > 0 && w.count >= 10 && !STOPWORDS.has(w.word) && w.word.length < 15).slice(0, 8);
  md += `### Best Opening Words\n\n`;
  if (bestOpeners.length > 0) {
    md += bestOpeners.map(w => `\`${w.word}\` (+${w.lift.toFixed(1)})`).join(", ") + "\n\n";
  }

  // Worst openers
  const worstOpeners = firstWordRankings.filter(w => w.lift < -2).slice(-8).reverse();
  md += `### Never Start With\n\n`;
  if (worstOpeners.length > 0) {
    md += worstOpeners.map(w => `\`${w.word}\` (${w.lift.toFixed(1)})`).join(", ") + "\n\n";
  }

  // Structural must-haves
  const posFeatures = featureRankings.filter(f => f.lift > 0);
  md += `### Structural Must-Haves\n\n`;
  if (posFeatures.length > 0) {
    for (const f of posFeatures) {
      md += `- **${f.name}** (+${f.lift.toFixed(1)} lift)\n`;
    }
    md += "\n";
  }

  // Tech domains that score well
  const topTech = techRankings.filter(t => t.lift > 0).slice(0, 5);
  if (topTech.length > 0) {
    md += `### Highest-Scoring Tech Domains\n\n`;
    md += topTech.map(t => `\`${t.keyword}\` (+${t.lift.toFixed(1)})`).join(", ") + "\n\n";
  }

  // Quick formula
  md += `### Quick Formula\n\n`;
  md += `\`\`\`\n`;
  md += `[Action Verb] + [specific file/component] + [what to change] + [expected outcome]\n`;
  md += `\n`;
  md += `Example:\n`;
  md += `  "Fix the null pointer in src/auth/login.ts:42 — getUser() returns\n`;
  md += `   undefined when token is expired. Should redirect to /login instead."\n`;
  md += `\`\`\`\n\n`;

  md += `### Optimal Prompt Structure\n\n`;
  md += `1. **Start** with a Tier 1 action verb (fix, implement, add, create, update)\n`;
  md += `2. **Name** the file path and function/component\n`;
  md += `3. **Describe** expected vs actual behavior\n`;
  md += `4. **Include** error output or code block if debugging\n`;
  md += `5. **Use** numbered steps for multi-part requests\n`;
  md += `6. **Keep** to 15-100 words (sweet spot range)\n`;
  md += `7. **End** sessions with "commit" or "run tests"\n\n`;

  return { md };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const inputPath = resolve(import.meta.dir, "..", "data", "results.json");
  console.log(`Reading ${inputPath}...`);

  const prompts: ScoredPrompt[] = JSON.parse(readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${prompts.length} scored prompts`);

  const overallAvg = avg(prompts.map(p => p.composite));
  console.log(`Overall average composite: ${overallAvg.toFixed(1)}`);

  // Generate all sections
  const s1 = section1_PowerVerbs(prompts, overallAvg);
  const s2 = section2_GradeVocabulary(prompts);
  const s3 = section3_FirstWordImpact(prompts, overallAvg);
  const s4 = section4_StructuralFeatures(prompts, overallAvg);
  const s5 = section5_AntiPatternKeywords(prompts, overallAvg);
  const s6 = section6_KeywordDensity(prompts);
  const s7 = section7_MetaInstructions(prompts, overallAvg);
  const s8 = section8_TechKeywords(prompts, overallAvg);
  const s9 = section9_Cooccurrence(prompts);
  const s10 = section10_CheatSheet(
    s1.rankings,
    s3.rankings,
    s4.rankings,
    s8.rankings,
  );

  // Assemble report
  let report = `# Keyword Power Analysis\n\n`;
  report += `> Generated ${new Date().toISOString().split("T")[0]} — Empirical keyword-level analysis of ${prompts.length.toLocaleString()} scored prompts\n`;
  report += `> Overall average composite: ${overallAvg.toFixed(1)} (${assignGradeFromAvg(overallAvg)})\n\n`;
  report += `---\n\n`;

  report += s1.md;
  report += s2.md;
  report += s3.md;
  report += s4.md;
  report += s5.md;
  report += s6.md;
  report += s7.md;
  report += s8.md;
  report += s9.md;
  report += s10.md;

  // Footer
  report += `---\n\n`;
  report += `*Generated by keyword_analysis.ts — ${new Date().toISOString()}*\n`;
  report += `*Heuristic analysis only — no LLM API calls were made*\n`;

  const outPath = resolve(import.meta.dir, "..", "KEYWORDS.md");
  writeFileSync(outPath, report);

  console.log(`\nReport written to ${outPath}`);
  console.log(`  Sections: 10`);
  console.log(`  Length: ${report.length.toLocaleString()} chars, ${report.split("\n").length} lines`);
}

main();
