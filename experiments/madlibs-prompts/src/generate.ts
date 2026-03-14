/**
 * Cheatsheet generator — builds a Markdown + PDF dispatch reference
 * from the M01–M08 registry. Zero hardcoded content: everything is
 * derived from registry.ts so the cheatsheet stays in sync with
 * the kernel automatically.
 *
 * Output: ~/Downloads/mermaid-dispatch-cheatsheet.{md,pdf}
 *
 * Usage: bun run generate
 */

import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { REGISTRY } from "../keywords/registry.ts";

// ── Markdown builder ─────────────────────────────────────────────

function buildMarkdown(): string {
  const lines: string[] = [];

  // Title
  lines.push("# Mermaid Dispatch Cheatsheet");
  lines.push("");
  lines.push("> **Decision rule**: Scan M01 → M08 in order. Use the **first match**.");
  lines.push("> If nothing matches, default to **M01 Flowchart**.");
  lines.push("");

  // Quick-reference dispatch table
  lines.push("## Quick-Reference Dispatch Table");
  lines.push("");
  lines.push("| ID | Type | Syntax | Triggers |");
  lines.push("|-----|------|--------|----------|");
  for (const entry of REGISTRY) {
    const triggers = entry.triggers.join(", ");
    lines.push(`| **${entry.id}** | ${entry.type} | \`${entry.syntax}\` | ${triggers} |`);
  }
  lines.push("");

  // Per-M-type sections
  for (const entry of REGISTRY) {
    lines.push(`---`);
    lines.push("");
    lines.push(`## ${entry.id} — ${entry.type}`);
    lines.push("");
    lines.push(`**Syntax**: \`${entry.syntax}\``);
    lines.push("");
    lines.push(`**Triggers**: ${entry.triggers.map((t) => `\`${t}\``).join(", ")}`);
    lines.push("");
    lines.push(`**Template**:`);
    lines.push(`> ${entry.template}`);
    lines.push("");
    lines.push(`**Example**:`);
    lines.push(`> ${entry.examples[0]}`);
    lines.push("");
    lines.push(`**Skeleton**:`);
    lines.push("```mermaid");
    lines.push(entry.skeleton);
    lines.push("```");
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`*Generated on ${new Date().toISOString().split("T")[0]} from registry.ts — do not edit by hand.*`);
  lines.push("");

  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const md = buildMarkdown();
  const downloadsDir = join(homedir(), "Downloads");
  const mdPath = join(downloadsDir, "mermaid-dispatch-cheatsheet.md");
  const pdfPath = join(downloadsDir, "mermaid-dispatch-cheatsheet.pdf");

  // Write markdown
  writeFileSync(mdPath, md, "utf-8");
  console.log(`✓ Markdown → ${mdPath}`);

  // Convert to PDF via md-to-pdf
  const { mdToPdf } = await import("md-to-pdf");

  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #24292e; }
    h1 { border-bottom: 2px solid #0366d6; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-top: 1.5em; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    tr:nth-child(2n) { background: #f6f8fa; }
    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
    blockquote { border-left: 4px solid #0366d6; margin: 0; padding: 0 1em; color: #6a737d; }
    hr { border: none; border-top: 1px solid #eaecef; margin: 1.5em 0; }
  `;

  await mdToPdf(
    { content: md },
    {
      dest: pdfPath,
      css,
      pdf_options: {
        format: "A4",
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
        printBackground: true,
      },
    },
  );

  console.log(`✓ PDF     → ${pdfPath}`);
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
