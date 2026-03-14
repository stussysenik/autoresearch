/**
 * Prompt Variants for Tag Optimization Experiment
 *
 * Four different prompt strategies to test which produces the best tags:
 * - Baseline: Current system prompt
 * - Lexical Category Guided: Uses linguistic theory
 * - Chain-of-Thought: Step-by-step reasoning
 * - Platform-Aware: Context-specific guidelines
 */

export interface Variant {
  name: string
  description: string
  template: string
}

/**
 * Variant A: Baseline (Current System)
 *
 * This is the current prompt used in production.
 */
export const BASELINE_PROMPT: Variant = {
  name: 'baseline',
  description: 'Current production prompt with 3-layer hierarchical tags',
  template: `You are a highly sophisticated curator for a visual knowledge system. Analyze content and generate metadata that enables SERENDIPITOUS discovery across disciplines.

CRITICAL INSTRUCTIONS:
1. TAGGING: Generate 3-5 HIERARCHICAL tags using this 3-layer structure:
   LAYER 1 - PRIMARY (1-2 tags): The ESSENCE of the item. What makes it unique.
     Examples: "bmw", "terence-tao", "category-theory", "breakdance"

   LAYER 2 - CONTEXTUAL (1-2 tags): The broader subject or field.
     Examples: "automotive", "mathematics", "dance", "data-viz"

   LAYER 3 - VIBE/MOOD (1 tag): The abstract feeling, energy, or aesthetic. THIS IS CRITICAL.
     Vocabulary: kinetic, atmospheric, minimalist, raw, nostalgic, elegant, chaotic, ethereal, tactile, visceral, contemplative, playful, precise, organic, geometric
     Examples:
       - Breakdance video -> "kinetic"
       - Weather data viz -> "atmospheric"
       - Japanese design article -> "minimalist"
       - Academic math paper -> "contemplative"

   The VIBE tag creates cross-disciplinary portals: a breakdance video (kinetic) connects to a JavaScript animation (kinetic).
   DO NOT use generic tags like "website", "link", "page", "content".

CONTENT TO ANALYZE:
Platform: {platform}
Title: {title}
Content: {content}
URL: {url}

Return ONLY a JSON object (no markdown, no explanation):
{"tags": ["tag1", "tag2", "tag3"], "reasoning": "brief explanation"}`
}

/**
 * Variant B: Lexical Category Guided
 *
 * Uses linguistic theory to categorize tags into semantic types.
 */
export const LEXICAL_PROMPT: Variant = {
  name: 'lexical',
  description: 'Linguistic category-based tagging (entities, concepts, qualities, actions)',
  template: `Analyze content and generate tags using LINGUISTIC CATEGORIES:

CONTENT:
Platform: {platform}
Title: {title}
Content: {content}
URL: {url}

Generate exactly 3-5 tags following these LEXICAL CATEGORIES:

1. ENTITY TAG (1): Named person/brand/place OR specific noun phrase
   - Examples: "terence-tao", "bmw-m3", "javascript", "figma"
   - Format: lowercase-with-hyphens

2. CONCEPT TAG (1-2): Abstract field/domain/subject
   - Examples: "mathematics", "automotive-design", "web-development"
   - Format: lowercase-with-hyphens

3. QUALITY TAG (1): Adjective describing aesthetic/mood (REQUIRED)
   - Choose ONE from: kinetic, atmospheric, minimalist, raw, nostalgic, elegant, chaotic, ethereal, tactile, visceral, contemplative, playful, precise, organic, geometric, luminous, textural, rhythmic, fluid, stark, delicate, bold, surreal, meditative, dynamic
   - This enables cross-disciplinary discovery

4. ACTION TAG (optional): Verb/gerund if content is process-oriented
   - Examples: "learning", "building", "designing"
   - Format: gerund form (-ing)

RULES:
- Total: 3-5 tags only
- All lowercase, use hyphens for multi-word
- Quality tag is MANDATORY
- Prefer specific over generic

Return JSON:
{"tags": ["entity", "concept1", "concept2", "quality"], "categories": {"entity": "...", "concepts": [...], "quality": "...", "action": null}}`
}

