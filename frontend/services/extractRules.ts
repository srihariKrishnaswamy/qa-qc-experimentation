/**
 * Extract construction rules from spec page images using Gemini. Used by API route.
 */

import { generateWithImages } from './gemini'

const EXTRACTION_PROMPT = `You are a Senior Construction Manager. Look at these spec book pages (images) and extract any quality rules, dimensions, or 'shall' statements into a JSON list.
Return ONLY valid JSON: an array of objects. Each object must have these fields: 'rule' (short description), 'dimension' (if any), 'source_page' (the exact page/section NUMBER as shown on the page—e.g. from the footer or corner, often in a format like '00 72 13 - 1' or similar section-based identifier; use that exact value as a string; do NOT use the word 'specifications' or a sequential 1,2,3...), 'shall_statement' (exact or paraphrased 'shall' text).
Do not include any text outside the JSON.`

export type RuleItem = {
  rule?: string | null
  dimension?: string | null
  source_page?: string | null
  shall_statement?: string | null
}

export type ExtractRulesResult = RuleItem[] | { raw: string }

export async function extractRulesFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<ExtractRulesResult> {
  if (images.length === 0) {
    return []
  }
  const text = await generateWithImages(EXTRACTION_PROMPT, images)

  let stripped = text.trim()
  if (stripped.startsWith('```')) {
    const firstLine = stripped.split('\n')[0] ?? ''
    stripped = stripped.slice(firstLine.length).trim()
    if (stripped.endsWith('```')) {
      stripped = stripped.slice(0, -3).trim()
    }
  }

  if (stripped.startsWith('{') || stripped.startsWith('[')) {
    const start = stripped.indexOf('[') >= 0 ? stripped.indexOf('[') : stripped.indexOf('{')
    const end = stripped.includes(']') ? stripped.lastIndexOf(']') + 1 : stripped.lastIndexOf('}') + 1
    if (end > start) {
      try {
        return JSON.parse(stripped.slice(start, end)) as RuleItem[]
      } catch {
        // fall through
      }
    }
  }
  return { raw: text }
}
