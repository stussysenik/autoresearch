/**
 * derive.ts — Reads the registry and generates 3 test prompts.
 *
 * The 3 prompts cover a spread of priority levels:
 *   Prompt A → M01 (flowchart, highest priority)
 *   Prompt B → M03 (sequence, mid priority)
 *   Prompt C → M05 (state, mid-low priority)
 *
 * Output: prints to stdout AND writes to data/prompts.json.
 * Usage:  bun run derive
 */

import { REGISTRY, getEntry } from "../keywords/registry.ts";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// The 3 M-types we test in this smoke run
const TEST_IDS = ["M01", "M03", "M05"] as const;

interface TestPrompt {
  id: string;
  type: string;
  expectedSyntax: string;
  prompt: string;
}

function derivePrompts(): TestPrompt[] {
  return TEST_IDS.map((id) => {
    const entry = getEntry(id);
    if (!entry) throw new Error(`Registry missing ${id}`);

    // Use the first example as the concrete test prompt
    const prompt = entry.examples[0];

    return {
      id: entry.id,
      type: entry.type,
      expectedSyntax: entry.syntax,
      prompt,
    };
  });
}

// --- Main ---
const prompts = derivePrompts();

console.log("=== Derived Test Prompts ===\n");
for (const p of prompts) {
  console.log(`[${p.id}] ${p.type}`);
  console.log(`  Expected syntax: ${p.expectedSyntax}`);
  console.log(`  Prompt: "${p.prompt}"`);
  console.log();
}

// Write to data/prompts.json
const outDir = join(import.meta.dir, "..", "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "prompts.json");
writeFileSync(outPath, JSON.stringify(prompts, null, 2));
console.log(`Written to ${outPath}`);
