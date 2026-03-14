/**
 * Phase 1: Fetch & Enrich
 *
 * Reads ~/.claude/history.jsonl, filters to substantive prompts,
 * computes text features, and enriches with session-level outcome data
 * from ~/.claude/projects/*\/*.jsonl files.
 */

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryEntry {
  display: string;
  pastedContents: Record<string, string>;
  timestamp: number;
  project: string;
  sessionId?: string;
}

interface TextFeatures {
  wordCount: number;
  charCount: number;
  lineCount: number;
  hasFileRef: boolean;
  hasLineRef: boolean;
  hasNumberedList: boolean;
  hasBulletList: boolean;
  hasCodeBlock: boolean;
  hasFilePath: boolean;
  startsWithVerb: boolean;
  hasQuestion: boolean;
  hasPastedContent: boolean;
}

interface SessionData {
  inputTokens: number;
  outputTokens: number;
  toolCounts: Record<string, number>;
  hasFileEdits: boolean;
  hasFileWrites: boolean;
  hasGitCommit: boolean;
  hasTestRun: boolean;
  userMessageCount: number;
  assistantMessageCount: number;
  durationMs: number;
  promptPosition: number; // 0-indexed position of this prompt in the session
}

export interface EnrichedPrompt {
  id: number;
  text: string;
  timestamp: number;
  project: string;
  sessionId: string | null;
  features: TextFeatures;
  session: SessionData | null;
}

// ─── Text Feature Extraction ─────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  "fix", "implement", "create", "add", "remove", "replace", "rename", "move",
  "extract", "refactor", "update", "modify", "delete", "merge", "split",
  "configure", "install", "build", "run", "test", "debug", "check", "review",
  "analyze", "investigate", "search", "find", "write", "read", "make", "set",
  "change", "convert", "migrate", "deploy", "push", "pull", "commit", "revert",
  "show", "list", "print", "log", "trace", "explain", "compare", "verify",
  "validate", "generate", "parse", "execute", "apply", "use", "open", "close",
  "start", "stop", "enable", "disable", "reset", "clear",
]);

