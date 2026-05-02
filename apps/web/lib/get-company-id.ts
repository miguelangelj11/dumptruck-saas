import { createClient } from '@/lib/supabase/client'

let cached: string | null = null

export async function getCompanyId(): Promise<string | null> {
  if (cached) return cached

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Profiles table — works for both owners and team members
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.organization_id) {
    cached = profile.organization_id
    return cached
  }

  // 2. Fallback: owner lookup (profiles table not yet populated)
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (company?.id) {
    cached = company.id
    return cached
  }

  // 3. Fallback: team_members lookup
  const { data: membership } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.company_id) {
    cached = membership.company_id
    return cached
  }

  return null
}

export function clearCompanyIdCache() {
  cached = null
}
