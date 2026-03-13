/**
 * Experiment Variants
 *
 * Define different variations to test (prompts, parameters, algorithms, etc.)
 */

export interface Variant {
  name: string
  description: string
  prompt?: string
  parameters?: Record<string, any>
}

/**
 * Template replacement helper
 *
 * Usage:
 * const filled = fillTemplate(variant.prompt, { content: 'example', title: 'test' })
 */
export function fillTemplate(template: string, data: Record<string, string>): string {
  let filled = template
  for (const [key, value] of Object.entries(data)) {
    filled = filled.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return filled
}

/**
 * Define your variants here
 *
 * Example: Prompt testing
 */
export const variants: Variant[] = [
  {
    name: 'baseline',
    description: 'Current approach (control group)',
    prompt: `Analyze this content and provide a summary.

Content: {content}

Provide your analysis.`,
  },
  {
    name: 'improved',
    description: 'Improved approach with structured output',
    prompt: `Analyze this content systematically:

Content: {content}
Title: {title}

Provide structured analysis:
1. Main topic
2. Key entities
3. Abstract concepts
4. Overall sentiment

Return JSON: {
  "topic": "...",
  "entities": [...],
  "concepts": [...],
  "sentiment": "..."
}`,
  },
  {
    name: 'chain_of_thought',
    description: 'Step-by-step reasoning',
    prompt: `Think step-by-step to analyze this content:

{content}

Step 1: What is this content about?
Step 2: Who or what are the main entities?
Step 3: What broader themes does it relate to?
Step 4: What is the overall tone/sentiment?

Return JSON with your reasoning: {
  "analysis": "Brief explanation",
  "topic": "...",
  "entities": [...],
  "themes": [...],
  "tone": "..."
}`,
  },
]

/**
 * Example: Parameter testing
 *
 * export const variants: Variant[] = [
 *   {
 *     name: 'low_temp',
 *     description: 'Temperature 0.3 (deterministic)',
 *     parameters: { temperature: 0.3, max_tokens: 100 }
 *   },
 *   {
 *     name: 'high_temp',
 *     description: 'Temperature 1.0 (creative)',
 *     parameters: { temperature: 1.0, max_tokens: 100 }
 *   },
 * ]
 */
