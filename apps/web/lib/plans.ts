export const PLANS = {
  solo: {
    id: 'solo',
    name: 'Owner Operator Solo',
    shortName: 'Solo',
    price: 15,
    displayPrice: '$15',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_SOLO_PRICE_ID,
    tagline: 'One truck. Get organized and get paid.',
    description: 'Perfect for single truck owner-operators.',
    badge: null,
    isCustom: false,
    isFoundingMember: false,
    trial_days: 30,
    limits: { trucks: 1, drivers: 1, team_members: 1 },
    features: [
      '1 truck & 1 driver',
      'Dashboard',
      'Unlimited ticket tracking',
      'Basic invoicing',
      'Document storage',
      '30-day free trial',
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
    price: 65,
    displayPrice: '$65',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_OWNER_PRICE_ID,
    tagline: 'Growing your operation? This is your plan.',
    description: 'For owner-operators ready to scale to a small fleet.',
    badge: null,
    isCustom: false,
    isFoundingMember: false,
    trial_days: 7,
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
    price: 125,
    displayPrice: '$125',
    priceLabel: '/mo',
    priceId: process.env.STRIPE_FLEET_PRICE_ID,
    tagline: 'Run your entire operation from one dashboard.',
    description: 'For growing fleets that need full operational control.',
    badge: 'Most Popular',
    isCustom: false,
    isFoundingMember: false,
    trial_days: 7,
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

  founding_member: {
    id: 'founding_member',
    name: 'Founding Member',
    shortName: 'Founding',
    price: 99,
    displayPrice: '$99',
    priceLabel: '/mo forever',
    priceId: process.env.STRIPE_FOUNDING_MEMBER_PRICE_ID,
    tagline: 'First 50 members only — locked in for life.',
    description: 'Full Fleet plan at a founding price, locked forever.',
    badge: '⭐ Founding Member',
    isCustom: false,
    isFoundingMember: true,
    trial_days: 30,
    limits: { trucks: null, drivers: null, team_members: null },
    features: [
      'Everything in Fleet — forever',
      'Price locked at $99/mo for life',
      'Founding Member badge on account',
      '1 month free trial',
      'Priority support',
      'Input on product roadmap',
    ],
    locked: [],
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
    isFoundingMember: false,
    trial_days: 7,
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

export function getTrialDays(plan: string | null | undefined): number {
  if (plan === 'solo') return 30
  if (plan === 'founding_member') return 30
  return 7
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
  realtime_dispatch: ['pro', 'fleet', 'founding_member', 'enterprise'],
  driver_portal:     ['pro', 'fleet', 'founding_member', 'enterprise'],

  // Fleet + above
  subcontractors:            ['fleet', 'founding_member', 'enterprise'],
  missing_ticket_detection:  ['fleet', 'founding_member', 'enterprise'],
  follow_up_automation:      ['fleet', 'founding_member', 'enterprise'],
  auto_invoice_intelligence: ['fleet', 'founding_member', 'enterprise'],
  profit_tracking:           ['fleet', 'founding_member', 'enterprise'],
  ai_dispatch:               ['fleet', 'founding_member', 'enterprise'],
  overdue_automation:        ['fleet', 'founding_member', 'enterprise'],
  weekly_reports:            ['fleet', 'founding_member', 'enterprise'],

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

export const PLAN_LIMITS: Record<PlanId, { maxDrivers: number; maxTrucks: number }> = {
  solo:           { maxDrivers: 1,        maxTrucks: 1 },
  pro:            { maxDrivers: 5,        maxTrucks: 5 },
  fleet:          { maxDrivers: Infinity, maxTrucks: Infinity },
  founding_member:{ maxDrivers: Infinity, maxTrucks: Infinity },
  enterprise:     { maxDrivers: Infinity, maxTrucks: Infinity },
}

function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === 'solo')                                                    return 'solo'
  if (plan === 'fleet')                                                   return 'fleet'
  if (plan === 'founding_member')                                         return 'founding_member'
  if (plan === 'enterprise' || plan === 'growth')                         return 'enterprise'
  if (plan === 'pro' || plan === 'owner_operator' || plan === 'starter')  return 'pro'
  return 'pro'
}

export function normalizePlan(plan: string | null | undefined): PlanId {
  return normalizePlanId(plan)
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
      isFoundingMember: false,
      isSuperAdmin:    true,
      isOwnerOperator: false,
      isGrowth:        true,
    }
  }

  const planId = normalizePlanId(company.plan ?? company.subscription_status)
  const isFleetLevel = planId === 'fleet' || planId === 'founding_member'
  return {
    planId,
    can:             (feature: FeatureKey) => canAccess(planId, feature),
    truckLimit:      PLAN_LIMITS[planId].maxTrucks === Infinity ? null : PLAN_LIMITS[planId].maxTrucks,
    driverLimit:     PLAN_LIMITS[planId].maxDrivers === Infinity ? null : PLAN_LIMITS[planId].maxDrivers,
    isSolo:          planId === 'solo',
    isPro:           planId === 'pro',
    isFleet:         isFleetLevel,
    isEnterprise:    planId === 'enterprise',
    isFoundingMember: planId === 'founding_member',
    isSuperAdmin:    false,
    isOwnerOperator: planId === 'pro',
    isGrowth:        planId === 'enterprise',
  }
}
