import { createClient } from '@/lib/supabase/client'

let cached: string | null = null

export async function getCompanyId(): Promise<string | null> {
  if (cached) return cached

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.organization_id) {
    cached = profile.organization_id
    return cached
  }

  return null
}

export function clearCompanyIdCache() {
  cached = null
}
