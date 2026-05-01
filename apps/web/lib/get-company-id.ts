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

  // Check if user owns a company
  const { data: owned, error: ownedError } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (ownedError) {
    console.error('[getCompanyId] owned lookup error:', ownedError.message)
  }

  if (owned?.id) {
    cached = owned.id
    return cached
  }

  // Fallback: invited team members look up their company via team_members
  const { data: memberRow, error: memberError } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) {
    console.error('[getCompanyId] team_members lookup error:', memberError.message)
  }

  if (memberRow?.company_id) {
    cached = memberRow.company_id
    return cached
  }

  console.warn('[getCompanyId] no company found for user', user.id)
  return null
}

export function clearCompanyIdCache() {
  cached = null
}
