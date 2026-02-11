import { NextResponse } from 'next/server'
import { extractRulesFromImages } from '@/services/extractRules'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const images = body.images as Array<{ base64: string; mimeType: string }> | undefined
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { detail: 'Request body must include an array of images: { images: [{ base64, mimeType }] }' },
        { status: 400 }
      )
    }
    const rules = await extractRulesFromImages(images)
    return NextResponse.json({ rules })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Extraction failed'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
