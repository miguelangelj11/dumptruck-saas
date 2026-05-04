/**
 * Single source of truth for resolving a user's company ID on the server.
 *
 * Resolution order (fastest first):
 * 1. profiles.organization_id  — O(1) primary-key lookup, populated on signup
 * 2. companies.owner_id        — O(log n) with index, fallback for legacy rows
 * 3. team_members.user_id      — O(log n) with index, fallback for team members
 *
 * Use this in every API route instead of writing the waterfall inline.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export async function resolveCompanyId(
  userId: string,
  admin: SupabaseClient,
): Promise<string | null> {
  // 1. Fastest path — profiles row is always written on signup
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.organization_id) return profile.organization_id

  // 2. Owner fallback — handles accounts created before profile backfill
  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (company?.id) {
    // Backfill profile so next request hits fast path
    await admin
      .from('profiles')
      .upsert({ id: userId, organization_id: company.id }, { onConflict: 'id' })
    return company.id
  }

  // 3. Team-member fallback
  const { data: membership } = await admin
    .from('team_members')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (membership?.company_id) {
    await admin
      .from('profiles')
      .upsert({ id: userId, organization_id: membership.company_id }, { onConflict: 'id' })
    return membership.company_id
  }

  return null
}
