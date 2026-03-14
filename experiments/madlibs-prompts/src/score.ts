/**
 * score.ts — Parses Claude plan output and scores diagram-type match.
 *
 * Reads data/prompts.json for expected types, then reads each
 * data/result-{id}.md file (or a single data/results.json) and
 * checks whether the mermaid block uses the correct syntax keyword.
 *
 * Usage:  bun run score
 *
 * Result files can be created manually by pasting Claude's plan output
 * into data/result-M01.md, data/result-M03.md, data/result-M05.md.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface TestPrompt {
  id: string;
  type: string;
  expectedSyntax: string;
  prompt: string;
}

interface ScoreResult {
  id: string;
  expected: string;
  found: string | null;
  pass: boolean;
}

/** Extract the first mermaid syntax keyword from a markdown string */
function extractMermaidSyntax(md: string): string | null {
  const match = md.match(/```mermaid\s*\n\s*(.+)/);
  return match ? match[1].trim() : null;
}

// --- Main ---
const dataDir = join(import.meta.dir, "..", "data");
const promptsPath = join(dataDir, "prompts.json");

if (!existsSync(promptsPath)) {
  console.error("No data/prompts.json found. Run `bun run derive` first.");
  process.exit(1);
}

const prompts: TestPrompt[] = JSON.parse(readFileSync(promptsPath, "utf-8"));
const results: ScoreResult[] = [];

for (const p of prompts) {
  const resultPath = join(dataDir, `result-${p.id}.md`);
  if (!existsSync(resultPath)) {
    console.log(`[${p.id}] SKIP — no result file at ${resultPath}`);
    results.push({ id: p.id, expected: p.expectedSyntax, found: null, pass: false });
    continue;
  }

  const content = readFileSync(resultPath, "utf-8");
  const found = extractMermaidSyntax(content);
  const pass = found !== null && p.expectedSyntax.startsWith(found);

  results.push({ id: p.id, expected: p.expectedSyntax, found, pass });
  console.log(`[${p.id}] ${pass ? "PASS" : "FAIL"} — expected "${p.expectedSyntax}", found "${found}"`);
}

const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== Score: ${passCount}/${results.length} ===`);

if (passCount === results.length) {
  console.log("All prompts produced the correct diagram type.");
} else {
  console.log("Some prompts missed. Check triggers in registry.ts.");
}
