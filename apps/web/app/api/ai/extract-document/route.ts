import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const EXTRACTION_PROMPT = `You are an expert at reading trucking and hauling industry documents.
Analyze this document and extract ALL work/load data rows into structured JSON.

This document may be one of:
- Broker pay sheet / settlement report
- Daily shift summary
- Asphalt haul report
- Driver earnings summary
- Load manifest
- End-of-day production report

Extract every row of work/load data you find.
For each row extract these fields (use null if not found):
- date (YYYY-MM-DD format)
- truck_number (string)
- driver_name (string)
- job_name (string — site name or project name)
- project_number (string)
- broker_name (string — broker or client company name)
- material (string — dirt/gravel/sand/asphalt/millings/etc)
- phase (string — project phase if present)
- loads (integer count of loads)
- tons (decimal — total tonnage)
- hours (decimal — total hours)
- rate (decimal — dollar rate amount)
- rate_type (one of: per_load, per_hour, per_ton — infer from context)
- estimated_amount (decimal — total dollar amount for this row)
- shift (string — Day/Night/Morning/Evening/AM/PM)
- ticket_number (string)
- start_time (string — HH:MM AM/PM format)
- end_time (string — HH:MM AM/PM format)
- confidence (decimal 0.0–1.0 — how confident you are in this row's accuracy)
- needs_review (boolean — true if confidence < 0.8 or data seems inconsistent or incomplete)

Also extract document-level metadata:
- document_type (string — what kind of document)
- company_name (string — company on the document)
- broker_name (string — broker/client company)
- report_date (string — overall date or date range)
- total_loads (integer)
- total_tons (decimal)
- total_amount (decimal)

Return ONLY valid JSON — no markdown, no explanation, just the JSON object:
{
  "document_type": "Broker Pay Sheet",
  "company_name": "...",
  "broker_name": "...",
  "report_date": "2026-05-01 to 2026-05-07",
  "total_loads": 12,
  "total_tons": 234.5,
  "total_amount": 2890.00,
  "rows": [
    {
      "confidence": 0.95,
      "needs_review": false,
      "date": "2026-05-05",
      "truck_number": "T-12",
      "driver_name": "Jake Morrison",
      "job_name": "Hwy 290 Overlay",
      "project_number": null,
      "broker_name": "Vulcan Materials",
      "material": "Asphalt",
      "phase": null,
      "loads": 3,
      "tons": 58.22,
      "hours": 7.5,
      "rate": 114.80,
      "rate_type": "per_load",
      "estimated_amount": 344.40,
      "shift": "Night",
      "ticket_number": "2605050072",
      "start_time": "8:00 PM",
      "end_time": "3:23 AM"
    }
  ]
}`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(`docExtract:${user.id}`, LIMITS.docExtract)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many extraction requests — try again later' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
  }

  let body: { documentBase64?: string; mimeType?: string; companyId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { documentBase64, mimeType, companyId } = body
  if (!documentBase64 || !mimeType) {
    return NextResponse.json({ error: 'documentBase64 and mimeType are required' }, { status: 400 })
  }

  // Verify company ownership
  if (companyId) {
    const { data: co } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle()
    if (!co) return NextResponse.json({ error: 'Company not found' }, { status: 403 })
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const isPdf = mimeType === 'application/pdf'

    type ContentBlock =
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'text'; text: string }

    const docBlock: ContentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: documentBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: documentBase64 } }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [docBlock, { type: 'text', text: EXTRACTION_PROMPT }],
      }],
    })

    const firstBlock = response.content[0]
    const text = firstBlock?.type === 'text' ? firstBlock.text : ''
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(jsonMatch?.[0] ?? cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 422 })
    }

    if (!extracted.rows || !Array.isArray(extracted.rows)) {
      return NextResponse.json({ error: 'No data rows found in document' }, { status: 422 })
    }

    return NextResponse.json({ success: true, data: extracted })
  } catch (err) {
    console.error('[extract-document] error:', err)
    return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 })
  }
}
