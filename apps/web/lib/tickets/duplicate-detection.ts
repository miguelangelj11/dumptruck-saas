import type { SupabaseClient } from '@supabase/supabase-js'

export const checkForDuplicate = async (
  supabase: SupabaseClient,
  companyId: string,
  ticket: {
    driver_name: string
    date: string
    job_name: string
    tons?: number | null
    total_pay?: number | null
  }
): Promise<{ id: string } | null> => {
  const { data: similar } = await supabase
    .from('loads')
    .select('id, tons, total_pay, created_at')
    .eq('company_id', companyId)
    .eq('driver_name', ticket.driver_name)
    .eq('date', ticket.date)
    .eq('job_name', ticket.job_name)
    .limit(5)

  if (!similar?.length) return null

  if (ticket.tons && ticket.tons > 0) {
    const dup = (similar as { id: string; tons: number | null; total_pay: number | null }[]).find(s => {
      if (!s.tons) return false
      return Math.abs(s.tons - ticket.tons!) / ticket.tons! <= 0.1
    })
    if (dup) return dup
  }

  if (ticket.total_pay) {
    const exact = (similar as { id: string; tons: number | null; total_pay: number | null }[]).find(
      s => s.total_pay === ticket.total_pay
    )
    if (exact) return exact
  }

  return null
}

export const checkForAnomaly = async (
  supabase: SupabaseClient,
  companyId: string,
  driverName: string,
  newTons: number | null | undefined,
  _newTotalPay: number | null | undefined
): Promise<string | null> => {
  if (!newTons || newTons <= 0) return null

  const { data: history } = await supabase
    .from('loads')
    .select('tons')
    .eq('company_id', companyId)
    .eq('driver_name', driverName)
    .not('tons', 'is', null)
    .gt('tons', 0)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!history || history.length < 5) return null

  const avgTons = (history as { tons: number }[]).reduce((s, h) => s + h.tons, 0) / history.length
  const stdDev = Math.sqrt(
    (history as { tons: number }[]).reduce((s, h) => s + Math.pow(h.tons - avgTons, 2), 0) / history.length
  )
  const zScore = stdDev > 0 ? (newTons - avgTons) / stdDev : 0

  if (zScore > 2) {
    const pctAbove = ((newTons - avgTons) / avgTons * 100).toFixed(0)
    return `${newTons}T is ${pctAbove}% above ${driverName}'s average (${avgTons.toFixed(1)}T) — verify weight ticket`
  }
  return null
}
