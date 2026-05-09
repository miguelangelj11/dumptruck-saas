export const PLANS = {
  solo: {
    id: 'solo',
    name: 'Solo',
    price: 25,
    priceId: process.env.STRIPE_SOLO_PRICE_ID ?? '',
    description: 'Track your loads and get paid. Simple.',
    tagline: 'For the one-man operation — 1 truck, 1 driver',
    badge: null,
    limits: {
      trucks: 1,
      drivers: 1,
    },
    features: [
      '1 truck & 1 driver',
      'Ticket tracking (unlimited)',
      'Basic invoicing',
      'Basic dashboard',
      '7-day free trial',
    ],
    locked: [
      'Dispatching & job management',
      'Subcontractor management',
      'Revenue & profit tracking',
      'CRM Pipeline',
      'Team access',
    ],
  },
  owner_operator: {
    id: 'owner_operator',
    name: 'Owner Operator',
    price: 80,
    priceId: process.env.STRIPE_OWNER_PRICE_ID ?? '',
    description: 'Stay organized and get paid faster.',
    tagline: 'Perfect for solo operators with up to 5 trucks',
    badge: null,
    limits: {
      trucks: 5,
      drivers: 5,
    },
    features: [
      'Up to 5 trucks & 5 drivers',
      'Dispatching & job management',
      'Ticket tracking (unlimited)',
      'Basic invoicing',
      'Basic dashboard',
      'Driver management',
      'Client companies',
      '7-day free trial',
    ],
    locked: [
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation',
      'Auto invoice intelligence',
      'Profit tracking',
      'AI dispatch recommendations',
      'CRM Pipeline',
      'AI document reader',
      'Team access',
    ],
  },
  fleet: {
    id: 'fleet',
    name: 'Fleet',
    price: 200,
    priceId: process.env.STRIPE_FLEET_PRICE_ID ?? '',
    description: 'Run your entire operation and stop losing money every week.',
    tagline: 'For growing companies that need full control',
    badge: 'Most Popular',
    limits: {
      trucks: null,
      drivers: null,
    },
    features: [
      'Unlimited trucks & drivers',
      'Everything in Owner Operator',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Auto invoice intelligence',
      'Real-time dispatch board',
      'Driver zero-friction portal',
      'Basic profit tracking',
      'AI dispatch recommendations',
      'Overdue invoice automation',
      'Weekly performance reports',
      'Team access (unlimited users)',
      'Client portal',
      'AI document reader (50/mo)',
      '7-day free trial',
    ],
    locked: [
      'CRM Growth Pipeline',
      'Quote builder',
      'Advanced job profitability',
      'Customer insights',
      'Mobile ticket + signature',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 350,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID ?? process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '',
    description: 'Win more jobs and scale your revenue.',
    tagline: 'For operators ready to grow their business',
    badge: null,
    limits: {
      trucks: null,
      drivers: null,
    },
    features: [
      'Everything in Fleet',
      'CRM Growth Pipeline',
      'Lead & job tracking',
      'Quote builder',
      'Convert quotes → jobs → invoices',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Top clients & slow payer tracking',
      'Mobile ticket with signature capture',
      'AI document reader (400/mo)',
      'Documents hub',
      'Priority support',
      '7-day free trial',
    ],
    locked: [],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlan(planId: string) {
  return PLANS[planId as PlanId] ?? PLANS.owner_operator
}

export type FeatureKey =
  | 'subcontractors'
  | 'missing_ticket_detection'
  | 'follow_up_automation'
  | 'auto_invoice_intelligence'
  | 'realtime_dispatch'
  | 'driver_portal'
  | 'profit_tracking'
  | 'ai_dispatch'
  | 'overdue_automation'
  | 'weekly_reports'
  | 'crm_pipeline'
  | 'quote_builder'
  | 'advanced_profitability'
  | 'customer_insights'
  | 'mobile_ticket'
  | 'customer_invoicing'

export const FEATURE_GATES: Record<FeatureKey, PlanId[]> = {
  // Owner Operator + above
  realtime_dispatch: ['owner_operator', 'fleet', 'growth'],
  driver_portal:     ['owner_operator', 'fleet', 'growth'],

  // Fleet + above
  subcontractors:            ['fleet', 'growth'],
  missing_ticket_detection:  ['fleet', 'growth'],
  follow_up_automation:      ['fleet', 'growth'],
  auto_invoice_intelligence: ['fleet', 'growth'],
  profit_tracking:           ['fleet', 'growth'],
  ai_dispatch:               ['fleet', 'growth'],
  overdue_automation:        ['fleet', 'growth'],
  weekly_reports:            ['fleet', 'growth'],

  // Growth only
  crm_pipeline:           ['growth'],
  quote_builder:          ['growth'],
  advanced_profitability: ['growth'],
  customer_insights:      ['growth'],
  mobile_ticket:          ['growth'],
  customer_invoicing:     ['growth'],
}

export function canAccess(planId: string, feature: FeatureKey): boolean {
  return (FEATURE_GATES[feature] as readonly string[]).includes(planId)
}

function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === 'solo')                            return 'solo'
  if (plan === 'fleet')                           return 'fleet'
  if (plan === 'growth' || plan === 'enterprise') return 'growth'
  if (plan === 'owner_operator')                  return 'owner_operator'
  return 'owner_operator'
}

export function getPlanGate(company: {
  plan?: string | null
  subscription_status?: string | null
  is_super_admin?: boolean | null
  subscription_override?: string | null
}) {
  if (company.is_super_admin || company.subscription_override) {
    return {
      planId:          'growth' as PlanId,
      can:             (_feature: FeatureKey) => true,
      truckLimit:      null as number | null,
      driverLimit:     null as number | null,
      isSolo:          false,
      isOwnerOperator: false,
      isFleet:         false,
      isGrowth:        true,
      isSuperAdmin:    true,
    }
  }

  const planId = normalizePlanId(company.plan ?? company.subscription_status)
  return {
    planId,
    can:             (feature: FeatureKey) => canAccess(planId, feature),
    truckLimit:      PLANS[planId].limits.trucks as number | null,
    driverLimit:     PLANS[planId].limits.drivers as number | null,
    isSolo:          planId === 'solo',
    isOwnerOperator: planId === 'owner_operator',
    isFleet:         planId === 'fleet',
    isGrowth:        planId === 'growth',
    isSuperAdmin:    false,
  }
}
