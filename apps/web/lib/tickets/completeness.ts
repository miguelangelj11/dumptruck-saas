export const computeCompletenessScore = (ticket: Record<string, unknown>): {
  score: number
  missing: string[]
  status: 'complete' | 'warning' | 'incomplete'
} => {
  const missing: string[] = []

  if (!ticket.image_url && !ticket.photo_url) missing.push('Photo')
  if (!ticket.origin || ticket.origin === '?' || ticket.origin === '') missing.push('Origin')
  if (!ticket.destination || ticket.destination === '?' || ticket.destination === '') missing.push('Destination')
  if (!ticket.total_pay || (ticket.total_pay as number) <= 0) missing.push('Total Pay')
  if (!ticket.date) missing.push('Date')
  if (!ticket.driver_name) missing.push('Driver')
  if (!ticket.truck_number) missing.push('Truck #')

  const warnings: string[] = []
  if (!ticket.ticket_number) warnings.push('Ticket #')
  if (!ticket.tons && !ticket.loads) warnings.push('Tons/Loads')
  if (!ticket.job_name) warnings.push('Job Name')

  const score = Math.max(0, 100 - missing.length * 14 - warnings.length * 3)
  const status = missing.length >= 2 ? 'incomplete'
    : missing.length >= 1 || warnings.length >= 2 ? 'warning'
    : 'complete'

  return { score, missing: [...missing, ...warnings], status }
}

export const COMPLETENESS_BADGE = {
  complete:   { icon: '✅', color: 'text-green-600 bg-green-50',  label: 'Complete'     },
  warning:    { icon: '⚠️', color: 'text-amber-600 bg-amber-50',  label: 'Incomplete'   },
  incomplete: { icon: '🔴', color: 'text-red-600 bg-red-50',      label: 'Missing Data' },
} as const

export const INVOICE_BLOCKING_FIELDS = ['Photo', 'Origin', 'Destination', 'Total Pay']
