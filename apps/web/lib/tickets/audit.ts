import type { SupabaseClient } from '@supabase/supabase-js'

export const logTicketAudit = async (
  supabase: SupabaseClient,
  params: {
    companyId: string
    loadId: string
    action: 'created' | 'edited' | 'status_changed' | 'photo_added' | 'approved'
    userId: string
    userName: string
    userType: 'office' | 'driver' | 'ai' | 'system'
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }
): Promise<void> => {
  await supabase.from('ticket_audit_trail').insert({
    company_id:        params.companyId,
    load_id:           params.loadId,
    action:            params.action,
    changed_by:        params.userId,
    changed_by_name:   params.userName,
    changed_by_type:   params.userType,
    old_values:        params.oldValues ?? null,
    new_values:        params.newValues ?? null,
  })
}
