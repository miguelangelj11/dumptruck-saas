export type Plan = 'owner_operator' | 'fleet' | 'enterprise'

// Ordered tiers: higher index = higher plan
const TIER: Record<Plan, number> = { owner_operator: 0, fleet: 1, enterprise: 2 }

export function planTier(plan: string | null | undefined): number {
  return TIER[(plan ?? 'owner_operator') as Plan] ?? 0
}

export function normalizePlan(plan: string | null | undefined): Plan {
  if (plan === 'fleet')      return 'fleet'
  if (plan === 'enterprise') return 'enterprise'
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
  owner_operator: { maxDrivers: 3, maxTrucks: 3, maxTicketsPerMonth: 200 },
  fleet:          { maxDrivers: Infinity, maxTrucks: Infinity, maxTicketsPerMonth: Infinity },
  enterprise:     { maxDrivers: Infinity, maxTrucks: Infinity, maxTicketsPerMonth: Infinity },
}

export function canUse(userPlan: string | null | undefined, feature: Feature): boolean {
  return canUsePlan(userPlan, FEATURE_PLAN[feature])
}

export const UPGRADE_URL = '/dashboard/settings#billing'
