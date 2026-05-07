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

// ── JSON extraction with multiple fallback strategies ──────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  const attempts = [
    // 1. Direct parse
    () => JSON.parse(text),
    // 2. Strip markdown fences then parse
    () => JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()),
    // 3. Grab first {...} block (greedy)
    () => { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('no match'); return JSON.parse(m[0]) },
    // 4. Grab JSON inside a code fence
    () => { const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i); if (!m?.[1]) throw new Error('no match'); return JSON.parse(m[1]) },
  ]
  for (const fn of attempts) {
    try { return fn() } catch { /* try next */ }
  }
  return null
}

// ── Single Claude call ─────────────────────────────────────────────────────

async function callClaude(
  anthropic: Anthropic,
  documentBase64: string,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const isPdf = mimeType === 'application/pdf'

  // Build content blocks typed to satisfy the SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docBlock: any = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: documentBase64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,          data: documentBase64 } }

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role:    'user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [docBlock, { type: 'text', text: EXTRACTION_PROMPT }] as any,
    }],
  })

  const firstBlock = response.content[0]
  const text = firstBlock?.type === 'text' ? firstBlock.text : ''

  console.log('[extract-document] raw response preview:', text.slice(0, 300))

  const extracted = extractJSON(text)
  if (!extracted) {
    console.error('[extract-document] JSON parse failed. Full response:', text)
    throw Object.assign(new Error('Failed to parse AI response as JSON'), { raw: text })
  }

  if (!extracted.rows || !Array.isArray(extracted.rows)) {
    console.error('[extract-document] No rows array in response:', JSON.stringify(extracted).slice(0, 300))
    throw new Error('No data rows found in document')
  }

  return extracted
}

// ── Route handler ─────────────────────────────────────────────────────────

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
    console.error('[extract-document] ANTHROPIC_API_KEY not set')
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

  // ~5 MB base64 guard (~3.75 MB raw)
  if (documentBase64.length > 5_500_000) {
    return NextResponse.json({ error: 'File too large — please upload a document under 4 MB' }, { status: 413 })
  }

  // Verify company ownership
  if (companyId) {
    const { data: co } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle()
    if (!co) return NextResponse.json({ error: 'Company not found' }, { status: 403 })
  }

  console.log('[extract-document] starting extraction — mimeType:', mimeType, 'base64 length:', documentBase64.length)

  const anthropic = new Anthropic({ apiKey })

  // Retry once on transient failure
  let lastErr: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const extracted = await callClaude(anthropic, documentBase64, mimeType)
      console.log('[extract-document] success — rows:', (extracted.rows as unknown[]).length)
      return NextResponse.json({ success: true, data: extracted })
    } catch (err: unknown) {
      lastErr = err
      const isTransient = (err as { status?: number })?.status === 529 ||
                          (err as { status?: number })?.status === 503 ||
                          (err instanceof Error && err.message.includes('overloaded'))
      if (attempt < 2 && isTransient) {
        console.warn('[extract-document] transient error on attempt', attempt, '— retrying in 2s')
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      break
    }
  }

  // Surface the real error
  const err = lastErr as { message?: string; status?: number; raw?: string }
  console.error('[extract-document] final error:', err?.message ?? lastErr)

  const clientMessage = err?.message?.includes('parse')
    ? 'Could not read the document structure — try a clearer image or PDF'
    : err?.message?.includes('No data rows')
    ? 'No ticket data found — make sure the document contains haul or load records'
    : 'AI extraction failed — try again or use a clearer document'

  return NextResponse.json(
    { error: clientMessage, details: err?.message },
    { status: 500 }
  )
}
