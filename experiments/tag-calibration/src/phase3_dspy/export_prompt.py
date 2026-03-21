"""
Export an optimized DSPy program as a production-ready prompt.

Takes the best-performing optimized program from Phase 3 and extracts its
compiled prompt into portable formats:

1. JSON file with system message, few-shot demos, input template, and metadata
2. TypeScript snippet that can replace `buildLocalClassificationMessage` in the
   mymind-clone-web production codebase

This bridges the gap between DSPy's optimization environment and production
deployment where we call Ollama directly without DSPy.

Usage:
    uv run python -m src.phase3_dspy.export_prompt
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import dspy

from src.config import DATA_DIR, OLLAMA_MODEL
from src.models import Taxonomy
from .modules import TagClassifier


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_best_program(taxonomy: Taxonomy) -> tuple[dspy.Module, str, float]:
    """Load the best-scoring optimized program.

    Reads the optimization summary to determine the winner, then loads
    that program from disk.

    Args:
        taxonomy: Taxonomy needed to reconstruct the TagClassifier module.

    Returns:
        (program, optimizer_name, score) tuple.
    """
    summary_path = DATA_DIR / "optimized_prompts" / "optimization_summary.json"
    if not summary_path.exists():
        print(f"ERROR: Optimization summary not found at {summary_path}")
        print("Run Phase 3 optimization first: make phase3")
        sys.exit(1)

    with open(summary_path) as f:
        summary = json.load(f)

    winner = summary["winner"]
    # Map winner name to directory name
    dir_name = "bootstrap_fewshot" if "BootstrapFewShot" in winner else "mipro_v2"
    score = summary.get(f"{dir_name}_score", 0.0)

    program_dir = DATA_DIR / "optimized_prompts" / dir_name
    if not program_dir.exists():
        print(f"ERROR: Program directory not found at {program_dir}")
        sys.exit(1)

    # Reconstruct the module and load optimized state
    program = TagClassifier(taxonomy)
    program.load(str(program_dir))

    print(f"  Loaded {winner} (score: {score:.4f}) from {program_dir}")
    return program, winner, score


def load_taxonomy() -> Taxonomy:
    """Load taxonomy from data/taxonomy.json."""
    path = DATA_DIR / "taxonomy.json"
    if not path.exists():
        print(f"ERROR: Taxonomy not found at {path}")
        sys.exit(1)
    with open(path) as f:
        return Taxonomy.model_validate(json.load(f))


# ---------------------------------------------------------------------------
# Prompt extraction
# ---------------------------------------------------------------------------

def extract_prompt_data(program: dspy.Module) -> dict:
    """Extract the compiled prompt from a DSPy program using ChatAdapter.

    DSPy's ChatAdapter converts a program's internal state (instruction +
    demonstrations + field descriptions) into the chat message format that
    LLM APIs expect. We capture this to reconstruct the prompt without DSPy.

    Args:
        program: The optimized DSPy Module.

    Returns:
        Dict with system_message, demo_messages, and field metadata.
    """
    adapter = dspy.ChatAdapter()

    # Build a dummy call to extract the message template
    # We use placeholder values to see the full prompt structure
    signature = program.classify.signature

    # Extract the signature's instructions (docstring — possibly rewritten by MIPRO)
    instructions = getattr(signature, "__doc__", "") or ""
    if hasattr(signature, "instructions"):
        instructions = signature.instructions

    # Extract demonstrations from the compiled predict module
    demos = []
    predict_module = program.classify

    # DSPy stores demos in the predict module's `demos` attribute
    if hasattr(predict_module, "demos") and predict_module.demos:
        for demo in predict_module.demos:
            demo_dict = {}
            # Extract all fields from the demo
            for field_name in ["title", "content", "url", "platform",
                               "primary_tags", "contextual_tags", "style_tag"]:
                val = getattr(demo, field_name, None)
                if val is not None:
                    demo_dict[field_name] = val
            # Include reasoning if present (from ChainOfThought)
            reasoning = getattr(demo, "reasoning", None) or getattr(demo, "rationale", None)
            if reasoning:
                demo_dict["reasoning"] = reasoning
            if demo_dict:
                demos.append(demo_dict)

    # Build the system message from instructions and field descriptions
    field_descs = {}
    for name, field in signature.output_fields.items():
        desc = field.json_schema_extra.get("desc", "") if hasattr(field, "json_schema_extra") and field.json_schema_extra else ""
        if not desc:
            desc = str(field.metadata) if hasattr(field, "metadata") else ""
        field_descs[name] = desc

    input_field_descs = {}
    for name, field in signature.input_fields.items():
        desc = field.json_schema_extra.get("desc", "") if hasattr(field, "json_schema_extra") and field.json_schema_extra else ""
        if not desc:
            desc = str(field.metadata) if hasattr(field, "metadata") else ""
        input_field_descs[name] = desc

    return {
        "system_message": instructions.strip(),
        "demos": demos,
        "input_fields": input_field_descs,
        "output_fields": field_descs,
    }


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------

def export_json(prompt_data: dict, optimizer_name: str, score: float) -> Path:
    """Save the extracted prompt as a portable JSON file.

    The JSON format is designed to be consumed by any LLM client library
    without DSPy, including the TypeScript production codebase.

    Args:
        prompt_data: Extracted prompt data from extract_prompt_data.
        optimizer_name: Name of the optimizer that produced this prompt.
        score: Dev set evaluation score.

    Returns:
        Path to the saved JSON file.
    """
    # Build few-shot demo messages in user/assistant format
    demo_messages = []
    for demo in prompt_data["demos"]:
        # User message: the input fields
        user_parts = []
        for field in ["title", "content", "url", "platform"]:
            if field in demo:
                user_parts.append(f"**{field.title()}:** {demo[field]}")
        user_msg = "\n".join(user_parts)

        # Assistant message: reasoning + output fields
        assistant_parts = []
        if "reasoning" in demo:
            assistant_parts.append(f"**Reasoning:** {demo['reasoning']}")
        for field in ["primary_tags", "contextual_tags", "style_tag"]:
            if field in demo:
                val = demo[field]
                if isinstance(val, list):
                    val = ", ".join(val)
                label = field.replace("_", " ").title()
                assistant_parts.append(f"**{label}:** {val}")
        assistant_msg = "\n".join(assistant_parts)

        demo_messages.append({"role": "user", "content": user_msg})
        demo_messages.append({"role": "assistant", "content": assistant_msg})

    # Build input template with placeholders
    input_template = "\n".join(
        f"**{name.title()}:** {{{{{name}}}}}"
        for name in prompt_data["input_fields"]
    )

    export = {
        "system_message": prompt_data["system_message"],
        "demo_messages": demo_messages,
        "input_template": input_template,
        "output_fields": list(prompt_data["output_fields"].keys()),
        "metadata": {
            "optimizer": optimizer_name,
            "demo_count": len(prompt_data["demos"]),
            "model": OLLAMA_MODEL,
            "score": score,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "format_version": "1.0",
        },
    }

    out_path = DATA_DIR / "optimized_prompts" / "production_prompt.json"
    with open(out_path, "w") as f:
        json.dump(export, f, indent=2, ensure_ascii=False)

    print(f"  JSON exported to {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# TypeScript export
# ---------------------------------------------------------------------------

def export_typescript(prompt_data: dict) -> Path:
    """Generate a TypeScript snippet for production integration.

    Creates a function that replaces `buildLocalClassificationMessage` in
    the mymind-clone-web codebase. The function constructs the optimized
    prompt with baked-in few-shot demonstrations.

    Args:
        prompt_data: Extracted prompt data from extract_prompt_data.

    Returns:
        Path to the saved TypeScript file.
    """
    # Escape backticks and ${} in the system message for template literals
    system_msg = prompt_data["system_message"]
    system_msg = system_msg.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

    # Build demo strings
    demo_lines = []
    for demo in prompt_data["demos"]:
        user_parts = []
        for field in ["title", "content", "url", "platform"]:
            if field in demo:
                val = str(demo[field]).replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
                user_parts.append(f"**{field.title()}:** {val}")
        user_content = "\\n".join(user_parts)

        assistant_parts = []
        if "reasoning" in demo:
            reasoning = str(demo["reasoning"]).replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
            assistant_parts.append(f"**Reasoning:** {reasoning}")
        for field in ["primary_tags", "contextual_tags", "style_tag"]:
            if field in demo:
                val = demo[field]
                if isinstance(val, list):
                    val = ", ".join(val)
                val = str(val).replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
                label = field.replace("_", " ").title()
                assistant_parts.append(f"**{label}:** {val}")
        assistant_content = "\\n".join(assistant_parts)

        demo_lines.append(
            f'    {{ role: "user" as const, content: `{user_content}` }},\n'
            f'    {{ role: "assistant" as const, content: `{assistant_content}` }},'
        )

    demos_block = "\n".join(demo_lines)

    ts_code = f'''\
/**
 * DSPy-optimized tag classification prompt.
 *
 * Auto-generated by tag-calibration Phase 3 export.
 * Do not edit manually — re-run `make phase3` and export to regenerate.
 *
 * Model: {OLLAMA_MODEL}
 * Demos: {len(prompt_data["demos"])} few-shot examples
 */

interface ClassificationInput {{
  title: string;
  content: string;
  url?: string;
  platform?: string;
}}

interface ChatMessage {{
  role: "system" | "user" | "assistant";
  content: string;
}}

const SYSTEM_MESSAGE = `{system_msg}`;

const FEW_SHOT_DEMOS: ChatMessage[] = [
{demos_block}
];

/**
 * Build the classification message array for Ollama.
 *
 * Drop-in replacement for `buildLocalClassificationMessage` in
 * src/lib/ai/classifyTags.ts — uses DSPy-optimized system prompt
 * and few-shot demonstrations instead of the hand-written prompt.
 */
export function buildLocalClassificationMessage(
  input: ClassificationInput,
): ChatMessage[] {{
  const userMessage = [
    `**Title:** ${{input.title || "(untitled)"}}`,
    `**Content:** ${{(input.content || "").slice(0, 1500)}}`,
    `**Url:** ${{input.url || ""}}`,
    `**Platform:** ${{input.platform || "unknown"}}`,
  ].join("\\n");

  return [
    {{ role: "system", content: SYSTEM_MESSAGE }},
    ...FEW_SHOT_DEMOS,
    {{ role: "user", content: userMessage }},
  ];
}}
'''

    out_path = DATA_DIR / "optimized_prompts" / "classifyTags.optimized.ts"
    with open(out_path, "w") as f:
        f.write(ts_code)

    print(f"  TypeScript exported to {out_path}")
    return out_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_export():
    """Execute the prompt export pipeline."""
    print("=" * 60)
    print("Phase 3: Export Optimized Prompt")
    print("=" * 60)

    # Load taxonomy
    print("\n[1/4] Loading taxonomy...")
    taxonomy = load_taxonomy()

    # Load best program
    print("\n[2/4] Loading best optimized program...")
    program, optimizer_name, score = load_best_program(taxonomy)

    # Extract prompt data
    print("\n[3/4] Extracting prompt structure...")
    prompt_data = extract_prompt_data(program)
    print(f"  System message: {len(prompt_data['system_message'])} chars")
    print(f"  Demos: {len(prompt_data['demos'])} few-shot examples")
    print(f"  Output fields: {list(prompt_data['output_fields'].keys())}")

    # Export
    print("\n[4/4] Exporting...")
    json_path = export_json(prompt_data, optimizer_name, score)
    ts_path = export_typescript(prompt_data)

    print("\n" + "=" * 60)
    print("Export complete!")
    print(f"  JSON:       {json_path}")
    print(f"  TypeScript: {ts_path}")
    print("\nTo use in production:")
    print(f"  cp {ts_path} <mymind-clone-web>/src/lib/ai/classifyTags.optimized.ts")
    print("=" * 60)


if __name__ == "__main__":
    run_export()
