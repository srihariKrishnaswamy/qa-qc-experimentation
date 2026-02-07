/**
 * Service to call the Rules API (FastAPI backend) for PDF → Rule Library extraction.
 * No Amplify/AppSync — only the backend endpoint.
 */

const RULES_API_URL =
  process.env.NEXT_PUBLIC_RULES_API_URL ?? 'http://localhost:8000'

/** SessionStorage key for rules returned by the pipeline backend (not listener/AppSync). */
export const PIPELINE_RULES_STORAGE_KEY = 'pipeline-rules'

export type RuleLibrary = unknown

export type ProcessSpecPdfResult = {
  rules: RuleLibrary
}

/**
 * Upload a spec PDF to the pipeline backend and return the extracted Rule Library.
 * POST /api/rules/extract with multipart/form-data.
 */
export async function processSpecPdf(file: File): Promise<ProcessSpecPdfResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${RULES_API_URL}/api/rules/extract`, {
    method: 'POST',
    body: formData,
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
