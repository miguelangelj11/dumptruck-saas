import { createClient } from '@/lib/supabase/client'

let cached: string | null = null

export async function getCompanyId(): Promise<string | null> {
  if (cached) return cached

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[getCompanyId] auth error:', authError.message)
    return null
  }
  if (!user) {
    console.warn('[getCompanyId] no authenticated user')
    return null
  }

  // Look up existing company
  const { data: existing, error: fetchError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    console.error('[getCompanyId] fetch error:', fetchError.message, '| user:', user.id)
  }

  if (existing?.id) {
    cached = existing.id
    return cached
  }

  // No company found — create one automatically
  console.warn('[getCompanyId] no company for user', user.id, '— creating one now')
  const name = user.user_metadata?.company_name ?? user.email ?? 'My Company'
  const { data: created, error: createError } = await supabase
    .from('companies')
    .insert({ owner_id: user.id, name })
    .select('id')
    .maybeSingle()

  if (createError) {
    console.error('[getCompanyId] create error:', createError.message)
    return null
  }

  cached = created?.id ?? null
  return cached
}

export function clearCompanyIdCache() {
  cached = null
}
