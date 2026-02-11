/**
 * Verify a single photo against a rule using Gemini vision. Used by API route.
 */

import { generateWithImage } from './gemini'

export type RuleForVerify = {
  rule?: string | null
  dimension?: string | null
  shall_statement?: string | null
}

export type VerifyResult = { verified: boolean; message: string }

function buildRuleText(rule: RuleForVerify): string {
  const parts = [
    (rule.rule ?? '').trim(),
    rule.dimension ? `Dimension: ${rule.dimension}` : '',
    rule.shall_statement ? `Shall: ${rule.shall_statement}` : '',
  ].filter(Boolean)
  return parts.join(' | ') || 'No rule text provided.'
}

const VERIFY_PROMPT = `You are a construction QA inspector. Look at this single photo of a construction installation.

Rule to verify: {{RULE_TEXT}}

Answer with exactly two lines:
Line 1: YES or NO (does this photo show compliance with the rule?)
Line 2: One short reason (e.g. "Nails at 8\\" spacing visible" or "Cannot confirm dimension from photo").`

export async function verifyRuleWithImage(
  imageBase64: string,
  mimeType: string,
  rule: RuleForVerify
): Promise<VerifyResult> {
  const ruleText = buildRuleText(rule)
  const prompt = VERIFY_PROMPT.replace('{{RULE_TEXT}}', ruleText)
  const text = await generateWithImage(prompt, imageBase64, mimeType)
  const firstLine = text.trim().split('\n')[0]?.toUpperCase() ?? ''
  const verified = firstLine.includes('YES')
  return { verified, message: text.trim() }
}
