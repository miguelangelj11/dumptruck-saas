'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { X, ChevronDown, ChevronUp, Check, ArrowRight } from 'lucide-react'

const STEPS = [
  { key: 'companyInfo', emoji: '🏢', title: 'Add your company info',       href: '/dashboard/settings',  cta: 'Open Settings' },
  { key: 'logo',        emoji: '🖼️', title: 'Upload your company logo',     href: '/dashboard/settings',  cta: 'Open Settings' },
  { key: 'client',      emoji: '🤝', title: 'Add your first client',         href: '/dashboard/settings',  cta: 'Open Settings' },
  { key: 'driver',      emoji: '👷', title: 'Add your first driver',         href: '/dashboard/drivers',   cta: 'Add a Driver' },
  { key: 'truck',       emoji: '🚛', title: 'Add your first truck',          href: '/dashboard/settings',  cta: 'Open Settings' },
  { key: 'job',         emoji: '📋', title: 'Create your first job',         href: '/dashboard/dispatch',  cta: 'Go to Dispatch' },
  { key: 'ticket',      emoji: '🎫', title: 'Create your first ticket',      href: '/dashboard/tickets',   cta: 'Go to Tickets' },
  { key: 'invoice',     emoji: '💰', title: 'Create your first invoice',     href: '/dashboard/invoices',  cta: 'Go to Invoices' },
] as const

type StepKey = typeof STEPS[number]['key']

const DISMISS_KEY = 'dtb_checklist_dismissed'

const EMPTY_DONE: Record<StepKey, boolean> = {
  companyInfo: false, logo: false, client: false, driver: false,
  truck: false, job: false, ticket: false, invoice: false,
}

export default function OnboardingChecklist() {
  const pathname = usePathname()
  const supabase = createClient()
  const initialized = useRef(false)

  const [ready, setReady]         = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [done, setDone]           = useState<Record<StepKey, boolean>>(EMPTY_DONE)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function load() {
      if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) {
        setDismissed(true)
        return
      }

      const cid = await getCompanyId()
      if (!cid) return
      setCompanyId(cid)

      const { data: co } = await supabase
        .from('companies')
        .select('name, phone, logo_url, onboarding_dismissed_at')
        .eq('id', cid)
        .maybeSingle()

      if ((co as Record<string, unknown> | null)?.onboarding_dismissed_at) {
        if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
        setDismissed(true)
        return
      }

      const [c1, c2, c3, c4, c5, c6] = await Promise.all([
        supabase.from('client_companies').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('trucks').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('loads').select('id', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', cid),
      ])

      const coRec = co as Record<string, unknown> | null
      setDone({
        companyInfo: !!(coRec?.name && coRec?.phone),
        logo:        !!coRec?.logo_url,
        client:      (c1.count ?? 0) > 0,
        driver:      (c2.count ?? 0) > 0,
        truck:       (c3.count ?? 0) > 0,
        job:         (c4.count ?? 0) > 0,
        ticket:      (c5.count ?? 0) > 0,
        invoice:     (c6.count ?? 0) > 0,
      })
      setReady(true)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function dismiss() {
    if (companyId) {
      await supabase
        .from('companies')
        .update({ onboarding_dismissed_at: new Date().toISOString() })
        .eq('id', companyId)
    }
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  // Don't render on settings page or before data loads
  if (pathname?.startsWith('/dashboard/settings')) return null
  if (dismissed) return null
  if (!ready) return null

  const doneCount = Object.values(done).filter(Boolean).length
  const total = STEPS.length
  const allDone = doneCount === total
  const pct = Math.round((doneCount / total) * 100)
  const firstIncompleteIdx = STEPS.findIndex(s => !done[s.key])

  // Celebration screen when all steps complete
  if (allDone) {
    return (
      <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div style={{ background: '#1e3a2a' }} className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Setup Complete!</span>
          <button onClick={dismiss} className="text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-base font-bold text-gray-900 mb-1">You're all set!</p>
          <p className="text-sm text-gray-500 leading-relaxed">Your account is fully set up. Time to run your business!</p>
          <button
            onClick={dismiss}
            className="mt-5 w-full h-10 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: '#2d7a4f' }}
          >
            Get to work →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

      {/* Header */}
      <div style={{ background: '#1e3a2a' }} className="px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-white">🚀 Get Started with DumpTruckBoss</span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
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
        {/* Progress bar — always visible */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: '#4ade80' }}
            />
          </div>
          <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {doneCount}/{total} done
          </span>
        </div>
      </div>

      {/* Steps list */}
      {!minimized && (
        <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto divide-y divide-gray-50">
          {STEPS.map((step, idx) => {
            const isDone   = done[step.key]
            const isActive = idx === firstIncompleteIdx

            return (
              <div
                key={step.key}
                className={`px-4 py-3 transition-colors ${isActive && !isDone ? 'bg-green-50' : 'bg-white'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Circle checkbox */}
                  <div
                    className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all"
                    style={isDone
                      ? { background: '#2d7a4f', borderColor: '#2d7a4f' }
                      : isActive
                      ? { background: 'transparent', borderColor: '#2d7a4f' }
                      : { background: 'transparent', borderColor: '#d1d5db' }
                    }
                  >
                    {isDone && <Check className="h-3 w-3 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm leading-none">{step.emoji}</span>
                      <span
                        className="text-sm font-medium leading-snug"
                        style={isDone
                          ? { textDecoration: 'line-through', color: '#9ca3af' }
                          : isActive
                          ? { color: '#1e3a2a' }
                          : { color: '#4b5563' }
                        }
                      >
                        {step.title}
                      </span>
                    </div>

                    {isActive && !isDone && (
                      <Link
                        href={step.href}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                        style={{ background: '#2d7a4f' }}
                      >
                        {step.cta} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mobile swipe hint */}
      <div className="sm:hidden text-center py-2 text-xs text-gray-400">
        Tap ↑ to minimize
      </div>
    </div>
  )
}
