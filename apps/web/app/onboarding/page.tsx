'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import {
  Loader2, Check, ChevronRight, ChevronLeft, Plus, Trash2,
  Truck, Users, Briefcase, Palette, CheckCircle2, Upload,
  LayoutDashboard, Radio, FileText, Receipt, TrendingUp,
  Building2, Settings,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'uk', flag: '🇺🇦', label: 'Українська' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
]

const FLEET_SIZES = [
  { key: '1',    label: 'Solo operator', sub: '1 truck' },
  { key: '2-5',  label: 'Small fleet',   sub: '2–5 trucks' },
  { key: '6-10', label: 'Medium fleet',  sub: '6–10 trucks' },
  { key: '11-20',label: 'Large fleet',   sub: '11–20 trucks' },
  { key: '20+',  label: 'Enterprise',    sub: '20+ trucks' },
]

const CURRENT_SYSTEMS = [
  { key: 'spreadsheets', label: 'Spreadsheets', emoji: '📊' },
  { key: 'paper',        label: 'Paper / Notebooks', emoji: '📓' },
  { key: 'software',     label: 'Different software', emoji: '💻' },
  { key: 'nothing',      label: 'Nothing formal', emoji: '🤷' },
]

const MATERIAL_OPTIONS = [
  'Fill Dirt', 'Gravel / Base', 'Topsoil', 'Concrete / Demo',
  'Asphalt', 'Stone / Rock', 'Sand', 'Other',
]

const THEME_COLORS = [
  { name: 'Forest',   primary: '#1e3a2a', accent: '#2d7a4f',  bg: 'bg-[#1e3a2a]', ring: 'ring-[#2d7a4f]' },
  { name: 'Navy',     primary: '#1e3a5f', accent: '#2d5fa4',  bg: 'bg-[#1e3a5f]', ring: 'ring-[#2d5fa4]' },
  { name: 'Charcoal', primary: '#1e293b', accent: '#475569',  bg: 'bg-[#1e293b]', ring: 'ring-[#475569]' },
  { name: 'Crimson',  primary: '#7f1d1d', accent: '#dc2626',  bg: 'bg-[#7f1d1d]', ring: 'ring-[#dc2626]' },
  { name: 'Amber',    primary: '#78350f', accent: '#d97706',  bg: 'bg-[#78350f]', ring: 'ring-[#d97706]' },
]

const SIDEBAR_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard',        icon: LayoutDashboard },
  { key: 'dispatch',    label: 'Dispatch Board',    icon: Radio },
  { key: 'tickets',     label: 'Tickets',           icon: FileText },
  { key: 'invoices',    label: 'Invoices',          icon: Receipt },
  { key: 'revenue',     label: 'Revenue Reports',   icon: TrendingUp },
  { key: 'drivers',     label: 'Drivers',           icon: Users },
  { key: 'jobs',        label: 'Jobs',              icon: Briefcase },
  { key: 'trucks',      label: 'Trucks',            icon: Truck },
  { key: 'contractors', label: 'Contractors',       icon: Building2 },
  { key: 'settings',    label: 'Settings',          icon: Settings },
]

const STEP_TITLES: Record<number, string> = {
  1: 'Welcome to DumpTruckBoss',
  2: 'Tell us about your company',
  3: 'How is your business structured?',
  4: 'Pick your color theme',
  5: 'What features do you need?',
  6: 'Add your drivers',
  7: 'Add your clients & contractors',
  8: 'Add your subcontractors',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverEntry  = { name: string; email: string; phone: string }
type ClientEntry  = { name: string }
type SubEntry     = { name: string; phone: string; email: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeVisibleSteps(hasEmployees: boolean, hasSubs: boolean) {
  const s = [1, 2, 3, 4, 5]
  if (hasEmployees) s.push(6)
  s.push(7)
  if (hasSubs) s.push(8)
  return s
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className="bg-[#2d7a4f] h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  )
}

function NavButtons({
  onBack, onNext, saving, nextLabel, backDisabled,
}: {
  onBack: () => void
  onNext: () => void
  saving: boolean
  nextLabel?: string
  backDisabled?: boolean
}) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="h-12 px-5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={saving}
        className="flex-1 h-12 rounded-xl bg-[#1e3a2a] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#2a4a38] disabled:opacity-60 transition-colors"
      >
        {saving
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <>{nextLabel ?? 'Continue'} <ChevronRight className="h-4 w-4" /></>
        }
      </button>
    </div>
  )
}

