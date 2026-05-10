'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { getStepsForPlan, MASTER_STEPS, type StepStatus } from '@/lib/onboarding-steps'
import { OPEN_CHECKLIST_EVENT } from '@/components/onboarding-checklist'
import { ChevronRight, X } from 'lucide-react'

export default function SetupProgressBanner() {
  const [show,      setShow]      = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [total,     setTotal]     = useState(0)
  const [hidden,    setHidden]    = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const cid = await getCompanyId()
      if (!cid) return

      const { data: co } = await supabase
        .from('companies')
        .select('plan, onboarding_steps, onboarding_dismissed_at, onboarding_completed')
        .eq('id', cid)
        .maybeSingle()

      const coData = co as Record<string, unknown> | null
      if (!coData) return
      if (coData.onboarding_completed === true) return
      if (coData.onboarding_dismissed_at) return

      const plan       = coData.plan as string | null
      const steps      = getStepsForPlan(plan)
      const stepStates = (coData.onboarding_steps as Record<string, StepStatus> | null) ?? {}

      // Count steps done: JSONB skipped/completed, OR validate returns true
      const doneResults = await Promise.all(
        steps.map(async s => {
          if (stepStates[s.id] === 'completed' || stepStates[s.id] === 'skipped') return true
          if (s.manualComplete) return false
          return s.validate(supabase, cid).catch(() => false)
        })
      )

      const done = doneResults.filter(Boolean).length
      setDoneCount(done)
      setTotal(steps.length)

      // Show banner only if not all done
      if (done < steps.length) setShow(true)
    }
    load()
  }, [])

  if (!show || hidden) return null

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="mx-6 mt-6 mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
      {/* Progress ring placeholder — simple bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-amber-900">
            Setup {doneCount} of {total} complete
          </span>
          <span className="text-[10px] text-amber-600">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-amber-200">
          <div
            className="h-1.5 rounded-full bg-amber-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHECKLIST_EVENT))}
        className="shrink-0 flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        Continue <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => setHidden(true)}
        className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
        aria-label="Hide banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
