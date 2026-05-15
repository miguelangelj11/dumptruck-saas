import type { Driver } from '@/lib/types'

type TicketLike = {
  driver_paid?: boolean | null
  status?: string | null
  original_loads?: number | null
  rate_quantity?: number | null
  hours_worked?: string | null
  total_pay?: number | null
  rate?: number | null
  rate_type?: string | null
}

// pay_percent is stored as 0 (not null) when the percentage is saved in pay_rate_value.
// Use || so that 0 falls through to pay_rate_value.
function resolvePercent(driver: Partial<Driver>): number {
  return driver.pay_percent || driver.pay_rate_value || 0
}

// Hours can be in hours_worked (text) or rate_quantity (numeric) depending on how the
// ticket was created. rate_quantity is the authoritative source for quantity-based tickets.
function resolveQuantity(ticket: TicketLike): number {
  return ticket.rate_quantity ?? (parseFloat(ticket.hours_worked ?? '') || 0)
}

function resolveLoads(ticket: TicketLike): number {
  return ticket.original_loads ?? ticket.rate_quantity ?? 1
}

/** Driver's cut from tickets where the client invoice has been paid (status = 'paid') */
export function calculateDriverEarned(tickets: TicketLike[], driver: Partial<Driver>): number {
  if (!driver.pay_type) return 0
  const pct = resolvePercent(driver)
  if (driver.pay_type === 'percent_revenue' && pct <= 0) return 0
  if (driver.pay_type !== 'percent_revenue' && (!driver.pay_rate_value || driver.pay_rate_value <= 0)) return 0

  return tickets.reduce((total, ticket) => {
    switch (driver.pay_type) {
      case 'per_load':
        return total + driver.pay_rate_value! * resolveLoads(ticket)
      case 'per_hour':
        return total + driver.pay_rate_value! * resolveQuantity(ticket)
      case 'per_ton':
        return total + driver.pay_rate_value! * resolveQuantity(ticket)
      case 'percent_revenue':
        return total + (ticket.total_pay ?? ticket.rate ?? 0) * (pct / 100)
      case 'day_rate':
        return total + driver.pay_rate_value!
      default:
        return total
    }
  }, 0)
}

/** Driver's cut from tickets that haven't been paid to the driver yet */
export function calculateDriverOwed(tickets: TicketLike[], driver: Partial<Driver>): number {
  if (!driver.pay_type) return 0
  const pct = resolvePercent(driver)
  if (driver.pay_type === 'percent_revenue' && pct <= 0) return 0
  if (driver.pay_type !== 'percent_revenue' && (!driver.pay_rate_value || driver.pay_rate_value <= 0)) return 0

  const unpaid = tickets.filter(t =>
    !t.driver_paid &&
    ['pending', 'approved', 'invoiced'].includes(t.status ?? '')
  )

  return unpaid.reduce((total, ticket) => {
    switch (driver.pay_type) {
      case 'per_load':
        return total + driver.pay_rate_value! * resolveLoads(ticket)
      case 'per_hour':
        return total + driver.pay_rate_value! * resolveQuantity(ticket)
      case 'per_ton':
        return total + driver.pay_rate_value! * resolveQuantity(ticket)
      case 'percent_revenue':
        return total + (ticket.total_pay ?? ticket.rate ?? 0) * (pct / 100)
      case 'day_rate':
        return total + driver.pay_rate_value!
      default:
        return total
    }
  }, 0)
}