function SidebarPreview({ themeIdx }: { themeIdx: number }) {
  const theme = THEME_COLORS[themeIdx]!
  const items = ['Dashboard', 'Dispatch', 'Tickets', 'Invoices', 'Settings']
  return (
    <div
      className="rounded-xl overflow-hidden border border-white/10 shadow-lg w-36"
      style={{ backgroundColor: theme.primary }}
    >
      <div className="px-3 py-3 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ backgroundColor: theme.accent }}>
            <Truck className="h-2.5 w-2.5 text-white" />
          </div>
          <span className="text-[9px] font-bold text-white">DTB</span>
        </div>
      </div>
      <div className="py-2 px-2 space-y-0.5">
        {items.map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[8px] font-medium"
            style={i === 0
              ? { backgroundColor: theme.accent, color: '#fff' }
              : { color: 'rgba(255,255,255,0.5)' }
            }
          >
            <div className="h-2.5 w-2.5 rounded-sm bg-current opacity-70" />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function Confetti() {
  // Use fewer particles on mobile to reduce compositor load
  const count = typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 50
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2,
    color: ['#2d7a4f','#4ade80','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#f97316'][i % 7]!,
    size: 7 + Math.random() * 7,
    rotate: Math.random() > 0.5,
  })), [count])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
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
            animationName: 'confettiFall',
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [done,      setDone]      = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [step,      setStep]      = useState(1)

  // Step 1 – language
  const [locale, setLocale] = useState('en')

  // Step 2 – company info + logo
  const [companyName, setCompanyName] = useState('')
  const [address,     setAddress]     = useState('')
  const [phone,       setPhone]       = useState('')
  const [email,       setEmail]       = useState('')
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Step 3 – business structure
  const [fleetSize,           setFleetSize]           = useState('2-5')
  const [hasEmployees,        setHasEmployees]        = useState(false)
  const [hasSubcontractors,   setHasSubcontractors]   = useState(false)
  const [currentSystem,       setCurrentSystem]       = useState('spreadsheets')
  const [materials,           setMaterials]           = useState<string[]>([])

  // Step 4 – theme
  const [themeIdx, setThemeIdx] = useState(0)

  // Step 5 – sidebar
  const [sidebarItems, setSidebarItems] = useState<string[]>(SIDEBAR_ITEMS.map(s => s.key))

  // Step 6 – drivers (conditional)
  const [addedDrivers, setAddedDrivers] = useState<DriverEntry[]>([])
  const [driverForm,   setDriverForm]   = useState<DriverEntry>({ name: '', email: '', phone: '' })
  const [addingDriver, setAddingDriver] = useState(false)
  const [savedDriverIdx, setSavedDriverIdx] = useState(0)

  // Step 7 – clients
  const [addedClients, setAddedClients] = useState<ClientEntry[]>([])
  const [clientForm,   setClientForm]   = useState<ClientEntry>({ name: '' })
  const [addingClient, setAddingClient] = useState(false)
  const [savedClientIdx, setSavedClientIdx] = useState(0)

  // Step 8 – subcontractors (conditional)
  const [addedSubs, setAddedSubs] = useState<SubEntry[]>([])
  const [subForm,   setSubForm]   = useState<SubEntry>({ name: '', phone: '', email: '' })
  const [addingSub, setAddingSub] = useState(false)
  const [savedSubIdx, setSavedSubIdx] = useState(0)

  // ── Derived ──────────────────────────────────────────────────────────────
  const visibleSteps  = useMemo(() => computeVisibleSteps(hasEmployees, hasSubcontractors), [hasEmployees, hasSubcontractors])
  const currentIdx    = visibleSteps.indexOf(step)
  const totalVisible  = visibleSteps.length
  const isLastStep    = currentIdx === totalVisible - 1

  // ── Init ─────────────────────────────────────────────────────────────────
  // Redirect to dashboard after completion — cleaned up on unmount
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => router.push('/dashboard'), 3000)
    return () => clearTimeout(t)
  }, [done])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const cid = await getCompanyId()
      if (!cid) { router.push('/login'); return }
      setCompanyId(cid)

      const { data: co } = await supabase
        .from('companies')
        .select('name, address, phone, email, onboarding_step, onboarding_completed, has_employees, has_subcontractors')
        .eq('id', cid)
        .maybeSingle()

      if ((co as Record<string, unknown> | null)?.onboarding_completed === true) {
        router.push('/dashboard')
        return
      }

      const emp = !!(co as Record<string, unknown> | null)?.has_employees
      const sub = !!(co as Record<string, unknown> | null)?.has_subcontractors
      setHasEmployees(emp)
      setHasSubcontractors(sub)
      setCompanyName((co as Record<string, unknown> | null)?.name as string ?? '')
      setAddress((co as Record<string, unknown> | null)?.address as string ?? '')
      setPhone((co as Record<string, unknown> | null)?.phone as string ?? '')
      setEmail((co as Record<string, unknown> | null)?.email as string ?? '')

      const saved = (co as Record<string, unknown> | null)?.onboarding_step as number ?? 1
      const vis = computeVisibleSteps(emp, sub)
      const resumeStep = vis.includes(saved) ? saved : (vis.find(s => s >= saved) ?? 1)
      setStep(resumeStep)

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Save & navigate ───────────────────────────────────────────────────────
  async function saveStep(targetStepId: number | 'finish') {
    setSaving(true)
    const updates: Record<string, unknown> = {
      onboarding_step: targetStepId === 'finish' ? 99 : targetStepId,
    }

    // Persist current step data
    if (step === 1) {
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
      updates.preferred_language = locale
    }

    if (step === 2) {
      updates.name    = companyName.trim() || 'My Company'
      updates.address = address || null
      updates.phone   = phone   || null
      updates.email   = email   || null

      if (logoFile) {
        const ext  = logoFile.name.split('.').pop() ?? 'png'
        const path = `${companyId}/logo.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('company-assets')
          .upload(path, logoFile, { upsert: true })
        if (!uploadErr) {
          updates.logo_url = supabase.storage.from('company-assets').getPublicUrl(path).data.publicUrl
        }
      }
    }

    if (step === 3) {
      updates.fleet_size            = fleetSize
      updates.has_employees         = hasEmployees
      updates.has_subcontractors    = hasSubcontractors
      updates.current_system        = currentSystem
      updates.primary_materials     = materials
    }

    if (step === 4) {
      const theme = THEME_COLORS[themeIdx]!
      updates.primary_color = theme.primary
      updates.accent_color  = theme.accent
    }

    if (step === 5) {
      updates.sidebar_items = sidebarItems
    }

    if (step === 6) {
      const newDrivers = addedDrivers.slice(savedDriverIdx)
      if (newDrivers.length > 0) {
        const { error } = await supabase.from('drivers').insert(
          newDrivers.map(d => ({
            company_id: companyId,
            name:       d.name,
            email:      d.email || null,
            phone:      d.phone || null,
            status:     'active',
          }))
        )
        if (!error) setSavedDriverIdx(addedDrivers.length)
      }
    }

    if (step === 7) {
      const newClients = addedClients.slice(savedClientIdx)
      if (newClients.length > 0) {
        const { error } = await supabase.from('client_companies').insert(
          newClients.map(c => ({ company_id: companyId, name: c.name }))
        )
        if (!error) setSavedClientIdx(addedClients.length)
      }
    }

    if (step === 8) {
      const newSubs = addedSubs.slice(savedSubIdx)
      if (newSubs.length > 0) {
        const { error } = await supabase.from('contractors').insert(
          newSubs.map(s => ({
            company_id: companyId,
            name:       s.name,
            phone:      s.phone || null,
            email:      s.email || null,
            status:     'active',
          }))
        )
        if (!error) setSavedSubIdx(addedSubs.length)
      }
    }

    const { error } = await supabase.from('companies').update(updates).eq('id', companyId)
    if (error && !error.message.includes('column')) {
      toast.error('Could not save: ' + error.message)
      setSaving(false)
      return
    }

    if (targetStepId === 'finish') {
      await supabase.from('companies').update({ onboarding_completed: true }).eq('id', companyId)
      setDone(true)
      setSaving(false)
    } else {
      setStep(targetStepId)
      setSaving(false)
    }
  }

  function goNext() {
    const nextIdx = currentIdx + 1
    if (nextIdx < visibleSteps.length) {
      saveStep(visibleSteps[nextIdx]!)
    } else {
      saveStep('finish')
    }
  }

  function goBack() {
    const prevIdx = currentIdx - 1
    if (prevIdx >= 0) {
      setStep(visibleSteps[prevIdx]!)
    }
  }

  // ── Commit helpers ────────────────────────────────────────────────────────
  function commitDriver() {
    if (!driverForm.name.trim()) { toast.error('Driver name required'); return }
    setAddedDrivers(prev => [...prev, driverForm])
    setDriverForm({ name: '', email: '', phone: '' })
    setAddingDriver(false)
  }

  function commitClient() {
    if (!clientForm.name.trim()) { toast.error('Client name required'); return }
    setAddedClients(prev => [...prev, clientForm])
    setClientForm({ name: '' })
    setAddingClient(false)
  }

  function commitSub() {
    if (!subForm.name.trim()) { toast.error('Company name required'); return }
    setAddedSubs(prev => [...prev, subForm])
    setSubForm({ name: '', phone: '', email: '' })
    setAddingSub(false)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5 MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#2d7a4f]" />
      </div>
    )
  }

  // ── Done / Confetti ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-6 relative overflow-hidden">
        <Confetti />
        <div className="relative z-10">
          <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 mx-auto">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">You&apos;re all set!</h1>
          <p className="text-gray-500 text-lg mb-2">DumpTruckBoss is ready to go.</p>
          <p className="text-gray-400 text-sm mb-8">Taking you to your dashboard in a moment…</p>
          <div className="flex items-center justify-center gap-2 text-[#2d7a4f]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading dashboard</span>
          </div>
        </div>
      </div>
    )
  }

  const theme = THEME_COLORS[themeIdx]!

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">

        {/* Logo + Progress */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="h-10 w-10 rounded-xl bg-[#1e3a2a] flex items-center justify-center">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-gray-900">DumpTruckBoss</span>
          </div>
          <ProgressBar current={currentIdx + 1} total={totalVisible} />
          <p className="text-xs text-gray-400 mt-2">Step {currentIdx + 1} of {totalVisible}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{STEP_TITLES[step]}</h1>

          {/* ── Step 1: Language ── */}
          {step === 1 && (
            <div className="space-y-5 mt-4">
              <p className="text-gray-500 text-sm leading-relaxed">
                Let&apos;s get your account set up. It only takes a few minutes.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLocale(lang.code)}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                      locale === lang.code
                        ? 'border-[#2d7a4f] bg-[#2d7a4f]/5'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <span className="text-2xl leading-none">{lang.flag}</span>
                    <span className="font-medium text-gray-900">{lang.label}</span>
                    {locale === lang.code && <Check className="h-4 w-4 text-[#2d7a4f] ml-auto" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-[#1e3a2a] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#2a4a38] disabled:opacity-60 transition-colors"
              >
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <>Get Started <ChevronRight className="h-4 w-4" /></>
                }
              </button>
            </div>
          )}

          {/* ── Step 2: Company Info ── */}
          {step === 2 && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-500 text-sm">This appears on invoices and client-facing documents.</p>

              {/* Logo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo <span className="text-gray-400 font-normal">(optional)</span></label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="h-full object-contain rounded-xl p-2" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Tap to upload logo</span>
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Smith Hauling LLC"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Address</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St, City, ST 12345"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/30 focus:border-[#2d7a4f]"
                  />
                </div>
              </div>
              <NavButtons onBack={goBack} onNext={goNext} saving={saving} backDisabled={currentIdx === 0} />
            </div>
          )}

          {/* ── Step 3: Business Structure ── */}
          {step === 3 && (
            <div className="space-y-5 mt-4">
              <p className="text-gray-500 text-sm">Help us personalize your experience.</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">How big is your fleet?</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {FLEET_SIZES.map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFleetSize(f.key)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        fleetSize === f.key
                          ? 'border-[#2d7a4f] bg-[#2d7a4f]/5'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-900">{f.label}</span>
                      <span className="text-xs text-gray-400">{f.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Team</label>
                <button
                  type="button"
                  onClick={() => setHasEmployees(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    hasEmployees ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center border-2 transition-colors ${hasEmployees ? 'bg-[#2d7a4f] border-[#2d7a4f]' : 'border-gray-300'}`}>
                      {hasEmployees && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-900">I have employees / drivers</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setHasSubcontractors(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    hasSubcontractors ? 'border-[#2d7a4f] bg-[#2d7a4f]/5' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center border-2 transition-colors ${hasSubcontractors ? 'bg-[#2d7a4f] border-[#2d7a4f]' : 'border-gray-300'}`}>
                      {hasSubcontractors && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-900">I use subcontractors</span>
                  </div>
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">What are you currently using?</label>
                <div className="grid grid-cols-2 gap-2">
                  {CURRENT_SYSTEMS.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setCurrentSystem(s.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        currentSystem === s.key
                          ? 'border-[#2d7a4f] bg-[#2d7a4f]/5'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-base">{s.emoji}</span>
                      <span className="text-xs font-medium text-gray-700">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">What do you haul? <span className="text-gray-400 font-normal">(select all that apply)</span></label>
                <div className="flex flex-wrap gap-2">
                  {MATERIAL_OPTIONS.map(m => {
                    const on = materials.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMaterials(prev => on ? prev.filter(x => x !== m) : [...prev, m])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          on
                            ? 'bg-[#2d7a4f] text-white border-[#2d7a4f]'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              <NavButtons onBack={goBack} onNext={goNext} saving={saving} />
            </div>
          )}

          {/* ── Step 4: Color Theme ── */}
          {step === 4 && (
            <div className="space-y-5 mt-4">
              <p className="text-gray-500 text-sm">You can change this any time in Settings.</p>
              <div className="flex gap-6 items-start">
                <div className="flex-1 space-y-2">
                  {THEME_COLORS.map((t, i) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setThemeIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        themeIdx === i
                          ? 'border-[#2d7a4f] bg-[#2d7a4f]/5'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex -space-x-1.5 shrink-0">
                        <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: t.primary }} />
                        <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: t.accent }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      {themeIdx === i && <Check className="h-4 w-4 text-[#2d7a4f] ml-auto" />}
                    </button>
                  ))}
                </div>
                <div className="shrink-0 pt-1">
                  <p className="text-[10px] text-gray-400 text-center mb-2 font-medium">PREVIEW</p>
                  <SidebarPreview themeIdx={themeIdx} />
                </div>
              </div>
              <NavButtons onBack={goBack} onNext={goNext} saving={saving} />
            </div>
          )}

          {/* ── Step 5: Sidebar Features ── */}
          {step === 5 && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-500 text-sm">Choose what appears in your sidebar. You can always adjust this later.</p>
              <div className="space-y-1.5">
                {SIDEBAR_ITEMS.map(item => {
                  const on = sidebarItems.includes(item.key)
                  const Icon = item.icon
                  const locked = item.key === 'dashboard' || item.key === 'settings'
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return
                        setSidebarItems(prev =>
                          on ? prev.filter(k => k !== item.key) : [...prev, item.key]
                        )
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        on
                          ? 'border-[#2d7a4f]/40 bg-[#2d7a4f]/5'
                          : 'border-gray-100 bg-gray-50/50 opacity-60'
                      } ${locked ? 'cursor-default' : 'hover:border-gray-300'}`}
                    >
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-[#2d7a4f]/15' : 'bg-gray-200/60'}`}>
                        <Icon className={`h-3.5 w-3.5 ${on ? 'text-[#2d7a4f]' : 'text-gray-400'}`} />
                      </div>
                      <span className={`flex-1 text-sm font-medium text-left ${on ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</span>
                      {locked
                        ? <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Always on</span>
                        : (
                          <div className={`h-5 w-9 rounded-full transition-colors relative ${on ? 'bg-[#2d7a4f]' : 'bg-gray-200'}`}>
                            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                        )
                      }
                    </button>
                  )
                })}
              </div>
              <NavButtons onBack={goBack} onNext={goNext} saving={saving} />
            </div>
          )}

          {/* ── Step 6: Drivers (conditional) ── */}
          {step === 6 && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-500 text-sm">Add the drivers on your team. You can add more later.</p>

              {addedDrivers.length > 0 && (
                <div className="space-y-2">
                  {addedDrivers.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.name}</p>
                        {d.phone && <p className="text-xs text-gray-500">{d.phone}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddedDrivers(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingDriver ? (
                <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input
                      value={driverForm.name}
                      onChange={e => setDriverForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="John Smith"
                      className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input
                        value={driverForm.phone}
                        onChange={e => setDriverForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 000-0000"
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={driverForm.email}
                        onChange={e => setDriverForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="driver@email.com"
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddingDriver(false)} className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={commitDriver} className="flex-1 h-9 rounded-xl bg-[#1e3a2a] text-white text-sm font-medium">Add Driver</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingDriver(true)}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add a Driver
                </button>
              )}

              <NavButtons
                onBack={goBack}
                onNext={goNext}
                saving={saving}
                nextLabel={addedDrivers.length === 0 && !addingDriver ? 'Skip for now' : undefined}
              />
            </div>
          )}

          {/* ── Step 7: Clients ── */}
          {step === 7 && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-500 text-sm">Add the companies and contractors you haul for. You can add more later.</p>

              {addedClients.length > 0 && (
                <div className="space-y-2">
                  {addedClients.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <button
                        type="button"
                        onClick={() => setAddedClients(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingClient ? (
                <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Company / Client Name *</label>
                    <input
                      value={clientForm.name}
                      onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="ABC Construction LLC"
                      className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddingClient(false)} className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={commitClient} className="flex-1 h-9 rounded-xl bg-[#1e3a2a] text-white text-sm font-medium">Add Client</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingClient(true)}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add a Client
                </button>
              )}

              <NavButtons
                onBack={goBack}
                onNext={goNext}
                saving={saving}
                nextLabel={isLastStep ? 'Finish Setup' : (addedClients.length === 0 && !addingClient ? 'Skip for now' : undefined)}
              />
            </div>
          )}

          {/* ── Step 8: Subcontractors (conditional) ── */}
          {step === 8 && (
            <div className="space-y-4 mt-4">
              <p className="text-gray-500 text-sm">Add the subcontractors you work with. You can add more later.</p>

              {addedSubs.length > 0 && (
                <div className="space-y-2">
                  {addedSubs.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        {s.phone && <p className="text-xs text-gray-500">{s.phone}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddedSubs(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingSub ? (
                <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
                    <input
                      value={subForm.name}
                      onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Acme Hauling Co."
                      className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input
                        value={subForm.phone}
                        onChange={e => setSubForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="(555) 000-0000"
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={subForm.email}
                        onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="contact@sub.com"
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2d7a4f]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAddingSub(false)} className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={commitSub} className="flex-1 h-9 rounded-xl bg-[#1e3a2a] text-white text-sm font-medium">Add Sub</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSub(true)}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add a Subcontractor
                </button>
              )}

              <NavButtons
                onBack={goBack}
                onNext={goNext}
                saving={saving}
                nextLabel={
                  addedSubs.length === 0 && !addingSub
                    ? 'Finish Setup'
                    : 'Finish Setup'
                }
              />
            </div>
          )}

        </div>

        {/* Bail-out link */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={() => saveStep('finish')}
            disabled={saving}
            className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
          >
            Skip setup and go straight to dashboard
          </button>
        </div>

        {/* Theme preview strip at bottom */}
        {step !== 4 && (
          <div
            className="mt-6 h-1 rounded-full mx-auto w-16 transition-all"
            style={{ backgroundColor: theme.accent }}
          />
        )}
      </div>
    </div>
  )
}
