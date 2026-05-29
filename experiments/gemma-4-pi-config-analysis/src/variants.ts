/**
 * Experiment Variants for Pi-Config Analysis
 */

export interface Variant {
  name: string
  description: string
  prompt?: string
  parameters?: Record<string, any>
  model?: string
}

/**
 * Template replacement helper
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
 */
export const variants: Variant[] = [
  {
    name: 'gemma-4-baseline',
    description: 'Gemma 4 basic architectural summary',
    model: 'gemma-4',
    prompt: `Analyze the Pi-Config Implementation Plan provided below. Summarize the core value proposition, the pod management lifecycle, and the model deployment architecture.

Document:
{content}

Context:
{context}

Provide a summary in markdown format.`,
  },
  {
    name: 'gemma-4-reasoning',
    description: 'Gemma 4 deep architectural critique',
    model: 'gemma-4',
    prompt: `<|channel|>thought
Analyze the Pi-Config system. What are the potential bottlenecks in the model caching strategy? How does the "round-robin" GPU selection impact heterogeneous pod environments? Is the local-state-only architecture (pods.json) a risk for multi-user or multi-device workflows?
<channel|>

Based on the implementation plan below, provide a critical review of the Pi-Config architecture. Focus on:
1. Scalability and multi-pod orchestration
2. Storage persistence and regional limitations
3. Security of the vLLM endpoints

Document:
{content}

Context:
{context}`,
  },
]
