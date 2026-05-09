export type Plan = 'solo' | 'owner_operator' | 'fleet' | 'enterprise'

// Ordered tiers: higher index = higher plan
const TIER: Record<Plan, number> = { solo: 0, owner_operator: 1, fleet: 2, enterprise: 3 }

export function planTier(plan: string | null | undefined): number {
  return TIER[normalizePlan(plan)]
}

export function normalizePlan(plan: string | null | undefined): Plan {
  if (plan === 'solo')                            return 'solo'
  if (plan === 'fleet')                           return 'fleet'
  if (plan === 'enterprise' || plan === 'growth') return 'enterprise'
  return 'owner_operator'
}

/** Returns true if `userPlan` has access to features requiring `requiredPlan` */
export function canUsePlan(userPlan: string | null | undefined, requiredPlan: Plan): boolean {
  return planTier(userPlan) >= TIER[requiredPlan]
}

// ── Feature definitions ──────────────────────────────────────────────────────

export type Feature =
  | 'missing_money'
  | 'profit_tracking'
  | 'auto_invoicing'
  | 'client_portal'
  | 'weekly_emails'
  | 'subcontractors'
  | 'ai_chat'
  | 'advanced_analytics'

export const FEATURE_PLAN: Record<Feature, Plan> = {
  missing_money:       'fleet',
  profit_tracking:     'fleet',
  auto_invoicing:      'fleet',
  client_portal:       'fleet',
  weekly_emails:       'fleet',
  subcontractors:      'fleet',
  ai_chat:             'enterprise',
  advanced_analytics:  'enterprise',
}

export const PLAN_LIMITS: Record<Plan, { maxDrivers: number; maxTrucks: number; maxTicketsPerMonth: number }> = {
  solo:           { maxDrivers: 1, maxTrucks: 1, maxTicketsPerMonth: Infinity },
  owner_operator: { maxDrivers: 5, maxTrucks: 5, maxTicketsPerMonth: Infinity },
  fleet:          { maxDrivers: Infinity, maxTrucks: Infinity, maxTicketsPerMonth: Infinity },
  enterprise:     { maxDrivers: Infinity, maxTrucks: Infinity, maxTicketsPerMonth: Infinity },
}

export function canUse(userPlan: string | null | undefined, feature: Feature): boolean {
  return canUsePlan(userPlan, FEATURE_PLAN[feature])
}

export const UPGRADE_URL = '/dashboard/settings#billing'
