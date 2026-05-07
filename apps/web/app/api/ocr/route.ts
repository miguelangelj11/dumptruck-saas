import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  // Auth check — OCR calls Anthropic API which costs money; must be authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit — 30 OCR scans per hour per user
  const rl = await checkRateLimit(`ocr:${user.id}`, LIMITS.ocr)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many OCR requests — try again later' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Upload a JPEG, PNG, or WebP image.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Realistic mock response when no API key
      return NextResponse.json({
        ok: true,
        mock: true,
        fields: {
          ticket_number: null,
          tonnage: null,
          date: new Date().toISOString().split('T')[0],
          job_name: null,
          material: null,
          truck_number: null,
        },
        confidence: 0,
        message: 'OCR unavailable — fill fields manually',
      })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a dump truck load ticket or weight slip. Extract these fields and return ONLY valid JSON, nothing else:
{
  "ticket_number": "string or null",
  "tonnage": "number or null (net weight in tons)",
  "date": "YYYY-MM-DD or null",
  "job_name": "string or null (job site name if visible)",
  "material": "string or null (dirt/gravel/sand/asphalt/etc)",
  "truck_number": "string or null",
  "confidence": "number 0-100 (how confident you are in the extraction)"
}
If a field is not visible or unclear, use null. Date should be in YYYY-MM-DD format.`,
          },
        ],
      }],
    })

    const raw = (response.content[0] as { text: string }).text.trim()

    let parsed: Record<string, unknown>
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] ?? raw)
    } catch {
      return NextResponse.json({ ok: false, error: 'Could not parse OCR response', raw })
    }

    return NextResponse.json({
      ok: true,
      mock: false,
      fields: {
        ticket_number: parsed.ticket_number ?? null,
        tonnage:       parsed.tonnage ?? null,
        date:          parsed.date ?? null,
        job_name:      parsed.job_name ?? null,
        material:      parsed.material ?? null,
        truck_number:  parsed.truck_number ?? null,
      },
      confidence: Number(parsed.confidence ?? 0),
    })
  } catch (err) {
    console.error('[ocr] error:', err)
    return NextResponse.json({ ok: false, error: 'OCR failed' }, { status: 500 })
  }
}