function extractTextFeatures(text: string, pastedContents: Record<string, string>): TextFeatures {
  const lines = text.split("\n");
  const words = text.split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";

  return {
    wordCount: words.length,
    charCount: text.length,
    lineCount: lines.length,
    hasFileRef: /\.[a-zA-Z]{1,5}(?::\d+)?/.test(text),
    hasLineRef: /:\d{1,5}(?::\d{1,5})?/.test(text) || /line\s+\d+/i.test(text),
    hasNumberedList: /^\s*\d+[\.\)]\s/m.test(text),
    hasBulletList: /^\s*[-*]\s/m.test(text),
    hasCodeBlock: /```/.test(text) || /^\s{4,}\S/m.test(text),
    hasFilePath: /(?:\/[\w.-]+){2,}/.test(text) || /~\//.test(text),
    startsWithVerb: ACTION_VERBS.has(firstWord),
    hasQuestion: /\?/.test(text),
    hasPastedContent: Object.keys(pastedContents).length > 0,
  };
}

// ─── Session Parsing ─────────────────────────────────────────────────────────

interface ParsedSession {
  userTimestamps: number[];
  inputTokens: number;
  outputTokens: number;
  toolCounts: Record<string, number>;
  hasFileEdits: boolean;
  hasFileWrites: boolean;
  hasGitCommit: boolean;
  hasTestRun: boolean;
  userMessageCount: number;
  assistantMessageCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

function parseSessionFile(filePath: string): ParsedSession | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const result: ParsedSession = {
      userTimestamps: [],
      inputTokens: 0,
      outputTokens: 0,
      toolCounts: {},
      hasFileEdits: false,
      hasFileWrites: false,
      hasGitCommit: false,
      hasTestRun: false,
      userMessageCount: 0,
      assistantMessageCount: 0,
      firstTimestamp: Infinity,
      lastTimestamp: 0,
    };

    for (const line of lines) {
      let entry: any;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
      if (ts > 0) {
        result.firstTimestamp = Math.min(result.firstTimestamp, ts);
        result.lastTimestamp = Math.max(result.lastTimestamp, ts);
      }

      if (entry.type === "user") {
        result.userMessageCount++;
        if (ts > 0) result.userTimestamps.push(ts);
      }

      if (entry.type === "assistant") {
        result.assistantMessageCount++;

        // Extract token usage
        const usage = entry.message?.usage;
        if (usage) {
          result.inputTokens += (usage.input_tokens || 0) +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0);
          result.outputTokens += usage.output_tokens || 0;
        }

        // Extract tool usage
        const content = entry.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "tool_use") {
              const name = block.name || "unknown";
              result.toolCounts[name] = (result.toolCounts[name] || 0) + 1;

              if (name === "Edit") result.hasFileEdits = true;
              if (name === "Write") result.hasFileWrites = true;

              // Check for git commits and test runs in Bash tool
              if (name === "Bash" && typeof block.input?.command === "string") {
                const cmd = block.input.command;
                if (/git\s+commit/.test(cmd)) result.hasGitCommit = true;
                if (/(?:bun|npm|yarn|pnpm)\s+(?:run\s+)?test|pytest|jest|vitest/.test(cmd)) {
                  result.hasTestRun = true;
                }
              }
            }
          }
        }
      }
    }

    if (result.firstTimestamp === Infinity) result.firstTimestamp = 0;
    return result;
  } catch {
    return null;
  }
}

// ─── Build Session Index ─────────────────────────────────────────────────────

function buildSessionIndex(): Map<string, string> {
  const projectsDir = join(homedir(), ".claude", "projects");
  const index = new Map<string, string>();

  if (!existsSync(projectsDir)) return index;

  for (const projectDir of readdirSync(projectsDir)) {
    const projectPath = join(projectsDir, projectDir);
    if (!statSync(projectPath).isDirectory()) continue;

    for (const file of readdirSync(projectPath)) {
      if (!file.endsWith(".jsonl")) continue;
      const sessionId = file.replace(".jsonl", "");
      // UUID pattern check
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) {
        index.set(sessionId, join(projectPath, file));
      }
    }
  }

  return index;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const historyPath = join(homedir(), ".claude", "history.jsonl");
  console.log(`Reading ${historyPath}...`);

  const raw = readFileSync(historyPath, "utf-8");
  const lines = raw.split("\n").filter(Boolean);
  console.log(`Total history entries: ${lines.length}`);

  // Parse all entries
  const entries: HistoryEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  // Filter: remove slash commands and trivial entries
  const substantive = entries.filter((e) => {
    const text = e.display?.trim() || "";
    if (!text) return false;
    if (text.startsWith("/")) return false; // slash commands
    if (text.length < 5) return false; // trivial
    return true;
  });

  console.log(`Substantive prompts after filtering: ${substantive.length}`);

  // Build session index
  console.log("Building session index...");
  const sessionIndex = buildSessionIndex();
  console.log(`Session files indexed: ${sessionIndex.size}`);

  // Group prompts by sessionId for efficient parsing
  const bySession = new Map<string, { prompt: HistoryEntry; originalIndex: number }[]>();
  const noSession: { prompt: HistoryEntry; originalIndex: number }[] = [];

  for (let i = 0; i < substantive.length; i++) {
    const p = substantive[i];
    if (p.sessionId && sessionIndex.has(p.sessionId)) {
      if (!bySession.has(p.sessionId)) bySession.set(p.sessionId, []);
      bySession.get(p.sessionId)!.push({ prompt: p, originalIndex: i });
    } else {
      noSession.push({ prompt: p, originalIndex: i });
    }
  }

  console.log(`Prompts with session data: ${substantive.length - noSession.length}`);
  console.log(`Unique sessions to parse: ${bySession.size}`);

  // Parse sessions and enrich
  const enriched: EnrichedPrompt[] = [];
  let sessionsParsed = 0;

  // Process prompts with session data
  for (const [sessionId, promptGroup] of bySession) {
    const filePath = sessionIndex.get(sessionId)!;
    const parsed = parseSessionFile(filePath);
    sessionsParsed++;

    if (sessionsParsed % 100 === 0) {
      console.log(`  Parsed ${sessionsParsed}/${bySession.size} sessions...`);
    }

    // Sort user timestamps to find prompt positions
    const userTs = parsed?.userTimestamps.sort((a, b) => a - b) || [];

    for (const { prompt, originalIndex } of promptGroup) {
      const features = extractTextFeatures(prompt.display, prompt.pastedContents || {});

      let sessionData: SessionData | null = null;
      if (parsed) {
        // Find prompt position by matching timestamp
        let position = 0;
        for (let i = 0; i < userTs.length; i++) {
          // Match within 2 second window (timestamps might differ slightly)
          if (Math.abs(userTs[i] - prompt.timestamp) < 2000) {
            position = i;
            break;
          }
          if (userTs[i] > prompt.timestamp) {
            position = Math.max(0, i - 1);
            break;
          }
          position = i;
        }

        sessionData = {
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          toolCounts: parsed.toolCounts,
          hasFileEdits: parsed.hasFileEdits,
          hasFileWrites: parsed.hasFileWrites,
          hasGitCommit: parsed.hasGitCommit,
          hasTestRun: parsed.hasTestRun,
          userMessageCount: parsed.userMessageCount,
          assistantMessageCount: parsed.assistantMessageCount,
          durationMs: parsed.lastTimestamp - parsed.firstTimestamp,
          promptPosition: position,
        };
      }

      enriched.push({
        id: originalIndex,
        text: prompt.display,
        timestamp: prompt.timestamp,
        project: prompt.project || "",
        sessionId: prompt.sessionId || null,
        features,
        session: sessionData,
      });
    }
  }

  // Process prompts without session data
  for (const { prompt, originalIndex } of noSession) {
    const features = extractTextFeatures(prompt.display, prompt.pastedContents || {});
    enriched.push({
      id: originalIndex,
      text: prompt.display,
      timestamp: prompt.timestamp,
      project: prompt.project || "",
      sessionId: prompt.sessionId || null,
      features,
      session: null,
    });
  }

  // Sort by original index to maintain chronological order
  enriched.sort((a, b) => a.id - b.id);

  // Re-assign sequential IDs
  for (let i = 0; i < enriched.length; i++) {
    enriched[i].id = i;
  }

  // Write output
  const outDir = resolve(import.meta.dir, "..", "data");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, "input.json");
  writeFileSync(outPath, JSON.stringify(enriched, null, 2));

  console.log(`\nDone! Wrote ${enriched.length} enriched prompts to ${outPath}`);

  // Stats
  const withSession = enriched.filter((e) => e.session !== null).length;
  const projects = new Set(enriched.map((e) => e.project)).size;
  const avgWords = Math.round(enriched.reduce((s, e) => s + e.features.wordCount, 0) / enriched.length);
  console.log(`  With session data: ${withSession}`);
  console.log(`  Unique projects: ${projects}`);
  console.log(`  Avg word count: ${avgWords}`);
}

main();
