/**
 * Gemini client for server-side use (API routes). Keep GEMINI_API_KEY in env.
 */

import { GoogleGenAI } from '@google/genai'

const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it in Vercel env or .env.local.')
  }
  return new GoogleGenAI({ apiKey })
}

export type ImagePart = {
  inlineData: {
    data: string // base64
    mimeType: string
  }
}

/**
 * Generate content with text prompt and optional image parts (base64).
 */
export async function generateWithImages(
  prompt: string,
  images: { base64: string; mimeType: string }[]
): Promise<string> {
  const ai = getClient()
  const parts: Array<{ text: string } | ImagePart> = [{ text: prompt }]
  for (const img of images) {
    parts.push({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    })
  }
  const response = await ai.models.generateContent({
    model,
    contents: parts,
  })
  return response.text ?? ''
}

/**
 * Generate content with a single image (for verification).
 */
export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const ai = getClient()
  const response = await ai.models.generateContent({
    model,
    contents: [
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } },
    ],
  })
  return response.text ?? ''
}
