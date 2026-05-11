export const PLANS = {
  solo: {
    id: 'solo',
    name: 'Owner Operator Solo',
    shortName: 'Solo',
    price: 25,
    displayPrice: '$25',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_SOLO_PRICE_ID,
    tagline: 'One truck. Get organized and get paid.',
    description: 'Perfect for single truck owner-operators.',
    badge: null,
    isCustom: false,
    limits: { trucks: 1, drivers: 1, team_members: 1 },
    features: [
      '1 truck & 1 driver',
      'Dashboard',
      'Unlimited ticket tracking',
      'Basic invoicing',
      'Document storage',
      '7-day free trial',
    ],
    locked: [
      'Dispatch board',
      'Revenue analytics',
      'Subcontractor management',
      'Team access',
      'AI document reader',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Owner Operator Pro',
    shortName: 'Pro',
    price: 80,
    displayPrice: '$80',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_OWNER_PRICE_ID,
    tagline: 'Growing your operation? This is your plan.',
    description: 'For owner-operators ready to scale to a small fleet.',
    badge: null,
    isCustom: false,
    limits: { trucks: 5, drivers: 5, team_members: 1 },
    features: [
      'Up to 5 trucks & drivers',
      'Everything in Solo',
      'Full dispatch board',
      'Revenue analytics',
      'Driver management',
      'Client companies',
      '7-day free trial',
    ],
    locked: [
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation',
      'Team access',
      'AI document reader',
      'CRM Pipeline',
    ],
  },

  fleet: {
    id: 'fleet',
    name: 'Fleet',
    shortName: 'Fleet',
    price: 150,
    displayPrice: '$150',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_FLEET_PRICE_ID,
    tagline: 'Run your entire operation from one dashboard.',
    description: 'For growing fleets that need full operational control.',
    badge: 'Most Popular',
    isCustom: false,
    limits: { trucks: null, drivers: null, team_members: null },
    features: [
      'Unlimited trucks & drivers',
      'Everything in Owner Operator Pro',
      'Subcontractor management',
      'Missing ticket detection',
      'Follow-up automation engine',
      'Auto invoice intelligence',
      'Real-time dispatch board',
      'Driver zero-friction portal',
      'Profit tracking',
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
      'Mobile ticket + signature',
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    shortName: 'Enterprise',
    price: null,
    displayPrice: 'Custom',
    priceLabel: 'pricing',
    priceId: null,
    tagline: 'Built around your operation. Priced to match.',
    description: 'Custom solutions for large dump truck fleets and hauling companies.',
    badge: null,
    isCustom: true,
    limits: { trucks: null, drivers: null, team_members: null },
    features: [
      'Everything in Fleet',
      'Custom onboarding',
      'Dedicated account manager',
      'CRM Growth Pipeline',
      'Quote builder',
      'Advanced job profitability',
      'Revenue per driver & truck',
      'Customer insights dashboard',
      'Mobile ticket + signature capture',
      'AI document reader (unlimited)',
      'Documents hub',
      'Custom integrations',
      'Priority support',
      'Custom contract terms',
      'Multi-location support',
    ],
    locked: [],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlan(planId: string) {
  return PLANS[planId as PlanId] ?? PLANS.pro
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
  // Pro + above
  realtime_dispatch: ['pro', 'fleet', 'enterprise'],
  driver_portal:     ['pro', 'fleet', 'enterprise'],

  // Fleet + above
  subcontractors:            ['fleet', 'enterprise'],
  missing_ticket_detection:  ['fleet', 'enterprise'],
  follow_up_automation:      ['fleet', 'enterprise'],
  auto_invoice_intelligence: ['fleet', 'enterprise'],
  profit_tracking:           ['fleet', 'enterprise'],
  ai_dispatch:               ['fleet', 'enterprise'],
  overdue_automation:        ['fleet', 'enterprise'],
  weekly_reports:            ['fleet', 'enterprise'],

  // Enterprise only
  crm_pipeline:           ['enterprise'],
  quote_builder:          ['enterprise'],
  advanced_profitability: ['enterprise'],
  customer_insights:      ['enterprise'],
  mobile_ticket:          ['enterprise'],
  customer_invoicing:     ['enterprise'],
}

export function canAccess(planId: string, feature: FeatureKey): boolean {
  return (FEATURE_GATES[feature] as readonly string[]).includes(planId)
}

function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === 'solo')                                            return 'solo'
  if (plan === 'fleet')                                          return 'fleet'
  if (plan === 'enterprise' || plan === 'growth')                return 'enterprise'
  if (plan === 'pro' || plan === 'owner_operator' || plan === 'starter') return 'pro'
  return 'pro'
}

export function getPlanGate(company: {
  plan?: string | null
  subscription_status?: string | null
  is_super_admin?: boolean | null
  subscription_override?: string | null
}) {
  if (company.is_super_admin || company.subscription_override) {
    return {
      planId:          'enterprise' as PlanId,
      can:             (_feature: FeatureKey) => true,
      truckLimit:      null as number | null,
      driverLimit:     null as number | null,
      isSolo:          false,
      isPro:           false,
      isFleet:         false,
      isEnterprise:    true,
      isSuperAdmin:    true,
      // backward-compat aliases
      isOwnerOperator: false,
      isGrowth:        true,
    }
  }

  const planId = normalizePlanId(company.plan ?? company.subscription_status)
  return {
    planId,
    can:             (feature: FeatureKey) => canAccess(planId, feature),
    truckLimit:      PLANS[planId].limits.trucks as number | null,
    driverLimit:     PLANS[planId].limits.drivers as number | null,
    isSolo:          planId === 'solo',
    isPro:           planId === 'pro',
    isFleet:         planId === 'fleet',
    isEnterprise:    planId === 'enterprise',
    isSuperAdmin:    false,
    // backward-compat aliases
    isOwnerOperator: planId === 'pro',
    isGrowth:        planId === 'enterprise',
  }
}
