'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import {
  X, ChevronDown, ChevronUp, Check, ArrowRight,
  ChevronRight, Lightbulb, AlertCircle, Loader2,
} from 'lucide-react'
import {
  MASTER_STEPS,
  getStepsForPlan,
  getSectionsForPlan,
  estimatedMinutes,
  type OnboardingStep,
  type StepStatus,
} from '@/lib/onboarding-steps'
import { normalizePlan } from '@/lib/plan-gate'

const DISMISS_KEY = 'dtb_checklist_dismissed'

// Event name for the re-summon ? button in the sidebar
export const OPEN_CHECKLIST_EVENT     = 'open-onboarding-checklist'
export const CHECKLIST_PROGRESS_EVENT = 'checklist-progress'

type StepStates = Record<string, StepStatus>

// ── Confetti ────────────────────────────────────────────────────────────────────
function Confetti() {
  const count = typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 40
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 2,
    color: ['#F5B731','#4ade80','#3b82f6','#f97316','#ec4899','#8b5cf6','#2d7a4f'][i % 7]!,
    size: 6 + Math.random() * 8,
    rotate: Math.random() > 0.5,
  })), [count])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[60]">
      {pieces.map(p => (
        <div
          key={p.id}
          className={`absolute ${p.rotate ? 'rounded-sm' : 'rounded-full'}`}
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ${p.delay}s linear forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function OnboardingChecklist() {
  const supabase = useRef(createClient()).current
  const router = useRouter()

  const [ready,         setReady]         = useState(false)
  const [dismissed,     setDismissed]     = useState(false)
  const [minimized,     setMinimized]     = useState(false)
  const [plan,          setPlan]          = useState<string | null>(null)
  const [stepStates,    setStepStates]    = useState<StepStates>({})
  const [validatedDone, setValidatedDone] = useState<Set<string>>(new Set())
  const [activeIdx,     setActiveIdx]     = useState(0)
  const [showProTip,    setShowProTip]    = useState(false)
  const [validating,    setValidating]    = useState(false)
  const [validateError, setValidateError] = useState<string | null>(null)
  const [celebrating,   setCelebrating]   = useState(false)
  const [invoiceBoom,   setInvoiceBoom]   = useState(false)

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const companyIdRef   = useRef<string | null>(null)
  const celebratedRef  = useRef(false)
  const dismissedRef   = useRef(false)
  const prevDoneRef    = useRef<Set<string>>(new Set())

  // Derived: steps filtered by plan
  const steps    = useMemo(() => getStepsForPlan(plan), [plan])
  const sections = useMemo(() => getSectionsForPlan(plan), [plan])

  function toggleSection(section: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  // A step is "done" if validated from DB OR manually marked complete/skipped in JSONB
  const doneIds = useMemo(() => {
    const s = new Set<string>()
    for (const step of steps) {
      if (validatedDone.has(step.id)) s.add(step.id)
      if (stepStates[step.id] === 'completed' || stepStates[step.id] === 'skipped') s.add(step.id)
    }
    return s
  }, [steps, validatedDone, stepStates])

  const doneCount  = doneIds.size
  const totalSteps = steps.length
  const pct        = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0
  const minsLeft   = steps
    .filter(s => !doneIds.has(s.id))
    .reduce((sum, s) => sum + s.estimatedMinutes, 0)

  const currentStep: OnboardingStep | undefined = steps[activeIdx]

  // ── Sync active index to first incomplete step ──────────────────────────────
  useEffect(() => {
    if (!ready) return
    const firstIncomplete = steps.findIndex(s => !doneIds.has(s.id))
    if (firstIncomplete === -1) {
      // All done — celebrate
      if (!celebratedRef.current && !dismissedRef.current) {
        celebratedRef.current = true
        setCelebrating(true)
      }
    } else if (activeIdx >= steps.length || doneIds.has(steps[activeIdx]?.id ?? '')) {
      setActiveIdx(Math.max(0, firstIncomplete))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds, steps, ready])

  // ── Detect first_invoice completion for special boom ───────────────────────
  useEffect(() => {
    if (!ready) return
    const wasInvoiceDone = prevDoneRef.current.has('first_invoice')
    const isInvoiceDone  = doneIds.has('first_invoice')
    if (!wasInvoiceDone && isInvoiceDone && !celebratedRef.current) {
      setInvoiceBoom(true)
      setTimeout(() => setInvoiceBoom(false), 4000)
    }
    prevDoneRef.current = new Set(doneIds)
  }, [doneIds, ready])

  // ── Run validate() for all steps and update validatedDone ──────────────────
  const refreshValidations = useCallback(async () => {
    const cid = companyIdRef.current
    if (!cid) return
    const results = await Promise.all(
      MASTER_STEPS.map(async s => ({
        id: s.id,
        done: s.manualComplete ? false : await s.validate(supabase, cid).catch(() => false),
      }))
    )
    setValidatedDone(new Set(results.filter(r => r.done).map(r => r.id)))
  }, [supabase])

  // ── Write step state to Supabase JSONB ─────────────────────────────────────
  const persistStepState = useCallback(async (stepId: string, status: StepStatus) => {
    const cid = companyIdRef.current
    if (!cid) return
    const next = { ...stepStates, [stepId]: status }
    setStepStates(next)
    await supabase
      .from('companies')
      .update({ onboarding_steps: next })
      .eq('id', cid)
  }, [supabase, stepStates])

  // ── Permanent dismiss ───────────────────────────────────────────────────────
  const dismiss = useCallback(async () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    const cid = companyIdRef.current
    if (cid) {
      await supabase
        .from('companies')
        .update({ onboarding_dismissed_at: new Date().toISOString() })
        .eq('id', cid)
    }
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }, [supabase])

  // ── Handle "Mark complete" button ───────────────────────────────────────────
  const handleMarkComplete = useCallback(async () => {
    if (!currentStep) return
    setValidating(true)
    setValidateError(null)

    let isValid = false
    if (currentStep.manualComplete) {
      isValid = true
    } else {
      isValid = await currentStep.validate(supabase, companyIdRef.current ?? '').catch(() => false)
    }

    if (isValid) {
      await persistStepState(currentStep.id, 'completed')
      setValidatedDone(prev => new Set([...prev, currentStep.id]))
      setShowProTip(false)
      // Advance
      const nextIdx = steps.findIndex((s, i) => i > activeIdx && !doneIds.has(s.id))
      if (nextIdx !== -1) setActiveIdx(nextIdx)
    } else {
      setValidateError("Looks like that step isn't done yet — complete the action first, then come back.")
    }
    setValidating(false)
  }, [currentStep, supabase, persistStepState, steps, activeIdx, doneIds])

  // ── Handle "Skip" button ────────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (!currentStep) return
    await persistStepState(currentStep.id, 'skipped')
    setValidateError(null)
    setShowProTip(false)
    const nextIdx = steps.findIndex((s, i) => i > activeIdx && !doneIds.has(s.id))
    if (nextIdx !== -1) setActiveIdx(nextIdx)
  }, [currentStep, persistStepState, steps, activeIdx, doneIds])

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const cid = await getCompanyId()
      if (!cid) return
      companyIdRef.current = cid

      // Load company fields
      const { data: co } = await supabase
        .from('companies')
        .select('onboarding_dismissed_at, plan, onboarding_steps, onboarding_tier')
        .eq('id', cid)
        .maybeSingle()

      const coData = co as Record<string, unknown> | null

      // Determine dismissed state but always finish loading so the sidebar
      // "Setup guide" button can re-open the checklist at any time.
      const wasDismissed =
        !!coData?.onboarding_dismissed_at ||
        (typeof window !== 'undefined' && !!localStorage.getItem(DISMISS_KEY))

      if (wasDismissed) {
        if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
        dismissedRef.current = true
        setDismissed(true)
      }

      const companyPlan = (coData?.plan as string | null) ?? null
      setPlan(companyPlan)

      // Restore step states from JSONB
      const savedStates = (coData?.onboarding_steps as StepStates | null) ?? {}
      setStepStates(savedStates)

      // If tier changed, persist the new tier
      const savedTier = coData?.onboarding_tier as string | null
      const currentTier = normalizePlan(companyPlan)
      if (savedTier !== currentTier) {
        await supabase
          .from('companies')
          .update({ onboarding_tier: currentTier })
          .eq('id', cid)
      }

      await refreshValidations()
      setReady(true)

      // Realtime: re-validate on any relevant table change
      const recheck = () => { if (!dismissedRef.current) refreshValidations() }
      channel = supabase
        .channel('onboarding-checklist')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks'              }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers'             }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies'    }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs'                }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loads'               }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices'            }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contractors'         }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contractor_trucks'   }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads'               }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_documents'   }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses'            }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatches'          }, recheck)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_imports'      }, recheck)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies'      }, recheck)
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase, refreshValidations])

  // ── Re-summon via window event (triggered by sidebar Setup guide button) ──────
  useEffect(() => {
    const handler = () => {
      if (typeof window !== 'undefined') localStorage.removeItem(DISMISS_KEY)
      dismissedRef.current = false
      setDismissed(false)
      setMinimized(false)
    }
    window.addEventListener(OPEN_CHECKLIST_EVENT, handler)
    return () => window.removeEventListener(OPEN_CHECKLIST_EVENT, handler)
  }, [])

  // ── Broadcast progress to sidebar badge ────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    window.dispatchEvent(new CustomEvent(CHECKLIST_PROGRESS_EVENT, {
      detail: { done: doneCount, total: totalSteps, complete: doneCount >= totalSteps },
    }))
  }, [doneCount, totalSteps, ready])

  // ── Auto-dismiss when all done ──────────────────────────────────────────────
  useEffect(() => {
    if (!celebrating) return
    const t = setTimeout(() => dismiss(), 4000)
    return () => clearTimeout(t)
  }, [celebrating, dismiss])

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (dismissed || !ready || steps.length === 0) return null

  // ── Invoice Boom celebration ─────────────────────────────────────────────────
  if (invoiceBoom) {
    return (
      <>
        <Confetti />
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-full sm:w-80 bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border-2 border-[#F5B731]">
          <div className="p-6 text-center">
            <div className="text-5xl mb-3">💥</div>
            <p className="text-2xl font-black text-[#F5B731] mb-2">Boom.</p>
            <p className="text-white font-bold text-base mb-1">First invoice sent.</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              That&apos;s a real invoice to a real customer. That&apos;s the whole point of this system.
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── All-done celebration ─────────────────────────────────────────────────────
  if (celebrating) {
    return (
      <>
        <Confetti />
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Setup Complete!</span>
            <button onClick={dismiss} className="text-white/60 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-base font-bold text-gray-900 mb-1">You&apos;re set up.</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              The hard part is done. Now go run the business.
            </p>
            <p className="text-xs text-gray-400 mt-4">Closing in a few seconds…</p>
          </div>
        </div>
      </>
    )
  }

  // ── Main checklist panel ─────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ maxHeight: '85dvh' }}>

      {/* Header */}
      <div className="bg-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-white">🚀 Get set up</span>
          <div className="flex items-center gap-1">
            {minsLeft > 0 && (
              <span className="text-[10px] text-white/50 mr-1">~{minsLeft} min left</span>
            )}
            <button
              onClick={() => setMinimized(m => !m)}
              className="text-white/60 hover:text-white p-0.5 transition-colors"
              aria-label={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={dismiss}
              className="text-white/60 hover:text-white p-0.5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-full h-1.5 bg-white/20">
            <div
              className="h-1.5 rounded-full transition-all duration-500 bg-[#F5B731]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-white/60 shrink-0">{doneCount}/{totalSteps}</span>
        </div>
      </div>

      {/* Collapsed step list — grouped by section */}
      {minimized ? (
        <div className="overflow-y-auto flex-1">
          {sections.map(section => {
            const sectionSteps = steps.filter(s => s.section === section)
            const sectionDone  = sectionSteps.filter(s => doneIds.has(s.id)).length
            const allDone      = sectionDone === sectionSteps.length
            const isCollapsed  = collapsedSections.has(section)
            return (
              <div key={section}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${allDone ? 'text-green-600' : 'text-gray-500'}`}>
                    {allDone ? '✓ ' : ''}{section}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400">{sectionDone}/{sectionSteps.length}</span>
                    {isCollapsed
                      ? <ChevronRight className="h-3 w-3 text-gray-400" />
                      : <ChevronDown className="h-3 w-3 text-gray-400" />
                    }
                  </div>
                </button>
                {/* Section steps */}
                {!isCollapsed && sectionSteps.map(step => {
                  const idx    = steps.indexOf(step)
                  const isDone   = doneIds.has(step.id)
                  const isActive = idx === activeIdx
                  return (
                    <button
                      key={step.id}
                      onClick={() => { setActiveIdx(idx); setMinimized(false) }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors border-b border-gray-50 ${isActive ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                    >
                      <div
                        className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 border-2 transition-all"
                        style={isDone
                          ? { background: '#2d7a4f', borderColor: '#2d7a4f' }
                          : isActive
                          ? { background: 'transparent', borderColor: '#F5B731' }
                          : { background: 'transparent', borderColor: '#d1d5db' }
                        }
                      >
                        {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="text-xs flex-1 text-left" style={isDone ? { textDecoration: 'line-through', color: '#9ca3af' } : { color: '#374151' }}>
                        {step.emoji} {step.title}
                      </span>
                      {stepStates[step.id] === 'skipped' && (
                        <span className="text-[9px] text-gray-400 font-medium">skipped</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : currentStep ? (
        /* ── Expanded active step ─────────────────────────────────────────── */
        <div className="p-4 overflow-y-auto flex-1">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Step {activeIdx + 1} of {totalSteps}
            </span>
            <button
              onClick={() => { setMinimized(true) }}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              See all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* Step title */}
          <h3 className="text-base font-black text-gray-900 mb-3 leading-snug">
            {currentStep.emoji} {currentStep.title}
          </h3>

          {/* Why this matters — amber card in operator voice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Why this matters</p>
            <p className="text-sm text-amber-900 leading-relaxed">{currentStep.why}</p>
          </div>

          {/* Validation error */}
          {validateError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{validateError}</p>
            </div>
          )}

          {/* CTA button — minimizes panel on mobile so the page is visible */}
          <button
            onClick={() => {
              setMinimized(true)
              router.push(currentStep.href)
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-colors hover:opacity-90 mb-2"
            style={{ background: '#F5B731' }}
          >
            {currentStep.cta} <ArrowRight className="h-4 w-4" />
          </button>

          {/* Pro Tip toggle */}
          {currentStep.proTip && (
            <button
              onClick={() => setShowProTip(p => !p)}
              className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors"
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              {showProTip ? 'Hide pro tip' : 'Show pro tip'}
            </button>
          )}
          {showProTip && currentStep.proTip && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Pro Tip</p>
              <p className="text-xs text-gray-700 leading-relaxed">{currentStep.proTip}</p>
            </div>
          )}

          {/* Footer: Skip | Mark complete */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-2">
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleMarkComplete}
              disabled={validating}
              className="ml-auto flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {validating
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Checking…</>
                : <><Check className="h-3 w-3" /> Done — next</>
              }
            </button>
          </div>
        </div>
      ) : null}

      <div className="sm:hidden text-center py-2 text-[10px] text-gray-400">
        Tap ↑ to minimize
      </div>
    </div>
  )
}
