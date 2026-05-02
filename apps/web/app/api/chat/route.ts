import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a helpful support assistant for DumpTruckBoss, a dispatch and invoicing platform built for dump truck and hauling companies. You help users understand how to use the platform including: creating dispatches, managing drivers, submitting tickets, generating invoices, tracking revenue, managing settings, and onboarding new team members. Keep answers concise, friendly, and practical. If you don't know something, direct them to contact support.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const { data: co } = profile?.organization_id
    ? await supabase.from('companies').select('plan').eq('id', profile.organization_id).maybeSingle()
    : { data: null }

  if (co?.plan !== 'enterprise') {
    return NextResponse.json({ error: 'Enterprise plan required' }, { status: 403 })
  }

  const rl = checkRateLimit(`chat:${user.id}`, LIMITS.chat)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before sending more messages.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const body = await req.json()
  const messages: { role: 'user' | 'assistant'; content: string }[] = body.messages ?? []

  if (!messages.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ message: text })
}
