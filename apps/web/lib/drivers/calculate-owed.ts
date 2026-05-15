import type { Driver } from '@/lib/types'

type TicketLike = {
  driver_paid?: boolean | null
  status?: string | null
  loads_count?: number | null
  hours_worked?: string | null
  tons?: number | null
  total_pay?: number | null
  rate?: number | null
}

// The form stores the percentage in pay_rate_value for percent_revenue drivers.
// pay_percent may be populated from older code paths, so we accept either.
function resolvePercent(driver: Partial<Driver>): number {
  return driver.pay_percent ?? driver.pay_rate_value ?? 0
}

/** Earnings from tickets where the client has already paid (status = 'paid') */
export function calculateDriverEarned(tickets: TicketLike[], driver: Partial<Driver>): number {
  if (!driver.pay_type) return 0
  const pct = resolvePercent(driver)
  if (driver.pay_type === 'percent_revenue' && pct <= 0) return 0
  if (driver.pay_type !== 'percent_revenue' && (!driver.pay_rate_value || driver.pay_rate_value <= 0)) return 0

  return tickets.reduce((total, ticket) => {
    switch (driver.pay_type) {
      case 'per_load':
        return total + driver.pay_rate_value! * (ticket.loads_count ?? 1)
      case 'per_hour':
        return total + driver.pay_rate_value! * (parseFloat(ticket.hours_worked ?? '') || 0)
      case 'per_ton':
        return total + driver.pay_rate_value! * (ticket.tons ?? 0)
      case 'percent_revenue':
        return total + (ticket.total_pay ?? ticket.rate ?? 0) * (pct / 100)
      case 'day_rate':
        return total + driver.pay_rate_value!
      default:
        return total
    }
  }, 0)
}

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
      case 'per_load': {
        const loads = ticket.loads_count ?? 1
        return total + driver.pay_rate_value! * loads
      }
      case 'per_hour': {
        const hours = parseFloat(ticket.hours_worked ?? '') || 0
        return total + driver.pay_rate_value! * hours
      }
      case 'per_ton': {
        const tons = ticket.tons ?? 0
        return total + driver.pay_rate_value! * tons
      }
      case 'percent_revenue': {
        const revenue = ticket.total_pay ?? ticket.rate ?? 0
        return total + revenue * (pct / 100)
      }
      case 'day_rate':
        return total + driver.pay_rate_value!
      default:
        return total
    }
  }, 0)
}
