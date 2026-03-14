/**
 * Phase 2: 10-Dimension Scoring Engine
 *
 * Scores every enriched prompt on 10 dimensions using pure heuristic analysis.
 * No LLM calls — fast, free, deterministic.
 *
 * Dimensions:
 *  1. Specificity (20%)     — File refs, line numbers, named identifiers
 *  2. Action Density (15%)  — Ratio of action keywords to filler
 *  3. Context Loading (15%) — Task-specific context vs meta-instruction
 *  4. Iteration Pattern (10%) — Progressive refinement vs repetition
 *  5. Compound Efficiency (10%) — Multiple coherent instructions per prompt
 *  6. Tool Leverage (10%)   — Efficient tool usage triggered
 *  7. Outcome Signal (10%)  — Tangible results produced
 *  8. Temporal Pattern (info) — Performance relative to time-of-day
 *  9. Project Pattern (info)  — Performance relative to project average
 * 10. Anti-patterns (deduction) — Known bad practices
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import type { EnrichedPrompt } from "./fetch_data";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DimensionScores {
  specificity: number;
  actionDensity: number;
  contextLoading: number;
  iterationPattern: number;
  compoundEfficiency: number;
  toolLeverage: number | null;
  outcomeSignal: number | null;
  temporalPattern: number | null; // filled in post-processing
  projectPattern: number | null;  // filled in post-processing
}

interface AntiPatternHit {
  name: string;
  penalty: number;
  detail: string;
}

export interface ScoredPrompt extends EnrichedPrompt {
  scores: DimensionScores;
  antiPatterns: AntiPatternHit[];
  antiPatternPenalty: number;
  composite: number;
  grade: string;
}

// ─── Keyword Tiers ───────────────────────────────────────────────────────────

export const TIER1_VERBS = new Set([
  "fix", "implement", "create", "add", "remove", "replace", "rename", "move",
  "extract", "refactor", "update", "modify", "delete", "merge", "split",
  "configure", "install", "write", "build", "deploy", "revert",
]);

export const TIER2_VERBS = new Set([
  "investigate", "analyze", "identify", "debug", "trace", "diagnose", "find",
  "search", "compare", "verify", "validate", "check", "review", "explain",
  "understand", "examine", "inspect", "profile", "test", "run",
]);

export const TIER3_WORDS = new Set([
  "first", "then", "finally", "next", "after", "before", "step",
  "numbered", "breakdown", "plan", "spec", "propose", "phase",
]);

export const TIER5_META = [
  /chain[- ]of[- ]thought/i,
  /category\s+theory/i,
  /first\s+principles/i,
  /curry[- ]howard/i,
  /functor/i,
  /morphism/i,
  /isomorphism/i,
  /think\s+step[- ]by[- ]step/i,
  /model\s+via/i,
  /natural\s+transformation/i,
  /commutative\s+diagram/i,
  /infer\s+deeply/i,
];

// ─── Dimension 1: Specificity (0-100) ────────────────────────────────────────

function scoreSpecificity(prompt: EnrichedPrompt): number {
  const text = prompt.text;
  let score = 30; // base

  // File path references (strong signal)
  const filePathMatches = text.match(/(?:\/[\w. -]+){2,}/g) || [];
  score += Math.min(filePathMatches.length * 10, 25);

  // File extensions (.ts, .swift, .md, etc.)
  if (/\.\w{1,5}\b/.test(text)) score += 5;

  // Line number references (:42, :438:24)
  if (/:\d{1,5}(?::\d{1,5})?/.test(text)) score += 10;
  if (/line\s+\d+/i.test(text)) score += 8;

  // Named identifiers (camelCase, PascalCase, snake_case)
  const identifiers = text.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g) || [];
  const pascalCase = text.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g) || [];
  const snakeCase = text.match(/\b[a-z]+_[a-z]+(?:_[a-z]+)*\b/g) || [];
  const idCount = identifiers.length + pascalCase.length + snakeCase.length;
  score += Math.min(idCount * 3, 12);

  // Backtick-quoted code/errors
  const backtickCount = (text.match(/`[^`]+`/g) || []).length;
  score += Math.min(backtickCount * 4, 12);

  // Error messages quoted inline
  if (/error|Error|ERROR/.test(text) && text.length > 50) score += 5;

  // Pasted content (evidence of real context)
  if (prompt.features.hasPastedContent) score += 5;

  // Longer prompts with real content tend to be more specific
  if (prompt.features.wordCount >= 20 && prompt.features.wordCount <= 200) score += 5;

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 2: Action Density (0-100) ─────────────────────────────────────

function scoreActionDensity(prompt: EnrichedPrompt): number {
  const words = prompt.text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let tier1Count = 0;
  let tier2Count = 0;
  let tier5Count = 0;

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (TIER1_VERBS.has(clean)) tier1Count++;
    if (TIER2_VERBS.has(clean)) tier2Count++;
  }

  // Count meta-instruction phrases
  for (const pattern of TIER5_META) {
    if (pattern.test(prompt.text)) tier5Count++;
  }

  let score = 30; // base

  // Direct action verbs (Tier 1) — strong signal
  score += Math.min(tier1Count * 8, 25);

  // Investigation verbs (Tier 2)
  score += Math.min(tier2Count * 5, 15);

  // Starts with action verb — direct and clear
  if (prompt.features.startsWithVerb) score += 10;

  // Bonus for reasonable length with action content
  if (tier1Count + tier2Count >= 2 && words.length <= 100) score += 5;

  // Penalty for meta-instruction overload (>3 Tier 5 patterns)
  if (tier5Count > 3) {
    score -= (tier5Count - 3) * 6;
  }

  // Penalty for very long prompts with no action verbs at all
  if (words.length > 80 && tier1Count + tier2Count === 0) {
    score -= 10;
  }

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 3: Context Loading (0-100) ────────────────────────────────────

function scoreContextLoading(prompt: EnrichedPrompt): number {
  const text = prompt.text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let score = 30;

  // File references = task-specific context
  const fileRefs = (text.match(/(?:\/[\w. -]+){2,}/g) || []).length;
  score += Math.min(fileRefs * 7, 20);

  // Inline error messages or code
  if (prompt.features.hasCodeBlock) score += 8;
  if (/error|warning|exception|failed|crash/i.test(text)) score += 5;

  // Pasted content is strong task-specific context
  if (prompt.features.hasPastedContent) score += 8;

  // Expected vs actual behavior
  if (/expect|should|instead|but\s+(?:it|the|I)|actual/i.test(text)) score += 8;

  // Constraints stated
  if (/without|don't|must not|should not|preserve|keep/i.test(text)) score += 5;

  // Reasonable length with substance
  if (words.length >= 10 && words.length <= 300) score += 5;

  // References to specific concepts/technologies
  if (/\b(API|UI|CSS|HTML|SQL|JSON|REST|GraphQL|auth|login|route|component|model|schema|migration|test|config)\b/i.test(text)) {
    score += 5;
  }

  // Penalty for high meta-instruction ratio
  let metaWordCount = 0;
  for (const pattern of TIER5_META) {
    if (pattern.test(text)) metaWordCount += 5;
  }
  if (/precision,?\s*quality,?\s*correctness/i.test(text)) metaWordCount += 10;
  if (/infer\s+deeply/i.test(text)) metaWordCount += 5;
  if (/transparent\s+future\s+build\s+logs/i.test(text)) metaWordCount += 5;

  const metaRatio = words.length > 0 ? metaWordCount / words.length : 0;
  if (metaRatio > 0.15) score -= 10;
  if (metaRatio > 0.3) score -= 8;

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 4: Iteration Pattern (0-100) ──────────────────────────────────

function scoreIterationPattern(
  prompt: EnrichedPrompt,
  prevPrompts: EnrichedPrompt[]
): number {
  const text = prompt.text;

  // For first prompt in session or standalone, base score
  if (prevPrompts.length === 0) return 50;

  let score = 50; // neutral baseline

  const prevText = prevPrompts[prevPrompts.length - 1]?.text || "";

  // Check for new diagnostic data in follow-up
  const hasNewError = /error|Error|ERROR/.test(text) && !/error|Error|ERROR/.test(prevText);
  const hasNewFile = prompt.features.hasFilePath && !prevPrompts[prevPrompts.length - 1]?.features.hasFilePath;
  const hasNewCode = prompt.features.hasCodeBlock && !prevPrompts[prevPrompts.length - 1]?.features.hasCodeBlock;

  if (hasNewError) score += 15;
  if (hasNewFile) score += 10;
  if (hasNewCode) score += 10;

  // Vocabulary evolution: how many new words vs previous prompt
  const prevWords = new Set(prevText.toLowerCase().split(/\s+/));
  const curWords = text.toLowerCase().split(/\s+/);
  const newWords = curWords.filter((w) => !prevWords.has(w));
  const noveltyRatio = curWords.length > 0 ? newWords.length / curWords.length : 0;
  score += Math.min(noveltyRatio * 30, 20);

  // Penalty for exact or near-duplicate
  if (text === prevText) score -= 30;
  else {
    // Simple Jaccard similarity
    const curSet = new Set(curWords);
    const intersection = [...curSet].filter((w) => prevWords.has(w)).length;
    const union = new Set([...curSet, ...prevWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity > 0.8) score -= 20;
    else if (similarity > 0.6) score -= 10;
  }

  // Penalty for "still not working" without new data
  if (/still\s+(not|have|having|getting|seeing)|not\s+quite/i.test(text)) {
    if (!hasNewError && !hasNewFile && !hasNewCode && noveltyRatio < 0.3) {
      score -= 15;
    }
  }

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 5: Compound Efficiency (0-100) ────────────────────────────────

function scoreCompoundEfficiency(prompt: EnrichedPrompt): number {
  const text = prompt.text;
  let score = 30;

  // Numbered lists (strong compound signal)
  const numberedItems = (text.match(/^\s*\d+[\.\)]\s/gm) || []).length;
  score += Math.min(numberedItems * 8, 25);

  // Bullet lists
  const bulletItems = (text.match(/^\s*[-*]\s/gm) || []).length;
  score += Math.min(bulletItems * 5, 15);

  // Sequencing words
  const seqWords = (text.match(/\b(first|then|next|finally|after|before|also|additionally)\b/gi) || []).length;
  score += Math.min(seqWords * 4, 12);

  // Multiple sentences (compound instructions)
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 5);
  if (sentences.length >= 2) score += 5;
  if (sentences.length >= 3) score += 5;

  // Multiple sentences with action verbs
  let actionSentences = 0;
  for (const s of sentences) {
    const firstWord = s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
    if (TIER1_VERBS.has(firstWord) || TIER2_VERBS.has(firstWord)) actionSentences++;
  }
  score += Math.min(actionSentences * 4, 12);

  // Penalty for single-instruction prompts (very short)
  if (prompt.features.wordCount < 5) score -= 10;

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 6: Tool Leverage (0-100) ──────────────────────────────────────

function scoreToolLeverage(prompt: EnrichedPrompt): number | null {
  if (!prompt.session) return null;

  const tools = prompt.session.toolCounts;
  const totalTools = Object.values(tools).reduce((a, b) => a + b, 0);
  if (totalTools === 0) return 35;

  let score = 35;

  // Tool diversity (more tool types = better)
  const toolTypes = Object.keys(tools).length;
  score += Math.min(toolTypes * 5, 25);

  // Sweet spot: 3-15 tools per prompt (normalized per user message)
  const toolsPerMessage = totalTools / Math.max(prompt.session.userMessageCount, 1);
  if (toolsPerMessage >= 3 && toolsPerMessage <= 15) score += 15;
  else if (toolsPerMessage > 15) score += 5;

  // Read:Edit ratio (investigation before action)
  const reads = tools["Read"] || 0;
  const edits = (tools["Edit"] || 0) + (tools["Write"] || 0);
  if (reads > 0 && edits > 0 && reads >= edits) score += 10;

  // Grep/Glob usage (codebase exploration)
  if (tools["Grep"] || tools["Glob"]) score += 10;

  // Test runs (quality gate)
  if (prompt.session.hasTestRun) score += 10;

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 7: Outcome Signal (0-100) ─────────────────────────────────────

function scoreOutcomeSignal(prompt: EnrichedPrompt): number | null {
  if (!prompt.session) return null;

  let score = 30;

  if (prompt.session.hasFileEdits) score += 20;
  if (prompt.session.hasFileWrites) score += 15;
  if (prompt.session.hasGitCommit) score += 25;
  if (prompt.session.hasTestRun) score += 20;

  // Token efficiency: output/input ratio (higher = more generated content)
  if (prompt.session.inputTokens > 0) {
    const ratio = prompt.session.outputTokens / prompt.session.inputTokens;
    if (ratio > 0.3) score += 5;
    if (ratio > 0.5) score += 5;
  }

  return Math.min(Math.max(score, 0), 100);
}

// ─── Dimension 10: Anti-pattern Detection ────────────────────────────────────

function detectAntiPatterns(
  prompt: EnrichedPrompt,
  prevPrompts: EnrichedPrompt[],
  allPrompts: EnrichedPrompt[],
  promptTextCounts: Map<string, number>
): AntiPatternHit[] {
  const hits: AntiPatternHit[] = [];
  const text = prompt.text;

  // 1. boilerplate-paste: >200 chars matching a prompt used 3+ times
  if (text.length > 200) {
    const count = promptTextCounts.get(text) || 0;
    if (count >= 3) {
      hits.push({
        name: "boilerplate-paste",
        penalty: -15,
        detail: `Exact text repeated ${count} times`,
      });
    } else {
      // Check for long shared prefixes (boilerplate with different suffixes)
      const prefix = text.substring(0, 200);
      let prefixCount = 0;
      for (const [t, c] of promptTextCounts) {
        if (t.startsWith(prefix) && t !== text) prefixCount += c;
      }
      if (prefixCount >= 3) {
        hits.push({
          name: "boilerplate-paste",
          penalty: -10,
          detail: `200-char prefix shared with ${prefixCount} other prompts`,
        });
      }
    }
  }

  // 2. terse-implicit: <5 words, no file ref
  const wordCount = prompt.features.wordCount;
  if (wordCount < 5 && !prompt.features.hasFilePath && !prompt.features.hasFileRef) {
    const isConfirmation = /^(yes|no|ok|sure|yep|nope|continue|proceed|go|execute|do it|let'?s?\s+(do|go)|that|correct|exactly|right)$/i.test(text.trim());
    if (isConfirmation) {
      hits.push({
        name: "terse-implicit",
        penalty: -20,
        detail: `"${text.trim()}" — relies entirely on implicit context`,
      });
    } else if (wordCount <= 3) {
      hits.push({
        name: "terse-implicit",
        penalty: -15,
        detail: `Only ${wordCount} words with no file reference`,
      });
    }
  }

  // 3. still-not-working: without new diagnostic data
  if (/still\s+(not|have|having|getting|seeing)|not\s+quite|doesn'?t\s+work|isn'?t\s+working/i.test(text)) {
    const prevText = prevPrompts[prevPrompts.length - 1]?.text || "";
    const hasNewData = prompt.features.hasCodeBlock ||
      (prompt.features.hasFilePath && !prevPrompts[prevPrompts.length - 1]?.features.hasFilePath) ||
      text.length > prevText.length * 1.5;
    if (!hasNewData) {
      hits.push({
        name: "still-not-working",
        penalty: -10,
        detail: "Frustration signal without new diagnostic data",
      });
    }
  }

  // 4. meta-overload: >3 meta-instructions in one prompt
  let metaCount = 0;
  for (const pattern of TIER5_META) {
    if (pattern.test(text)) metaCount++;
  }
  if (metaCount > 3) {
    hits.push({
      name: "meta-overload",
      penalty: -8,
      detail: `${metaCount} meta-instructions (CoT, category theory, etc.)`,
    });
  }

  // 5. vague-opener: starts with hedging language
  if (/^(can you|could you|please|hey|help me|would you|I need you to)\b/i.test(text.trim())) {
    hits.push({
      name: "vague-opener",
      penalty: -5,
      detail: "Starts with hedging language instead of direct action",
    });
  }

  // 6. kitchen-sink: 5+ unrelated action verbs in one prompt (>200 words)
  if (wordCount > 200) {
    const actionVerbs = new Set<string>();
    for (const word of text.toLowerCase().split(/\s+/)) {
      const clean = word.replace(/[^a-z]/g, "");
      if (TIER1_VERBS.has(clean)) actionVerbs.add(clean);
    }
    if (actionVerbs.size >= 5) {
      hits.push({
        name: "kitchen-sink",
        penalty: -10,
        detail: `${actionVerbs.size} different action verbs: ${[...actionVerbs].join(", ")}`,
      });
    }
  }

  // 7. context-amnesia: referencing earlier conversation
  if (/as I (said|mentioned)|I told you|remember when|like I said|I already/i.test(text)) {
    hits.push({
      name: "context-amnesia",
      penalty: -5,
      detail: "References prior context — Claude has full history",
    });
  }

  // 8. frustration-signal
  if (/what'?s?\s+taking\s+so\s+long|you'?re?\s+stuck|shame|gosh|not true|wrong again|that'?s?\s+not\s+what/i.test(text)) {
    hits.push({
      name: "frustration-signal",
      penalty: -5,
      detail: "Frustration expression — reduces prompt clarity",
    });
  }

  // 9. multi-project-thrash: 3+ project switches within 5 minutes
  // Check recent prompts for rapid project switching
  const recentWindow = 5 * 60 * 1000; // 5 minutes
  const recentPrompts = allPrompts.filter(
    (p) => p.timestamp < prompt.timestamp && p.timestamp > prompt.timestamp - recentWindow
  );
  const recentProjects = new Set(recentPrompts.map((p) => p.project));
  recentProjects.add(prompt.project);
  if (recentProjects.size >= 3) {
    hits.push({
      name: "multi-project-thrash",
      penalty: -8,
      detail: `${recentProjects.size} projects in 5-min window`,
    });
  }

  // 10. no-new-info: duplicate of previous prompt in session
  if (prevPrompts.length > 0) {
    const lastText = prevPrompts[prevPrompts.length - 1].text;
    if (text === lastText) {
      hits.push({
        name: "no-new-info",
        penalty: -15,
        detail: "Exact duplicate of previous prompt",
      });
    } else {
      // Near-duplicate: >90% word overlap
      const curWords = new Set(text.toLowerCase().split(/\s+/));
      const prevWords = new Set(lastText.toLowerCase().split(/\s+/));
      const intersection = [...curWords].filter((w) => prevWords.has(w)).length;
      const union = new Set([...curWords, ...prevWords]).size;
      if (union > 0 && intersection / union > 0.9) {
        hits.push({
          name: "no-new-info",
          penalty: -10,
          detail: "Near-duplicate of previous prompt (>90% overlap)",
        });
      }
    }
  }

  return hits;
}

// ─── Composite Score & Grade ─────────────────────────────────────────────────

function computeComposite(scores: DimensionScores, antiPatternPenalty: number): number {
  const hasSession = scores.toolLeverage !== null && scores.outcomeSignal !== null;

  let weighted: number;
  if (hasSession) {
    // Weights sum to 1.0
    weighted =
      scores.specificity * 0.20 +
      scores.actionDensity * 0.15 +
      scores.contextLoading * 0.15 +
      scores.iterationPattern * 0.10 +
      scores.compoundEfficiency * 0.10 +
      (scores.toolLeverage ?? 0) * 0.15 +
      (scores.outcomeSignal ?? 0) * 0.15;
  } else {
    // Without session data: redistribute across dims 1-5 (weights sum to 1.0)
    weighted =
      scores.specificity * 0.30 +
      scores.actionDensity * 0.20 +
      scores.contextLoading * 0.20 +
      scores.iterationPattern * 0.15 +
      scores.compoundEfficiency * 0.15;
  }

  // Apply anti-pattern penalty (up to -50)
  const final = weighted + Math.max(antiPatternPenalty, -50);
  return Math.min(Math.max(Math.round(final * 10) / 10, 0), 100);
}

function assignGrade(composite: number): string {
  if (composite >= 78) return "A+";
  if (composite >= 72) return "A";
  if (composite >= 66) return "A-";
  if (composite >= 60) return "B+";
  if (composite >= 55) return "B";
  if (composite >= 50) return "B-";
  if (composite >= 47) return "C+";
  if (composite >= 44) return "C";
  if (composite >= 41) return "C-";
  if (composite >= 38) return "D+";
  if (composite >= 35) return "D";
  if (composite >= 30) return "D-";
  return "F";
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const inputPath = resolve(import.meta.dir, "..", "data", "input.json");
  console.log(`Reading ${inputPath}...`);

  const prompts: EnrichedPrompt[] = JSON.parse(readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${prompts.length} prompts`);

  // Pre-compute: count exact text occurrences for boilerplate detection
  const textCounts = new Map<string, number>();
  for (const p of prompts) {
    textCounts.set(p.text, (textCounts.get(p.text) || 0) + 1);
  }

  // Group by session for iteration pattern scoring
  const bySession = new Map<string, EnrichedPrompt[]>();
  for (const p of prompts) {
    const key = p.sessionId || `standalone-${p.id}`;
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key)!.push(p);
  }

  // Sort each session by timestamp
  for (const group of bySession.values()) {
    group.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Score all prompts
  const scored: ScoredPrompt[] = [];

  for (const p of prompts) {
    const sessionKey = p.sessionId || `standalone-${p.id}`;
    const sessionGroup = bySession.get(sessionKey) || [];
    const promptIndex = sessionGroup.indexOf(p);
    const prevPrompts = sessionGroup.slice(0, promptIndex);

    const scores: DimensionScores = {
      specificity: scoreSpecificity(p),
      actionDensity: scoreActionDensity(p),
      contextLoading: scoreContextLoading(p),
      iterationPattern: scoreIterationPattern(p, prevPrompts),
      compoundEfficiency: scoreCompoundEfficiency(p),
      toolLeverage: scoreToolLeverage(p),
      outcomeSignal: scoreOutcomeSignal(p),
      temporalPattern: null,
      projectPattern: null,
    };

    const antiPatterns = detectAntiPatterns(p, prevPrompts, prompts, textCounts);
    const antiPatternPenalty = antiPatterns.reduce((sum, h) => sum + h.penalty, 0);
    const composite = computeComposite(scores, antiPatternPenalty);
    const grade = assignGrade(composite);

    scored.push({
      ...p,
      scores,
      antiPatterns,
      antiPatternPenalty,
      composite,
      grade,
    });
  }

  // Post-processing: Temporal and Project patterns
  // Temporal: compare each prompt's composite to the hourly average
  const hourlyScores = new Map<number, number[]>();
  for (const s of scored) {
    const hour = new Date(s.timestamp).getHours();
    if (!hourlyScores.has(hour)) hourlyScores.set(hour, []);
    hourlyScores.get(hour)!.push(s.composite);
  }
  const hourlyAvg = new Map<number, number>();
  for (const [hour, scores] of hourlyScores) {
    hourlyAvg.set(hour, scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Project: compare to project average
  const projectScores = new Map<string, number[]>();
  for (const s of scored) {
    if (!projectScores.has(s.project)) projectScores.set(s.project, []);
    projectScores.get(s.project)!.push(s.composite);
  }
  const projectAvg = new Map<string, number>();
  for (const [proj, scores] of projectScores) {
    projectAvg.set(proj, scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Fill in temporal and project patterns
  for (const s of scored) {
    const hour = new Date(s.timestamp).getHours();
    const hAvg = hourlyAvg.get(hour) ?? s.composite;
    s.scores.temporalPattern = Math.round((s.composite - hAvg + 50) * 10) / 10;

    const pAvg = projectAvg.get(s.project) ?? s.composite;
    s.scores.projectPattern = Math.round((s.composite - pAvg + 50) * 10) / 10;
  }

  // Write output
  const outPath = resolve(import.meta.dir, "..", "data", "results.json");
  writeFileSync(outPath, JSON.stringify(scored, null, 2));

  // Summary stats
  const composites = scored.map((s) => s.composite);
  const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
  const sorted = [...composites].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const gradeDist: Record<string, number> = {};
  for (const s of scored) {
    gradeDist[s.grade] = (gradeDist[s.grade] || 0) + 1;
  }

  console.log(`\nScored ${scored.length} prompts`);
  console.log(`  Average composite: ${avg.toFixed(1)}`);
  console.log(`  Median composite:  ${median.toFixed(1)}`);
  console.log(`  Grade distribution:`);
  for (const g of ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"]) {
    if (gradeDist[g]) console.log(`    ${g}: ${gradeDist[g]}`);
  }

  // Anti-pattern frequency
  const apFreq: Record<string, number> = {};
  for (const s of scored) {
    for (const ap of s.antiPatterns) {
      apFreq[ap.name] = (apFreq[ap.name] || 0) + 1;
    }
  }
  console.log(`  Anti-patterns detected:`);
  for (const [name, count] of Object.entries(apFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name}: ${count} (${((count / scored.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\nResults written to ${outPath}`);
}

main();
