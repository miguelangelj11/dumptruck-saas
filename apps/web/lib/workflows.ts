import type { SupabaseClient } from '@supabase/supabase-js'

// Workflow 1: After a ticket (load) is saved, link it to today's active dispatch for that driver
export async function linkTicketToDispatch(
  loadId: string,
  driverName: string,
  loadDate: string,
  supabase: SupabaseClient
): Promise<{ linked: boolean; dispatchId?: string }> {
  const { data: dispatch, error } = await supabase
    .from('dispatches')
    .select('id, loads_completed, first_ticket_at')
    .eq('driver_name', driverName)
    .eq('dispatch_date', loadDate)
    .not('status', 'in', '(completed)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !dispatch) return { linked: false }

  // Set dispatch_id on load (column may not exist yet — fail silently)
  await supabase.from('loads').update({ dispatch_id: dispatch.id }).eq('id', loadId)

  const isFirstTicket = !dispatch.first_ticket_at && (dispatch.loads_completed ?? 0) === 0
  await supabase
    .from('dispatches')
    .update({
      status: 'working',
      loads_completed: (dispatch.loads_completed ?? 0) + 1,
      updated_at: new Date().toISOString(),
      ...(isFirstTicket ? { first_ticket_at: new Date().toISOString() } : {}),
    })
    .eq('id', dispatch.id)

  return { linked: true, dispatchId: dispatch.id }
}

// Shared: insert a row into activity_feed (silently skip if table doesn't exist)
export async function logActivity(
  companyId: string,
  type: string,
  message: string,
  relatedId: string | null,
  relatedType: string | null,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from('activity_feed').insert({
    company_id: companyId,
    type,
    message,
    related_id: relatedId,
    related_type: relatedType,
  })
  // Ignore error — table may not exist until user runs SQL migration
}

// Workflow 2: Approve a ticket and log the action.
// For driver-submitted tickets linked to a dispatch, increments loads_completed.
export async function approveTicket(
  load: { id: string; job_name: string; driver_name: string },
  companyId: string,
  supabase: SupabaseClient
): Promise<{ error: string | null }> {
  // Fetch dispatch linkage before updating
  const { data: fullLoad } = await supabase
    .from('loads')
    .select('dispatch_id, source')
    .eq('id', load.id)
    .maybeSingle()

  const { error } = await supabase
    .from('loads')
    .update({ status: 'approved' })
    .eq('id', load.id)

  if (error) return { error: error.message }

  // If this is a driver-submitted ticket linked to a dispatch, update the dispatch
  if (fullLoad?.source === 'driver' && fullLoad?.dispatch_id) {
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('loads_completed, status')
      .eq('id', fullLoad.dispatch_id)
      .maybeSingle()

    if (dispatch) {
      const updates: Record<string, unknown> = {
        loads_completed: (dispatch.loads_completed ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }
      if (dispatch.status === 'accepted') {
        updates.status = 'working'
        updates.first_ticket_at = new Date().toISOString()
      }
      await supabase.from('dispatches').update(updates).eq('id', fullLoad.dispatch_id)
    }
  }

  await logActivity(
    companyId,
    'ticket_approved',
    `Approved: ${load.job_name} — ${load.driver_name}`,
    load.id,
    'load',
    supabase
  )

  return { error: null }
}

// Workflow 5: Log a dispatch event (called from dispatch page)
export async function logDispatchActivity(
  companyId: string,
  driverName: string,
  jobName: string,
  dispatchId: string,
  supabase: SupabaseClient
): Promise<void> {
  await logActivity(
    companyId,
    'dispatch_created',
    `Dispatched ${driverName} to ${jobName}`,
    dispatchId,
    'dispatch',
    supabase
  )
}
