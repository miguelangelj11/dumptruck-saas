export const PLANS = {
  owner_operator: {
    id: 'owner_operator',
    name: 'Owner Operator',
    price: 80,
    priceId: process.env.STRIPE_OWNER_PRICE_ID!,
    description: 'Stay organized and get paid faster.',
    tagline: 'Perfect for solo operators with up to 5 trucks',
    badge: null,
    limits: {
      trucks: 5,
      drivers: 10,
    },
    features: [
      'Up to 5 trucks',
      'Dispatching & job management',
      'Ticket tracking',
      'Basic invoicing',
      'Basic dashboard',
      'Driver management',
      'Client companies',
    ],
    locked: [
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation',
      'Auto invoice intelligence',
      'Profit tracking',
      'AI dispatch recommendations',
    ],
  },
  fleet: {
    id: 'fleet',
    name: 'Fleet',
    price: 150,
    priceId: process.env.STRIPE_FLEET_PRICE_ID!,
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
    ],
    locked: [
      'Lead & job pipeline (CRM)',
      'Quote builder',
      'Advanced job profitability',
      'Customer insights',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 300,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    description: 'Win more jobs and scale your revenue.',
    tagline: 'For operators ready to grow their business',
    badge: null,
    limits: {
      trucks: null,
      drivers: null,
    },
    features: [
      'Everything in Fleet',
      'Lead & job pipeline (CRM)',
      'Quote builder',
      'Convert quotes → jobs → invoices',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Top clients & slow payer tracking',
      'Revenue per customer reporting',
      'Priority support',
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
}

export function canAccess(planId: string, feature: FeatureKey): boolean {
  return (FEATURE_GATES[feature] as readonly string[]).includes(planId)
}

function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === 'fleet')                       return 'fleet'
  if (plan === 'growth' || plan === 'enterprise') return 'growth'
  return 'owner_operator'
}

export function getPlanGate(company: { plan?: string | null; subscription_status?: string | null }) {
  const planId = normalizePlanId(company.plan ?? company.subscription_status)
  return {
    planId,
    can: (feature: FeatureKey) => canAccess(planId, feature),
    truckLimit: PLANS[planId].limits.trucks,
    isOwnerOperator: planId === 'owner_operator',
    isFleet:         planId === 'fleet',
    isGrowth:        planId === 'growth',
  }
}
