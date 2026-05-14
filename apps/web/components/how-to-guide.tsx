'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronDown, ChevronUp, ChevronRight, ArrowRight,
  SkipForward, Check, BookOpen,
} from 'lucide-react'
import { HOW_TO_STEPS, HOW_TO_SECTIONS, type HowToStep } from '@/lib/how-to-steps'

const DISMISS_KEY   = 'dtb_howto_dismissed'
const PROGRESS_KEY  = 'dtb_howto_progress'
export const OPEN_HOWTO_EVENT = 'open-how-to-guide'

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}
function saveProgress(done: Set<string>) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done])) } catch { /* noop */ }
}

export default function HowToGuide() {
  const router = useRouter()
  const [show,      setShow]      = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [done,      setDone]      = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const totalSteps = HOW_TO_STEPS.length
  const doneCount  = done.size
  const pct        = Math.round((doneCount / totalSteps) * 100)

  const currentStep: HowToStep | undefined = HOW_TO_STEPS[activeIdx]

  // ── Load persisted state ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DISMISS_KEY)) return
    setDone(loadProgress())
  }, [])

  // ── Sync active index to first incomplete step ─────────────────────────────
  useEffect(() => {
    const firstIncomplete = HOW_TO_STEPS.findIndex(s => !done.has(s.id))
    if (firstIncomplete !== -1 && (done.has(HOW_TO_STEPS[activeIdx]?.id ?? ''))) {
      setActiveIdx(firstIncomplete)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // ── Open via sidebar event or after setup guide completes ──────────────────
  useEffect(() => {
    const handler = () => {
      if (typeof window !== 'undefined') localStorage.removeItem(DISMISS_KEY)
      setShow(true)
      setMinimized(false)
    }
    window.addEventListener(OPEN_HOWTO_EVENT, handler)
    return () => window.removeEventListener(OPEN_HOWTO_EVENT, handler)
  }, [])

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }, [])

  // ── Mark step done ─────────────────────────────────────────────────────────
  const markDone = useCallback((stepId: string) => {
    setDone(prev => {
      const next = new Set([...prev, stepId])
      saveProgress(next)
      return next
    })
    const nextIdx = HOW_TO_STEPS.findIndex((s, i) => i > activeIdx && !done.has(s.id))
    if (nextIdx !== -1) setActiveIdx(nextIdx)
    else if (doneCount + 1 >= totalSteps) setTimeout(() => dismiss(), 2500)
  }, [activeIdx, done, doneCount, totalSteps, dismiss])

  // ── Skip step ─────────────────────────────────────────────────────────────
  const skipStep = useCallback(() => {
    const nextIdx = HOW_TO_STEPS.findIndex((s, i) => i > activeIdx && !done.has(s.id))
    if (nextIdx !== -1) setActiveIdx(nextIdx)
    else {
      const firstUnseen = HOW_TO_STEPS.findIndex(s => !done.has(s.id))
      if (firstUnseen !== -1) setActiveIdx(firstUnseen)
    }
  }, [activeIdx, done])

  function toggleSection(section: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  const allDone = doneCount >= totalSteps

  if (!show) return null

  // ── All done ─────────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[49] w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">📖 How-to Guide</span>
          <button onClick={dismiss} className="text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="text-5xl mb-3">🎓</div>
          <p className="text-base font-bold text-gray-900 mb-1">You know the ropes.</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            You&apos;ve been through every section. Now go run the business.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[49] w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
      style={{ maxHeight: '85dvh' }}
    >
      {/* Header */}
      <div className="bg-[#1a1a1a] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-white">📖 How to Use DumpTruckBoss</span>
          <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-full h-1.5 bg-white/20">
            <div className="h-1.5 rounded-full transition-all duration-500 bg-[#F5B731]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-white/60 shrink-0">{doneCount}/{totalSteps}</span>
        </div>
      </div>

      {/* Minimized — section list */}
      {minimized ? (
        <div className="overflow-y-auto flex-1">
          {HOW_TO_SECTIONS.map(section => {
            const sectionSteps = HOW_TO_STEPS.filter(s => s.section === section)
            const sectionDone  = sectionSteps.filter(s => done.has(s.id)).length
            const allSectionDone = sectionDone === sectionSteps.length
            const isCollapsed = collapsedSections.has(section)
            return (
              <div key={section}>
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${allSectionDone ? 'text-green-600' : 'text-gray-500'}`}>
                    {allSectionDone ? '✓ ' : ''}{section}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400">{sectionDone}/{sectionSteps.length}</span>
                    {isCollapsed ? <ChevronRight className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                  </div>
                </button>
                {!isCollapsed && sectionSteps.map(step => {
                  const idx    = HOW_TO_STEPS.indexOf(step)
                  const isDone   = done.has(step.id)
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
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

      ) : currentStep ? (
        /* ── Expanded active step ───────────────────────────────────────── */
        <div className="p-4 overflow-y-auto flex-1">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {currentStep.section} · {activeIdx + 1} of {totalSteps}
            </span>
            <button
              onClick={() => setMinimized(true)}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              See all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* Title */}
          <h3 className="text-base font-black text-gray-900 mb-3 leading-snug">
            {currentStep.emoji} {currentStep.title}
          </h3>

          {/* What it does */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">What it does</p>
            <p className="text-sm text-blue-900 leading-relaxed">{currentStep.description}</p>
          </div>

          {/* How to use it */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">How to use it</p>
            <p className="text-sm text-amber-900 leading-relaxed">{currentStep.howTo}</p>
          </div>

          {/* CTA — navigate + minimize */}
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

          {/* Footer */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-2">
            <button
              onClick={skipStep}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <SkipForward className="h-3 w-3" /> Skip
            </button>
            <button
              onClick={() => markDone(currentStep.id)}
              className="ml-auto flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Check className="h-3 w-3" /> Got it — next
            </button>
          </div>
        </div>
      ) : null}

      <div className="sm:hidden text-center py-2 text-[10px] text-gray-400 shrink-0">
        Tap ↑ to minimize
      </div>
    </div>
  )
}
