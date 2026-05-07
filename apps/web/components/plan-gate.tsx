'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { Plan, Feature } from '@/lib/plan-gate'
import { canUse, FEATURE_PLAN, UPGRADE_URL } from '@/lib/plan-gate'

const PLAN_LABEL: Record<Plan, string> = {
  solo:           'Owner Operator Plan',
  owner_operator: 'Fleet Plan',
  fleet:          'Fleet Plan',
  enterprise:     'Enterprise Plan',
}

interface PlanGateProps {
  /** Current user/company plan */
  plan: string | null | undefined
  /** Feature to check */
  feature: Feature
  /** What to render if the user has access */
  children: React.ReactNode
  /** Optional: render a smaller inline lock instead of a full overlay */
  inline?: boolean
}

/**
 * Wraps UI that requires a higher plan.
 * If the user's plan doesn't have access, shows a locked state with upgrade CTA.
 */
export default function PlanGate({ plan, feature, children, inline = false }: PlanGateProps) {
  if (canUse(plan, feature)) return <>{children}</>

  const requiredPlan  = FEATURE_PLAN[feature]
  const requiredLabel = PLAN_LABEL[requiredPlan]

  if (inline) {
    return (
      <div className="flex items-center gap-1.5 text-gray-400 cursor-not-allowed select-none">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs">
          Requires{' '}
          <Link href={UPGRADE_URL} className="text-[var(--brand-primary)] font-semibold hover:underline" onClick={e => e.stopPropagation()}>
            {requiredLabel}
          </Link>
        </span>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Blurred preview of the locked content */}
      <div className="opacity-30 pointer-events-none select-none blur-sm">{children}</div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700">
          This feature requires the {requiredLabel}
        </p>
        <Link
          href={UPGRADE_URL}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          Upgrade →
        </Link>
      </div>
    </div>
  )
}
