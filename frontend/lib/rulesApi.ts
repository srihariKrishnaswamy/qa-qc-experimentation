/**
 * Rules API: extract (PDF → Rule Library) and verify (image + rule).
 * Uses same-origin Next.js API routes so the app can be deployed on Vercel only.
 */

import { pdfToImages } from './pdfToImages'

/** SessionStorage key for rules returned by the pipeline (extract). */
export const PIPELINE_RULES_STORAGE_KEY = 'pipeline-rules'

export type RuleLibrary = unknown

export type ProcessSpecPdfResult = {
  rules: RuleLibrary
}

/**
 * Convert PDF to images in the browser, then call /api/rules/extract.
 * Use from client only (e.g. UploadSpecbook).
 * Pass optional signal to abort (e.g. from AbortController).
 */
export async function processSpecPdf(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<ProcessSpecPdfResult> {
  const images = await pdfToImages(file)
  const response = await fetch('/api/rules/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const json = JSON.parse(text) as { detail?: string }
      detail = json.detail ?? text
    } catch {
      // use text as-is
    }
    throw new Error(detail || `Rules API error: ${response.status}`)
  }

  const data = (await response.json()) as ProcessSpecPdfResult
  return data
}

export type RuleForVerify = {
  rule?: string | null
  dimension?: string | null
  shall_statement?: string | null
  source_page?: string | null
}

export type VerifyRuleResult = {
  verified: boolean
  message: string
}

/**
 * Send an image and rule to /api/verify for compliance verification (Gemini vision).
 */
export async function verifyRule(
  imageFile: File,
  rule: RuleForVerify
): Promise<VerifyRuleResult> {
  const formData = new FormData()
  formData.append('file', imageFile)
  formData.append('rule', JSON.stringify(rule))

  const response = await fetch('/api/verify', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const j = JSON.parse(text) as { detail?: string }
      detail = j.detail ?? text
    } catch {
      // use text as-is
    }
    throw new Error(detail || `Verification failed: ${response.status}`)
  }

  const data = (await response.json()) as VerifyRuleResult
  return data
}
