import { NextResponse } from 'next/server'
import { verifyRuleWithImage } from '@/services/verifyRule'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ruleStr = formData.get('rule') as string | null
    if (!file || !ruleStr) {
      return NextResponse.json(
        { detail: 'Request must include form fields: file (image), rule (JSON string)' },
        { status: 400 }
      )
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ detail: 'File must be an image' }, { status: 400 })
    }
    let rule: { rule?: string; dimension?: string; shall_statement?: string }
    try {
      rule = JSON.parse(ruleStr) as typeof rule
    } catch {
      return NextResponse.json({ detail: 'Invalid rule JSON' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const result = await verifyRuleWithImage(base64, mimeType, rule)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verification failed'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