/**
 * Variant C: Chain-of-Thought Reasoning
 *
 * Guides the model through step-by-step analysis.
 */
export const COT_PROMPT: Variant = {
  name: 'cot',
  description: 'Chain-of-thought reasoning for systematic tag generation',
  template: `You are tagging content for a cross-disciplinary discovery system. Think step-by-step:

CONTENT:
Platform: {platform}
Title: {title}
Content: {content}
URL: {url}

STEP 1: What is the core essence/identity of this content?
- Identify 1-2 specific noun phrases or named entities
- Examples: "bmw-m3", "terence-tao", "react-hooks"

STEP 2: What broader fields/subjects does it relate to?
- Identify 1-2 domain/subject areas
- Examples: "automotive", "mathematics", "web-development"

STEP 3: What aesthetic/emotional quality best describes it?
- Choose EXACTLY ONE from this vocabulary:
  kinetic, atmospheric, minimalist, raw, nostalgic, elegant, chaotic, ethereal, tactile, visceral, contemplative, playful, precise, organic, geometric, luminous, textural, rhythmic, fluid, stark, delicate, bold, surreal, meditative, dynamic

STEP 4: Based on steps 1-3, what are the final 3-5 tags?
- Combine specific identifiers + domains + quality
- Format: lowercase-with-hyphens

Return JSON with reasoning:
{
  "step1_essence": "core identity analysis",
  "step2_fields": "broader domains",
  "step3_quality": "aesthetic/mood choice",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.85
}`
}

/**
 * Variant D: Platform-Aware Context
 *
 * Adapts tagging strategy based on source platform.
 */
export const PLATFORM_PROMPT: Variant = {
  name: 'platform',
  description: 'Platform-specific tagging guidelines',
  template: `Generate discovery tags for {platform} content:

CONTENT:
Title: {title}
Content: {content}
URL: {url}

PLATFORM-SPECIFIC GUIDELINES:
- Instagram: Focus on visual aesthetics, design patterns, creator identity
- Twitter: Focus on ideas, discourse, personality, thread themes
- Reddit: Focus on community, discussion topics, subreddit culture
- IMDB/Letterboxd: Focus on genre, director, cinematic qualities, themes
- YouTube: Focus on creator, format (tutorial/vlog/review), subject matter
- GitHub: Focus on tech stack, programming concepts, tools
- Medium/Blog: Focus on subject matter, writing style, author expertise

TAG STRUCTURE (3-5 tags total):
1. SPECIFIC IDENTIFIERS (1-2):
   - Named entities (people, brands, tools)
   - Specific concepts unique to this content
   - Examples: "nextjs", "christopher-nolan", "figma"

2. BROADER CATEGORIES (1-2):
   - Subject domains
   - Field of study or practice
   - Examples: "web-development", "filmmaking", "design"

3. VIBE/AESTHETIC (1 - MANDATORY):
   - Choose from: kinetic, atmospheric, minimalist, raw, nostalgic, elegant, chaotic, ethereal, tactile, visceral, contemplative, playful, precise, organic, geometric, luminous, textural, rhythmic, fluid, stark, delicate, bold, surreal, meditative, dynamic

RULES:
- All lowercase, hyphenated multi-words
- No generic platform names as tags (e.g., don't tag "instagram")
- Focus on discoverable, searchable terms
- Quality/vibe tag enables cross-platform connections

Return JSON:
{"tags": ["tag1", "tag2", "tag3"], "platform_context": "brief note on platform-specific choices"}`
}

/**
 * All prompt variants for iteration
 */
export const variants = [
  BASELINE_PROMPT,
  LEXICAL_PROMPT,
  COT_PROMPT,
  PLATFORM_PROMPT
]

/**
 * Helper to fill in template variables
 */
export function fillTemplate(
  variant: Variant,
  data: {
    platform: string
    title: string
    content: string
    url: string
  }
): string {
  return variant.template
    .replace(/{platform}/g, data.platform || 'unknown')
    .replace(/{title}/g, data.title || 'Untitled')
    .replace(/{content}/g, (data.content || '').slice(0, 800))
    .replace(/{url}/g, data.url || 'No URL')
}
