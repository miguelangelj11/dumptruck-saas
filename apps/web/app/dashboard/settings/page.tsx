'use client'

import { useState, useEffect, useRef } from 'react'
import { getCompanyId } from '@/lib/get-company-id'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, Building2, Upload, X, Palette, Globe,
  FileText, Users, Bell, CreditCard, Shield, Download,
  Check, AlertTriangle, Mail, Lock, Eye, EyeOff, Truck, Clock,
  Hash, Package, Link2,
} from 'lucide-react'
import type { ClientCompany } from '@/lib/types'
import LanguageSelector from '@/components/language-selector'

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanyRow = {
  id: string
  name: string
  address: string | null
  phone: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
}

type CompanyExtRow = CompanyRow & {
  invoice_prefix: string | null
  invoice_starting_number: number | null
  default_due_days: number | null
  default_invoice_notes: string | null
  default_payment_instructions: string | null
  invoice_show_truck: boolean | null
  invoice_show_time: boolean | null
  invoice_show_ticket_number: boolean | null
  invoice_show_material: boolean | null
  notification_email: string | null
  notify_new_ticket: boolean | null
  notify_ticket_approved: boolean | null
  notify_invoice_sent: boolean | null
  notify_payment_received: boolean | null
  notify_invoice_overdue: boolean | null
  notify_document_expiring: boolean | null
  notify_missing_tickets: boolean | null
  invoice_email_signature: string | null
}

type DriverRow = {
  id: string
  name: string
  email: string | null
  status: string
  created_at: string
}

type TruckRow = {
  id: string
  truck_number: string
  notes: string | null
  created_at: string
}

type MemberRow = {
  id: string
  email: string
  role: string
  created_at: string
  accepted_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_PRESETS = [
  { label: 'Forest Green',  primary: '#1e3a2a', accent: '#2d7a4f' },
  { label: 'Ocean Blue',    primary: '#1e3a5a', accent: '#2d5a7a' },
  { label: 'Midnight Navy', primary: '#1a1f35', accent: '#2d3a6a' },
  { label: 'Burnt Orange',  primary: '#5a2e1e', accent: '#8a4a2a' },
  { label: 'Deep Purple',   primary: '#2e1e5a', accent: '#4a2d8a' },
  { label: 'Charcoal',      primary: '#2a2a2a', accent: '#4a4a4a' },
  { label: 'Burgundy',      primary: '#5a1e2e', accent: '#8a2a42' },
  { label: 'Slate',         primary: '#1e2e3a', accent: '#2d4a5a' },
]

const DUE_DAYS_OPTIONS = [0, 15, 30, 45, 60]

// ─── CSV helper ───────────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) { toast.error('No data to export'); return }
  const headers = Object.keys(rows[0]!)
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: filename,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Small shared components ──────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-4 border-b border-gray-100">
      <h2 className="font-semibold text-sm text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // ── Company / profile state ─────────────────────────────────────────────
  const [saving,         setSaving]         = useState(false)
  const [userId,         setUserId]         = useState('')
  const [email,          setEmail]          = useState('')
  const [fullName,       setFullName]       = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone,   setCompanyPhone]   = useState('')

  // ── Logo / branding state ───────────────────────────────────────────────
  const [logoUrl,       setLogoUrl]       = useState<string | null>(null)
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [primaryColor, setPrimaryColor] = useState('#1e3a2a')
  const [accentColor,  setAccentColor]  = useState('#2d7a4f')
  const [savingTheme,  setSavingTheme]  = useState(false)

  // ── Client companies state ──────────────────────────────────────────────
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([])
  const [newCompanyName,    setNewCompanyName]    = useState('')
  const [newCompanyAddress, setNewCompanyAddress] = useState('')
  const [addingCompany,   setAddingCompany]   = useState(false)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)

  // ── Trucks state ────────────────────────────────────────────────────────
  const [trucks,          setTrucks]          = useState<TruckRow[]>([])
  const [newTruckNum,     setNewTruckNum]     = useState('')
  const [newTruckNotes,   setNewTruckNotes]   = useState('')
  const [addingTruck,     setAddingTruck]     = useState(false)
  const [deletingTruckId, setDeletingTruckId] = useState<string | null>(null)

  // ── Invoice settings state ───────────────────────────────────────────────
  const [invPrefix,     setInvPrefix]     = useState('INV-')
  const [invStartNum,   setInvStartNum]   = useState(1000)
  const [invDueDays,    setInvDueDays]    = useState(30)
  const [invNotes,      setInvNotes]      = useState('')
  const [invPayInstr,   setInvPayInstr]   = useState('')
  const [invShowTruck,  setInvShowTruck]  = useState(true)
  const [invShowTime,   setInvShowTime]   = useState(true)
  const [invShowTicket, setInvShowTicket] = useState(true)
  const [invShowMat,    setInvShowMat]    = useState(true)
  const [invSignature,  setInvSignature]  = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  // ── Notifications state ──────────────────────────────────────────────────
  const [notifEmail,      setNotifEmail]      = useState('')
  const [notifyNewTicket, setNotifyNewTicket] = useState(true)
  const [notifyApproved,  setNotifyApproved]  = useState(false)
  const [notifyInvSent,   setNotifyInvSent]   = useState(true)
  const [notifyPayment,   setNotifyPayment]   = useState(true)
  const [notifyOverdue,   setNotifyOverdue]   = useState(true)
  const [notifyExpiring,  setNotifyExpiring]  = useState(true)
  const [notifyMissing,     setNotifyMissing]     = useState(false)
  const [autoSendReminders,  setAutoSendReminders]  = useState(false)
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true)
  const [savingNotify,        setSavingNotify]        = useState(false)

  // ── Team state ───────────────────────────────────────────────────────────
  const [drivers,          setDrivers]          = useState<DriverRow[]>([])
  const [members,          setMembers]          = useState<MemberRow[]>([])
  const [inviteEmail,      setInviteEmail]      = useState('')
  const [inviteRole,       setInviteRole]       = useState('Driver')
  const [sendingInvite,    setSendingInvite]    = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  // ── Security state ───────────────────────────────────────────────────────
  const [newEmail,        setNewEmail]        = useState('')
  const [emailCurrentPwd, setEmailCurrentPwd] = useState('')
  const [showEmailPwd,    setShowEmailPwd]    = useState(false)
  const [savingEmail,     setSavingEmail]     = useState(false)
  const [newPwd,          setNewPwd]          = useState('')
  const [confirmPwd,      setConfirmPwd]      = useState('')
  const [currentPwd,      setCurrentPwd]      = useState('')
  const [showPwd,         setShowPwd]         = useState(false)
  const [showCurrentPwd,  setShowCurrentPwd]  = useState(false)
  const [savingPwd,       setSavingPwd]       = useState(false)
  const [mfaEnabled,   setMfaEnabled]   = useState(false)
  const [mfaFactorId,  setMfaFactorId]  = useState<string | null>(null)
  const [mfaStep,      setMfaStep]      = useState<'idle' | 'enrolling'>('idle')
  const [mfaQrCode,    setMfaQrCode]    = useState('')
  const [mfaSecret,    setMfaSecret]    = useState('')
  const [mfaCode,      setMfaCode]      = useState('')
  const [mfaLoading,   setMfaLoading]   = useState(false)
  const [delDataInput,    setDelDataInput]    = useState('')
  const [delAccInput,     setDelAccInput]     = useState('')
  const [deletingData,    setDeletingData]    = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // ── Subscription state ───────────────────────────────────────────────────
  const [subscriptionStatus,   setSubscriptionStatus]   = useState<string | null>(null)
  const [subscriptionPlan,     setSubscriptionPlan]     = useState<string | null>(null)
  const [subscriptionOverride, setSubscriptionOverride] = useState<string | null>(null)
  const [isSuperAdmin,         setIsSuperAdmin]         = useState(false)
  const [trialEndsAtSub,       setTrialEndsAtSub]       = useState<string | null>(null)
  const [stripeCustomerId,     setStripeCustomerId]     = useState<string | null>(null)
  const [portalLoading,        setPortalLoading]        = useState(false)
  const [upgradePlanLoading,   setUpgradePlanLoading]   = useState(false)

  // ── Export state ─────────────────────────────────────────────────────────
  const today      = new Date().toISOString().split('T')[0]!
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]!
  const [expStart,  setExpStart]  = useState(monthStart)
  const [expEnd,    setExpEnd]    = useState(today)
  const [exporting, setExporting] = useState<string | null>(null)

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      setEmail(user.email ?? '')

      const companySelect = 'id, name, address, phone, logo_url, primary_color, accent_color'

      // 1. Profile lookup — single source of truth for both owners and team members
      const { data: prof, error: profFetchErr } = await supabase
        .from('profiles')
        .select('organization_id, full_name')
        .eq('id', user.id)
        .maybeSingle()

      console.log('[settings] profile fetch:', { prof, error: profFetchErr?.message })

      const loadedFullName = (prof as Record<string, unknown> | null)?.full_name
      if (typeof loadedFullName === 'string' && loadedFullName) {
        console.log('[settings] loaded full_name:', loadedFullName)
        setFullName(loadedFullName)
      }

      let co: CompanyRow | null = null

      if (prof?.organization_id) {
        const { data } = await supabase
          .from('companies')
          .select(companySelect)
          .eq('id', prof.organization_id)
          .maybeSingle()
        co = data as CompanyRow | null
      }

      // 2. Fallback: owner lookup
      if (!co) {
        const { data, error } = await supabase
          .from('companies')
          .select(companySelect)
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) console.error('[settings] company fetch:', error.message)
        co = data as CompanyRow | null
      }

      // 3. Fallback: team_members lookup
      if (!co) {
        const { data: mem } = await supabase
          .from('team_members')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (mem?.company_id) {
          const { data: teamCo } = await supabase
            .from('companies')
            .select(companySelect)
            .eq('id', mem.company_id)
            .maybeSingle()
          co = teamCo as CompanyRow | null
        }
      }

      if (co) {
        const c = co as CompanyRow
        setCompanyId(c.id)
        setCompanyName(c.name ?? '')
        setCompanyAddress(c.address ?? '')
        setCompanyPhone(c.phone ?? '')
        setLogoUrl(c.logo_url ?? null)
        setPrimaryColor(c.primary_color ?? '#1e3a2a')
        setAccentColor(c.accent_color ?? '#2d7a4f')
        setNotifEmail(user.email ?? '')

        // Extended columns — silently ignored if migration hasn't run
        const { data: ext } = await supabase
          .from('companies')
          .select([
            'invoice_prefix', 'invoice_starting_number', 'default_due_days',
            'default_invoice_notes', 'default_payment_instructions',
            'invoice_show_truck', 'invoice_show_time',
            'invoice_show_ticket_number', 'invoice_show_material',
            'notification_email',
            'notify_new_ticket', 'notify_ticket_approved', 'notify_invoice_sent',
            'notify_payment_received', 'notify_invoice_overdue',
            'notify_document_expiring', 'notify_missing_tickets',
            'auto_send_reminders',
            'weekly_report_enabled',
            'invoice_email_signature',
          ].join(','))
          .eq('id', c.id)
          .maybeSingle()

        if (ext) {
          const x = ext as Partial<CompanyExtRow>
          if (x.invoice_prefix              != null) setInvPrefix(x.invoice_prefix)
          if (x.invoice_starting_number     != null) setInvStartNum(x.invoice_starting_number)
          if (x.default_due_days            != null) setInvDueDays(x.default_due_days)
          if (x.default_invoice_notes       != null) setInvNotes(x.default_invoice_notes ?? '')
          if (x.default_payment_instructions != null) setInvPayInstr(x.default_payment_instructions ?? '')
          if (x.invoice_show_truck          != null) setInvShowTruck(x.invoice_show_truck)
          if (x.invoice_show_time           != null) setInvShowTime(x.invoice_show_time)
          if (x.invoice_show_ticket_number  != null) setInvShowTicket(x.invoice_show_ticket_number)
          if (x.invoice_show_material       != null) setInvShowMat(x.invoice_show_material)
          if (x.notification_email          != null) setNotifEmail(x.notification_email ?? user.email ?? '')
          if (x.notify_new_ticket           != null) setNotifyNewTicket(x.notify_new_ticket)
          if (x.notify_ticket_approved      != null) setNotifyApproved(x.notify_ticket_approved)
          if (x.notify_invoice_sent         != null) setNotifyInvSent(x.notify_invoice_sent)
          if (x.notify_payment_received     != null) setNotifyPayment(x.notify_payment_received)
          if (x.notify_invoice_overdue      != null) setNotifyOverdue(x.notify_invoice_overdue)
          if (x.notify_document_expiring    != null) setNotifyExpiring(x.notify_document_expiring)
          if (x.notify_missing_tickets      != null) setNotifyMissing(x.notify_missing_tickets)
          if ((x as Record<string, unknown>).auto_send_reminders  != null) setAutoSendReminders((x as Record<string, unknown>).auto_send_reminders as boolean)
          if ((x as Record<string, unknown>).weekly_report_enabled != null) setWeeklyReportEnabled((x as Record<string, unknown>).weekly_report_enabled as boolean)
          if (x.invoice_email_signature             != null) setInvSignature(x.invoice_email_signature ?? '')
        }

        const { data: driversData } = await supabase
          .from('drivers')
          .select('id, name, email, status, created_at')
          .eq('company_id', c.id)
          .order('name')
        setDrivers(driversData ?? [])

        fetchTrucks(c.id)
        fetchMembers(c.id)

        // Subscription data
        const { data: subData } = await supabase
          .from('companies')
          .select('subscription_status, plan, trial_ends_at, stripe_customer_id, is_super_admin, subscription_override')
          .eq('id', c.id)
          .maybeSingle()
        if (subData) {
          const s = subData as Record<string, unknown>
          setSubscriptionStatus(s.subscription_status as string | null ?? null)
          setSubscriptionPlan(s.plan as string | null ?? null)
          setSubscriptionOverride(s.subscription_override as string | null ?? null)
          setIsSuperAdmin(!!(s.is_super_admin))
          setTrialEndsAtSub(s.trial_ends_at as string | null ?? null)
          setStripeCustomerId(s.stripe_customer_id as string | null ?? null)
        }
      } else {
        setNotifEmail(user.email ?? '')
      }

      // Load existing MFA factor
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find((f: { status: string }) => f.status === 'verified')
      if (totp) { setMfaEnabled(true); setMfaFactorId(totp.id) }

      getCompanyId().then(orgId => { if (orgId) fetchClientCompanies(orgId) })
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleUpgradePlan(plan: string) {
    setUpgradePlanLoading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
    } catch { /* fall through */ }
    setUpgradePlanLoading(false)
    toast.error('Could not start checkout')
  }

  async function handleOpenPortal() {
    setPortalLoading(true)
    const res  = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      toast.error(data.error ?? 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  async function fetchClientCompanies(uid: string) {
    const { data } = await supabase
      .from('client_companies')
      .select('*')
      .eq('company_id', uid)
      .order('name')
    setClientCompanies(data ?? [])
  }

  async function fetchTrucks(cid: string) {
    const { data } = await supabase
      .from('trucks')
      .select('id, truck_number, notes, created_at')
      .eq('company_id', cid)
      .order('truck_number')
    setTrucks(data ?? [])
  }

  async function fetchMembers(cid: string) {
    const { data } = await supabase
      .from('invitations')
      .select('id, email, role, created_at, accepted_at')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
    setMembers((data ?? []) as MemberRow[])
  }

  async function handleRemoveMember(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team?`)) return
    setDeletingMemberId(id)
    const { error } = await supabase.from('invitations').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${email} removed`)
      setMembers(prev => prev.filter(m => m.id !== id))
    }
    setDeletingMemberId(null)
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim()) { toast.error('Company name is required'); return }
    setSaving(true)

    if (companyId) {
      const { error } = await supabase
        .from('companies')
        .update({
          name:    companyName.trim(),
          address: companyAddress.trim() || null,
          phone:   companyPhone.trim() || null,
        })
        .eq('id', companyId)
      if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          owner_id: userId,
          name:     companyName.trim(),
          address:  companyAddress.trim() || null,
          phone:    companyPhone.trim() || null,
        })
        .select('id')
        .maybeSingle()
      if (error) { toast.error('Failed to create company: ' + error.message); setSaving(false); return }
      if (data?.id) setCompanyId(data.id)
    }

    await supabase.auth.updateUser({ data: { company_name: companyName.trim() } })

    // Save full_name to the user's profile row (upsert handles missing row)
    if (userId) {
      const nameToSave = fullName.trim() || null
      console.log('[settings] saving full_name:', nameToSave, 'for user:', userId)
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: nameToSave }, { onConflict: 'id' })
      if (profErr) console.error('[settings] full_name save error:', profErr.message)
      else console.log('[settings] full_name saved ok')
    }

    toast.success('Company info saved')
    setSaving(false)
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5MB'); return }
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleLogoUpload() {
    const file = logoInputRef.current?.files?.[0]
    if (!file || !companyId) { toast.error('Save company info first, then upload a logo'); return }
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${companyId}/logo.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadErr) { toast.error('Upload failed: ' + uploadErr.message); setUploadingLogo(false); return }
    const { data: { publicUrl } } = supabase.storage.from('company-logos').getPublicUrl(path)
    const { error: updateErr } = await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', companyId)
    if (updateErr) {
      toast.error('Failed to save logo URL: ' + updateErr.message)
    } else {
      setLogoUrl(publicUrl)
      setLogoPreview(null)
      toast.success('Logo uploaded')
    }
    setUploadingLogo(false)
  }

  async function handleRemoveLogo() {
    if (!companyId) return
    await supabase.from('companies').update({ logo_url: null }).eq('id', companyId)
    setLogoUrl(null)
    setLogoPreview(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
    toast.success('Logo removed')
  }

  function applyThemePreview(primary: string, accent: string) {
    document.documentElement.style.setProperty('--hf-sidebar-bg', primary)
    document.documentElement.style.setProperty('--hf-sidebar-accent', accent)
    setPrimaryColor(primary)
    setAccentColor(accent)
  }

  async function handleSaveTheme() {
    if (!companyId) { toast.error('Save company info first'); return }
    setSavingTheme(true)
    const { error } = await supabase
      .from('companies')
      .update({ primary_color: primaryColor, accent_color: accentColor })
      .eq('id', companyId)
    if (error) toast.error('Failed to save theme: ' + error.message)
    else toast.success('Theme saved')
    setSavingTheme(false)
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!newCompanyName.trim()) return
    if (!companyId) { toast.error('Save company info first'); return }
    setAddingCompany(true)
    const { error } = await supabase
      .from('client_companies')
      .insert({ name: newCompanyName.trim(), address: newCompanyAddress.trim() || null, company_id: companyId })
    if (error) { toast.error(error.message); setAddingCompany(false); return }
    toast.success(`"${newCompanyName.trim()}" added`)
    setNewCompanyName('')
    setNewCompanyAddress('')
    setAddingCompany(false)
    getCompanyId().then(orgId => { if (orgId) fetchClientCompanies(orgId) })
  }

  async function handleDeleteCompany(id: string, name: string) {
    if (!confirm(`Remove "${name}" from your list?`)) return
    setDeletingId(id)
    const { error } = await supabase.from('client_companies').delete().eq('id', id)
    if (error) toast.error('Failed to remove: ' + error.message)
    else {
      toast.success(`"${name}" removed`)
      setClientCompanies(prev => prev.filter(c => c.id !== id))
    }
    setDeletingId(null)
  }

  async function handleAddTruck(e: React.FormEvent) {
    e.preventDefault()
    if (!newTruckNum.trim() || !companyId) return
    setAddingTruck(true)
    const { error } = await supabase
      .from('trucks')
      .insert({ company_id: companyId, truck_number: newTruckNum.trim(), notes: newTruckNotes.trim() || null })
    if (error) { toast.error(error.message); setAddingTruck(false); return }
    toast.success(`Truck ${newTruckNum.trim()} added`)
    setNewTruckNum('')
    setNewTruckNotes('')
    fetchTrucks(companyId)
    setAddingTruck(false)
  }

  async function handleDeleteTruck(id: string, num: string) {
    if (!confirm(`Remove truck ${num}?`)) return
    setDeletingTruckId(id)
    const { error } = await supabase.from('trucks').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(`Truck ${num} removed`); setTrucks(prev => prev.filter(t => t.id !== id)) }
    setDeletingTruckId(null)
  }

  async function handleSaveInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) { toast.error('Save company info first'); return }
    setSavingInvoice(true)
    const { error } = await supabase.from('companies').update({
      invoice_prefix:               invPrefix || 'INV-',
      invoice_starting_number:      invStartNum,
      default_due_days:             invDueDays,
      default_invoice_notes:        invNotes || null,
      default_payment_instructions: invPayInstr || null,
      invoice_show_truck:           invShowTruck,
      invoice_show_time:            invShowTime,
      invoice_show_ticket_number:   invShowTicket,
      invoice_show_material:        invShowMat,
      invoice_email_signature:              invSignature || null,
    }).eq('id', companyId)
    if (error) toast.error(error.message)
    else toast.success('Invoice settings saved')
    setSavingInvoice(false)
  }

  async function handleSaveNotify(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) { toast.error('Save company info first'); return }
    setSavingNotify(true)
    const { error } = await supabase.from('companies').update({
      notification_email:       notifEmail || null,
      notify_new_ticket:        notifyNewTicket,
      notify_ticket_approved:   notifyApproved,
      notify_invoice_sent:      notifyInvSent,
      notify_payment_received:  notifyPayment,
      notify_invoice_overdue:   notifyOverdue,
      notify_document_expiring: notifyExpiring,
      notify_missing_tickets:   notifyMissing,
      auto_send_reminders:      autoSendReminders,
      weekly_report_enabled:    weeklyReportEnabled,
    }).eq('id', companyId)
    if (error) toast.error(error.message)
    else toast.success('Notification preferences saved')
    setSavingNotify(false)
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !companyId) return
    setSendingInvite(true)

    const res  = await fetch('/api/team/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: inviteEmail.trim(), role: inviteRole.toLowerCase() }),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error(`Member added but invite email failed: ${json.error}`)
    } else {
      toast.success(`Invite sent to ${inviteEmail}`)
    }

    setInviteEmail('')
    if (companyId) fetchMembers(companyId)
    setSendingInvite(false)
  }

  async function handleRemoveDriver(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return
    const { error } = await supabase.from('drivers').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(`${name} removed`); setDrivers(prev => prev.filter(d => d.id !== id)) }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim() || !emailCurrentPwd) return
    setSavingEmail(true)

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: emailCurrentPwd })
    if (authErr) { toast.error('Incorrect password'); setSavingEmail(false); return }

    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) toast.error(error.message)
    else {
      toast.success('Confirmation sent — check your current inbox to approve the change')
      setNewEmail('')
      setEmailCurrentPwd('')
    }
    setSavingEmail(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPwd) { toast.error('Enter your current password'); return }
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match'); return }
    if (newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSavingPwd(true)

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd })
    if (authErr) { toast.error('Incorrect current password'); setSavingPwd(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }
    setSavingPwd(false)
  }

  async function handleMfaEnable() {
    setMfaLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) { toast.error(error.message); setMfaLoading(false); return }
    setMfaFactorId(data.id)
    setMfaQrCode(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaStep('enrolling')
    setMfaLoading(false)
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactorId || mfaCode.length !== 6) return
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode })
    if (error) { toast.error(error.message); setMfaLoading(false); return }
    setMfaEnabled(true)
    setMfaStep('idle')
    setMfaCode('')
    toast.success('Two-factor authentication enabled')
    setMfaLoading(false)
  }

  async function handleMfaDisable() {
    if (!mfaFactorId) return
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) { toast.error(error.message); setMfaLoading(false); return }
    setMfaEnabled(false)
    setMfaFactorId(null)
    setMfaQrCode('')
    setMfaSecret('')
    setMfaStep('idle')
    toast.success('Two-factor authentication disabled')
    setMfaLoading(false)
  }

  async function handleDeleteData() {
    setDeletingData(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'data' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to delete data'); return }
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setDeletingData(false)
      setDelDataInput('')
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'account' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to delete account'); return }
      await supabase.auth.signOut()
      toast.success('Account deleted successfully')
      setTimeout(() => { window.location.href = 'https://dumptruckboss.com' }, 1500)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setDeletingAccount(false)
      setDelAccInput('')
    }
  }

  async function handleExport(type: 'tickets' | 'invoices' | 'payments' | 'expenses') {
    setExporting(type)
    try {
      if (type === 'tickets') {
        const { data } = await supabase.from('loads').select('*')
          .eq('company_id', userId).gte('date', expStart).lte('date', expEnd).order('date', { ascending: false })
        downloadCSV((data ?? []) as Record<string, unknown>[], `tickets_${expStart}_${expEnd}.csv`)
      } else if (type === 'invoices') {
        const { data } = await supabase.from('invoices').select('*')
          .eq('company_id', userId).order('created_at', { ascending: false })
        downloadCSV((data ?? []) as Record<string, unknown>[], `invoices_${today}.csv`)
      } else if (type === 'payments') {
        const { data } = await supabase.from('payments').select('*')
          .eq('company_id', userId).order('payment_date', { ascending: false })
        downloadCSV((data ?? []) as Record<string, unknown>[], `payments_${today}.csv`)
      } else if (type === 'expenses') {
        const { data } = await supabase.from('expenses').select('*')
          .eq('company_id', userId).gte('date', expStart).lte('date', expEnd).order('date', { ascending: false })
        downloadCSV((data ?? []) as Record<string, unknown>[], `expenses_${expStart}_${expEnd}.csv`)
      }
    } catch { toast.error('Export failed') }
    setExporting(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" />
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]'
  const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and company preferences</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          1. COMPANY INFORMATION
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Company Information" subtitle="Appears on invoices and documents" />
        <form onSubmit={handleSaveCompany} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className={inputCls}
              placeholder="ACME TRUCKING LLC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Address</label>
            <textarea
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              placeholder="123 Main St, City, State 12345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={companyPhone}
              onChange={e => setCompanyPhone(e.target.value)}
              className={inputCls}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className={inputCls}
              placeholder="e.g. John Smith"
            />
            <p className="text-xs text-gray-400 mt-1">Shown in the welcome message and sidebar.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">To change your email, use Account Security below.</p>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. CLIENT COMPANIES
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader
          title="Client Companies"
          subtitle='These appear in the ticket form dropdown under "Working Under (Company)"'
        />
        <div className="p-6 space-y-4">
          <form onSubmit={handleAddCompany} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                placeholder="Company name…"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button
                type="submit"
                disabled={addingCompany || !newCompanyName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {addingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
            <input
              value={newCompanyAddress}
              onChange={e => setNewCompanyAddress(e.target.value)}
              placeholder="Address (optional) — auto-fills on invoices"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </form>

          {clientCompanies.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
              <Building2 className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No client companies added yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Add the contractors and companies your drivers work under</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {clientCompanies.map(c => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-[var(--brand-dark)]/10 flex items-center justify-center">
                      <Building2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      {c.address && <p className="text-xs text-gray-400 mt-0.5">{c.address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.portal_token && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/client-portal/${c.portal_token}`)
                          toast.success(`Portal link copied for ${c.name}`)
                        }}
                        title="Copy client portal link"
                        className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"
                        aria-label={`Copy portal link for ${c.name}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCompany(c.id, c.name)}
                      disabled={deletingId === c.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      aria-label={`Remove ${c.name}`}
                    >
                      {deletingId === c.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          3. BRANDING
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Company Branding" subtitle="Your logo appears on invoices and in the sidebar" />
        <div className="p-6">
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
              {(logoPreview ?? logoUrl) ? (
                <Image
                  src={logoPreview ?? logoUrl!}
                  alt="Company logo"
                  width={80}
                  height={80}
                  className="object-contain w-full h-full"
                />
              ) : (
                <Upload className="h-6 w-6 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Company Logo</p>
                <p className="text-xs text-gray-400">PNG, JPG, or SVG · Max 5MB · Recommended 200×200px</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoUrl || logoPreview ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={uploadingLogo || !companyId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {uploadingLogo ? 'Uploading…' : 'Save Logo'}
                  </button>
                )}
                {(logoUrl || logoPreview) && !uploadingLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null)
                      if (logoInputRef.current) logoInputRef.current.value = ''
                      if (logoUrl) handleRemoveLogo()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              {!companyId && (
                <p className="text-xs text-amber-500">Save your company info before uploading a logo.</p>
              )}
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoFileChange}
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Appearance" subtitle="Customize your sidebar and accent colors" />
        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Color Theme</p>
            <div className="flex flex-wrap gap-3">
              {THEME_PRESETS.map(preset => {
                const isActive = primaryColor === preset.primary
                return (
                  <button
                    key={preset.primary}
                    type="button"
                    title={preset.label}
                    onClick={() => applyThemePreview(preset.primary, preset.accent)}
                    className={`relative h-9 w-9 rounded-full transition-transform hover:scale-110 focus:outline-none ${isActive ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                    style={{ backgroundColor: preset.primary }}
                  >
                    {isActive && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Sidebar Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => applyThemePreview(e.target.value, accentColor)}
                  className="h-9 w-16 rounded cursor-pointer border border-gray-200"
                />
                <span className="text-xs text-gray-400 font-mono">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => applyThemePreview(primaryColor, e.target.value)}
                  className="h-9 w-16 rounded cursor-pointer border border-gray-200"
                />
                <span className="text-xs text-gray-400 font-mono">{accentColor}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Palette className="h-3.5 w-3.5" />
            Changes preview live on the sidebar
          </div>

          <button
            type="button"
            onClick={handleSaveTheme}
            disabled={savingTheme || !companyId}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--hf-sidebar-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {savingTheme && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingTheme ? 'Saving…' : 'Save Theme'}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Language" subtitle="Choose your preferred display language" />
        <div className="p-6">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-gray-400" />
            <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
              <LanguageSelector companyId={companyId} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Changing the language will also update how invoices are printed.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. TRUCK MANAGEMENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Truck Management" subtitle="Track your fleet — truck numbers appear in dispatch and tickets" />
        <div className="p-6 space-y-4">
          <form onSubmit={handleAddTruck} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newTruckNum}
                onChange={e => setNewTruckNum(e.target.value)}
                placeholder="Truck number (e.g. SA07)"
                className="w-full sm:flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <input
                value={newTruckNotes}
                onChange={e => setNewTruckNotes(e.target.value)}
                placeholder="Assigned driver (optional)"
                className="w-full sm:flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button
                type="submit"
                disabled={addingTruck || !newTruckNum.trim() || !companyId}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 shrink-0"
              >
                {addingTruck ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Truck
              </button>
            </div>
          </form>

          {trucks.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
              <Truck className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No trucks added yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Add truck numbers to track your fleet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {trucks.map(t => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-[var(--brand-dark)]/10 flex items-center justify-center">
                      <Truck className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">#{t.truck_number}</span>
                      {t.notes && <span className="text-xs text-gray-400 ml-2">{t.notes}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTruck(t.id, t.truck_number)}
                    disabled={deletingTruckId === t.id}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label={`Remove truck ${t.truck_number}`}
                  >
                    {deletingTruckId === t.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          5. INVOICE SETTINGS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Invoice Settings" subtitle="Defaults applied to all new invoices" />
        <form onSubmit={handleSaveInvoice} className="p-6 space-y-6">

          {/* Numbering */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">Invoice Numbering</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Number Prefix
                  <span className="text-xs text-gray-400 font-normal ml-1">e.g. &quot;INV-&quot;</span>
                </label>
                <input
                  value={invPrefix}
                  onChange={e => setInvPrefix(e.target.value)}
                  maxLength={10}
                  placeholder="INV-"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Starting Number</label>
                <input
                  type="number"
                  min={1}
                  value={invStartNum}
                  onChange={e => setInvStartNum(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Due Days</label>
                <select
                  value={invDueDays}
                  onChange={e => setInvDueDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                >
                  {DUE_DAYS_OPTIONS.map(d => (
                    <option key={d} value={d}>{d === 0 ? 'Due on receipt' : `Net ${d}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                Preview: <span className="font-mono font-semibold text-gray-700">{invPrefix}{String(invStartNum).padStart(4, '0')}</span>
              </p>
            </div>
          </div>

          {/* Column toggles */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Show / Hide Invoice Columns</p>
            <p className="text-xs text-gray-400 mb-3">Toggle which columns appear on printed invoices</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { icon: Truck,   label: 'Show Truck # column',  val: invShowTruck,  set: setInvShowTruck  },
                { icon: Clock,   label: 'Show Time column',      val: invShowTime,   set: setInvShowTime   },
                { icon: Hash,    label: 'Show Ticket # column',  val: invShowTicket, set: setInvShowTicket },
                { icon: Package, label: 'Show Material column',  val: invShowMat,    set: setInvShowMat    },
              ] as const).map(({ icon: Icon, label, val, set }) => (
                <label
                  key={label}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon className="h-4 w-4 text-gray-400" />{label}
                  </span>
                  <Toggle on={val} onChange={set} />
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Invoice Notes / Terms
            </label>
            <p className="text-xs text-gray-400 mb-1.5">Appears at the bottom of every invoice</p>
            <textarea
              value={invNotes}
              onChange={e => setInvNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Thank you for your business. Payment due within 30 days."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </div>

          {/* Payment instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Payment Instructions
            </label>
            <p className="text-xs text-gray-400 mb-1.5">How clients should pay you</p>
            <textarea
              value={invPayInstr}
              onChange={e => setInvPayInstr(e.target.value)}
              rows={2}
              placeholder="e.g. Make checks payable to ACME TRUCKING LLC"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </div>

          {/* Email signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Signature</label>
            <p className="text-xs text-gray-400 mb-1.5">Appended to invoice emails</p>
            <textarea
              value={invSignature}
              onChange={e => setInvSignature(e.target.value)}
              rows={3}
              placeholder={'e.g. Thank you,\nJohn Smith\nACME TRUCKING LLC'}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </div>

          <button type="submit" disabled={savingInvoice || !companyId} className={btnPrimary}>
            {savingInvoice && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingInvoice ? 'Saving…' : 'Save Invoice Settings'}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          6. NOTIFICATIONS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Email Notifications" subtitle="Choose what events send you an email alert" />
        <form onSubmit={handleSaveNotify} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notification Email Address
            </label>
            <p className="text-xs text-gray-400 mb-1.5">Where alerts are sent — defaults to your account email</p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={notifEmail}
                onChange={e => setNotifEmail(e.target.value)}
                placeholder={email}
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">Notify me when…</p>
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {([
                { label: 'New ticket submitted by driver', val: notifyNewTicket, set: setNotifyNewTicket },
                { label: 'Ticket approved',                val: notifyApproved,  set: setNotifyApproved  },
                { label: 'Invoice sent to client',         val: notifyInvSent,   set: setNotifyInvSent   },
                { label: 'Payment received',               val: notifyPayment,   set: setNotifyPayment   },
                { label: 'Invoice overdue (15+ days)',     val: notifyOverdue,   set: setNotifyOverdue   },
                { label: 'Document expiring soon',         val: notifyExpiring,  set: setNotifyExpiring  },
                { label: 'Driver has missing tickets',     val: notifyMissing,   set: setNotifyMissing   },
              ] as const).map(({ label, val, set }) => (
                <label
                  key={label}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <Toggle on={val} onChange={set} />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Automation</p>
            <p className="text-xs text-gray-500 mb-3">DumpTruckBoss acts on your behalf to collect faster</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
              <label className="flex items-start justify-between px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors gap-3">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Auto-send payment reminders</p>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically email clients on day 1 and day 3 overdue (max 2 per invoice)</p>
                </div>
                <Toggle on={autoSendReminders} onChange={setAutoSendReminders} />
              </label>
              <label className="flex items-start justify-between px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors gap-3">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Weekly performance report</p>
                  <p className="text-xs text-gray-500 mt-0.5">Receive a summary of your week every Monday morning</p>
                </div>
                <Toggle on={weeklyReportEnabled} onChange={setWeeklyReportEnabled} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={savingNotify || !companyId} className={btnPrimary}>
            {savingNotify && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingNotify ? 'Saving…' : 'Save Notifications'}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          7. TEAM MEMBERS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Team Members" subtitle="Manage drivers and staff who access the platform" />
        <div className="p-6 space-y-6">

          {/* Role descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { role: 'Admin',      color: 'bg-purple-100 text-purple-700', desc: 'Full access to everything' },
              { role: 'Dispatcher', color: 'bg-blue-100 text-blue-700',    desc: 'Tickets, dispatch, and drivers' },
              { role: 'Driver',     color: 'bg-green-100 text-green-700',  desc: 'Submit tickets only' },
              { role: 'Accountant', color: 'bg-amber-100 text-amber-700',  desc: 'Invoices and revenue only' },
            ].map(r => (
              <div key={r.role} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${r.color}`}>{r.role}</span>
                <p className="text-xs text-gray-600">{r.desc}</p>
              </div>
            ))}
          </div>

          {/* Invite form — locked for owner_operator */}
          {subscriptionPlan === 'owner_operator' ? (
            <div className="border-t border-gray-100 pt-5">
              <div className="rounded-xl border border-[#F5B731]/40 p-5 flex items-start gap-4" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2000 100%)' }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F5B731' }}>
                  <Lock className="h-5 w-5 text-[#1a1a1a]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Team logins require the Fleet Plan</p>
                  <p className="text-xs text-white/60 mt-1 mb-4">
                    Owner Operator is a single-user plan. Upgrade to Fleet to add dispatchers, drivers, and accountants as team members with their own logins.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setUpgradePlanLoading(true)
                      try {
                        const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'fleet' }) })
                        const d = await res.json()
                        if (d.url) { window.location.href = d.url; return }
                      } catch { /* fall through */ }
                      setUpgradePlanLoading(false)
                    }}
                    disabled={upgradePlanLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
                    style={{ background: '#F5B731', color: '#1a1a1a' }}
                  >
                    {upgradePlanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Upgrade to Fleet — $200/mo →
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSendInvite} className="space-y-4 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-800">Add Team Member</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="driver@email.com"
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                >
                  {['Admin', 'Dispatcher', 'Driver', 'Accountant'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={sendingInvite || !companyId} className={btnPrimary}>
              {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {sendingInvite ? 'Adding…' : 'Add Member'}
            </button>
            <p className="text-xs text-gray-400">
              The team member must sign up with this email address to access the platform.
            </p>
          </form>
          )}

          {/* Current Members */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              Current Members
              {members.length > 0 && (
                <span className="text-xs text-gray-400 font-normal ml-2">
                  {members.filter(m => !!m.accepted_at).length} active · {members.filter(m => !m.accepted_at).length} pending
                </span>
              )}
            </p>
            {members.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No team members yet</p>
                <p className="text-xs text-gray-300 mt-0.5">Invite someone above to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {members.map(m => {
                  const isActive = !!m.accepted_at
                  const initials = m.email.charAt(0).toUpperCase()
                  return (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.email}</p>
                          <p className="text-xs text-gray-400">
                            <span className="capitalize">{m.role}</span>
                            {' · '}
                            {isActive
                              ? `Joined ${new Date(m.accepted_at!).toLocaleDateString()}`
                              : `Invited ${new Date(m.created_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isActive ? 'Active' : 'Pending'}
                        </span>
                        <button
                          onClick={() => handleRemoveMember(m.id, m.email)}
                          disabled={deletingMemberId === m.id}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          aria-label={`Remove ${m.email}`}
                        >
                          {deletingMemberId === m.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          UPGRADE PROMPT — owner_operator only
      ═══════════════════════════════════════════════════════════════════ */}
      {subscriptionPlan === 'owner_operator' && (
        <div className="rounded-xl border border-[#F5B731]/30 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #1e1800 100%)' }}>
          <div className="px-6 pt-6 pb-4">
            <p className="text-base font-bold text-white">Unlock More Features</p>
            <p className="text-xs text-white/50 mt-1">Upgrade to Fleet ($200/mo) to stop leaving money on the table.</p>
          </div>
          <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: '🔍',
                title: 'Missing Ticket Detection',
                desc: 'Automatically find loads where tickets never came in. Stop losing $500–$2,000/month to missing paperwork.',
              },
              {
                icon: '🤝',
                title: 'Subcontractor Management',
                desc: 'Track subs, their loads, and what you owe them — all in one place with automated billing.',
              },
              {
                icon: '⚡',
                title: 'Follow-Up Automation',
                desc: 'Automatically chase overdue invoices and missing tickets so you don\'t have to make awkward calls.',
              },
            ].map(card => (
              <div key={card.title} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                <span className="text-2xl">{card.icon}</span>
                <p className="text-sm font-bold text-white">{card.title}</p>
                <p className="text-xs text-white/50 flex-1">{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={async () => {
                setUpgradePlanLoading(true)
                try {
                  const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'fleet' }) })
                  const d = await res.json()
                  if (d.url) { window.location.href = d.url; return }
                } catch { /* fall through */ }
                setUpgradePlanLoading(false)
              }}
              disabled={upgradePlanLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
              style={{ background: '#F5B731', color: '#1a1a1a' }}
            >
              {upgradePlanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Upgrade to Fleet — $200/mo →
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          8. DATA EXPORT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Data Export" subtitle="Download your data as CSV files" />
        <div className="p-6 space-y-5">

          {/* Date range */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Date Range (for tickets and expenses)</p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">From</label>
                <input
                  type="date"
                  value={expStart}
                  onChange={e => setExpStart(e.target.value)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">To</label>
                <input
                  type="date"
                  value={expEnd}
                  onChange={e => setExpEnd(e.target.value)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Export cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { key: 'tickets'  as const, icon: FileText,   title: 'Tickets / Loads',  desc: `${expStart} → ${expEnd}`,  iconColor: 'text-blue-600',   bg: 'bg-blue-50'   },
              { key: 'invoices' as const, icon: CreditCard, title: 'Invoices',          desc: 'Full history',             iconColor: 'text-green-600',  bg: 'bg-green-50'  },
              { key: 'payments' as const, icon: Check,      title: 'Driver Payments',   desc: 'Full history',             iconColor: 'text-purple-600', bg: 'bg-purple-50' },
              { key: 'expenses' as const, icon: Building2,  title: 'Expenses',          desc: `${expStart} → ${expEnd}`,  iconColor: 'text-amber-600',  bg: 'bg-amber-50'  },
            ]).map(({ key, icon: Icon, title, desc, iconColor, bg }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4 flex items-start gap-3">
                <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => handleExport(key)}
                  disabled={exporting !== null}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exporting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting === key ? 'Exporting…' : 'CSV'}
                </button>
              </div>
            ))}
          </div>

          {/* Export all */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Export Everything</p>
              <p className="text-xs text-gray-400 mt-0.5">Downloads all four CSVs at once</p>
            </div>
            <button
              onClick={async () => {
                setExporting('all')
                await handleExport('tickets')
                await handleExport('invoices')
                await handleExport('payments')
                await handleExport('expenses')
                toast.success('All exports downloaded')
                setExporting(null)
              }}
              disabled={exporting !== null}
              className={btnPrimary}
            >
              {exporting === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting === 'all' ? 'Exporting…' : 'Export All'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          9. SUBSCRIPTION
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Subscription" subtitle="Manage your plan and billing" />
        <div className="p-6 space-y-5">

          {/* Plan + status badge */}
          {(() => {
            // Super admin — owner account with lifetime full access
            if (isSuperAdmin || subscriptionOverride) {
              return (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">👑 Owner — Growth Plan</div>
                    <div className="text-xs text-gray-400 mt-0.5">Lifetime free access — all features unlocked</div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">Owner</span>
                </div>
              )
            }

            const isTrial = subscriptionStatus === 'trial' || (!subscriptionStatus && !!trialEndsAtSub)
            const msLeft  = trialEndsAtSub ? new Date(trialEndsAtSub).getTime() - Date.now() : null
            const daysLeft = msLeft !== null ? Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24))) : null
            const trialExpired = msLeft !== null && msLeft <= 0
            const urgent  = daysLeft !== null && daysLeft <= 3

            const planLabel =
              subscriptionPlan === 'owner_operator' ? 'Owner Operator Plan' :
              subscriptionPlan === 'fleet'          ? 'Fleet Plan' :
              subscriptionPlan === 'enterprise'     ? 'Enterprise Plan' :
              'Free Trial'

            const statusLabel =
              subscriptionStatus === 'active'    ? 'Paid subscription' :
              subscriptionStatus === 'past_due'  ? 'Payment failed' :
              subscriptionStatus === 'canceled'  ? 'Canceled' :
              isTrial && trialExpired            ? 'Trial expired' :
              isTrial                            ? 'Free trial' :
              'No subscription'

            const badgeClass =
              subscriptionStatus === 'active'   ? 'bg-green-100 text-green-700' :
              subscriptionStatus === 'past_due' ? 'bg-red-100 text-red-700'     :
              subscriptionStatus === 'canceled' ? 'bg-gray-100 text-gray-500'   :
              isTrial && urgent                 ? 'bg-red-100 text-red-700'     :
              isTrial                           ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'

            const badgeText =
              subscriptionStatus === 'active'    ? 'Active'   :
              subscriptionStatus === 'past_due'  ? 'Past Due' :
              subscriptionStatus === 'canceled'  ? 'Canceled' :
              isTrial && trialExpired            ? 'Expired'  :
              isTrial && daysLeft !== null       ? `${daysLeft}d left` :
              'Trial'

            return (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{planLabel}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{statusLabel}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {badgeText}
                </span>
              </div>
            )
          })()}

          {/* Trial progress bar — hidden for super admin */}
          {!isSuperAdmin && !subscriptionOverride && trialEndsAtSub && (() => {
            const totalMs  = 14 * 24 * 60 * 60 * 1000
            const msLeft   = new Date(trialEndsAtSub).getTime() - Date.now()
            const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
            const pct      = Math.max(0, Math.min(100, (msLeft / totalMs) * 100))
            const urgent   = daysLeft <= 3
            const expired  = msLeft <= 0
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Trial period</span>
                  <span className={`text-xs font-semibold ${expired ? 'text-red-600' : urgent ? 'text-red-600' : 'text-amber-600'}`}>
                    {expired ? 'Trial ended' : daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${expired ? 'bg-red-400' : urgent ? 'bg-red-500' : 'bg-amber-400'}`}
                    style={{ width: `${expired ? 100 : pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {expired ? 'Expired' : 'Expires'}{' '}
                  {new Date(trialEndsAtSub).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )
          })()}

          {/* Next-tier upsell card — hidden for super admin */}
          {!isSuperAdmin && !subscriptionOverride && (() => {
            // Normalize plan key — handles null, '', 'owner' (Stripe metadata key), unknown values
            const normalizePlan = (p: string | null): 'owner_operator' | 'fleet' | 'enterprise' => {
              if (p === 'fleet')      return 'fleet'
              if (p === 'enterprise') return 'enterprise'
              return 'owner_operator' // null, '', 'owner', or anything else → base tier
            }

            const NEXT: Record<'owner_operator' | 'fleet' | 'enterprise', { label: string; price: string; checkoutKey: string | null; features: string[] } | null> = {
              owner_operator: {
                label:       'Fleet Plan',
                price:       '$200/mo',
                checkoutKey: 'fleet',
                features: [
                  'Unlimited trucks & drivers',
                  'Subcontractor management & pay stubs',
                  'Missing ticket detection',
                  'Follow-up automation engine',
                  'Team access (unlimited users)',
                  'AI document reader (50/mo)',
                ],
              },
              fleet: {
                label:       'Growth Plan',
                price:       '$350/mo',
                checkoutKey: 'growth',
                features: [
                  'CRM Growth Pipeline',
                  'Lead & job tracking',
                  'Quote builder (convert quotes → jobs → invoices)',
                  'Advanced job profitability',
                  'Mobile ticket with signature capture',
                  'AI document reader (400/mo)',
                ],
              },
              enterprise: null,
            }

            const currentPlan = normalizePlan(subscriptionPlan)
            const next = NEXT[currentPlan]

            // Enterprise — top plan confirmation (only for explicitly enterprise accounts)
            if (currentPlan === 'enterprise') {
              return (
                <div className="rounded-xl border-2 border-[var(--brand-primary)]/30 bg-[#f0f9f4] p-4 flex items-start gap-3">
                  <span className="text-xl mt-0.5">🏆</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-dark)]">You&apos;re on our top plan</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Enterprise gives you everything DumpTruckBoss offers. Contact us any time at{' '}
                      <a href="mailto:hello@dumptruckboss.com" className="text-[var(--brand-primary)] underline">hello@dumptruckboss.com</a>.
                    </p>
                  </div>
                </div>
              )
            }

            // TypeScript narrowing — next is non-null for owner_operator and fleet
            if (!next) return null

            // Only show upsell for trial, active, or no-status (new accounts)
            if (subscriptionStatus === 'canceled' || subscriptionStatus === 'expired') return null

            return (
              <div className="rounded-xl border-2 border-[var(--brand-primary)]/20 bg-[#f0f9f4] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[var(--brand-primary)] uppercase tracking-wide">Next tier up</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{next.label} — {next.price}</p>
                  </div>
                  <span className="text-xs bg-[var(--brand-primary)] text-white px-2.5 py-1 rounded-full font-semibold">Upgrade</span>
                </div>
                <ul className="space-y-1">
                  {next.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-[var(--brand-primary)] font-bold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {next.checkoutKey ? (
                  <button
                    onClick={() => handleUpgradePlan(next.checkoutKey!)}
                    disabled={upgradePlanLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-60"
                  >
                    {upgradePlanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {upgradePlanLoading ? 'Redirecting…' : `Upgrade to ${next.label} →`}
                  </button>
                ) : (
                  <a
                    href="/schedule-demo"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
                  >
                    <CreditCard className="h-4 w-4" />
                    Talk to Sales →
                  </a>
                )}
              </div>
            )
          })()}

          {/* Billing portal / manage subscription — hidden for super admin */}
          {!isSuperAdmin && !subscriptionOverride && (stripeCustomerId || (!subscriptionPlan && !stripeCustomerId)) && (
            <div className="flex flex-wrap gap-2">
              {stripeCustomerId && (
                <button
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {subscriptionStatus === 'active' ? 'Manage Subscription' : 'Billing Portal'}
                </button>
              )}
              {!stripeCustomerId && !subscriptionPlan && (
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  View Plans
                </a>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          10. ACCOUNT SECURITY
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Change Email Address" subtitle="Confirm with your password — a verification link will be sent to your current address" />
        <form onSubmit={handleChangeEmail} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Email</label>
            <input value={email} disabled className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showEmailPwd ? 'text' : 'password'}
                required
                value={emailCurrentPwd}
                onChange={e => setEmailCurrentPwd(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button type="button" onClick={() => setShowEmailPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showEmailPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
          </div>
          <button type="submit" disabled={savingEmail || !newEmail.trim() || !emailCurrentPwd} className={btnPrimary}>
            {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingEmail ? 'Sending…' : 'Update Email'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Change Password" subtitle="Must be at least 8 characters" />
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showCurrentPwd ? 'text' : 'password'}
                required
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button type="button" onClick={() => setShowCurrentPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <button type="submit" disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd} className={btnPrimary}>
            {savingPwd && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingPwd ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Authenticator App (TOTP)</p>
              <p className="text-xs text-gray-400 mt-0.5">Use Google Authenticator or Authy</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${mfaEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </span>
              {mfaEnabled ? (
                <button
                  onClick={handleMfaDisable}
                  disabled={mfaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {mfaLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Disable
                </button>
              ) : mfaStep === 'idle' ? (
                <button
                  onClick={handleMfaEnable}
                  disabled={mfaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {mfaLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Enable
                </button>
              ) : null}
            </div>
          </div>

          {mfaStep === 'enrolling' && (
            <div className="border border-gray-100 rounded-xl p-5 space-y-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">Scan this QR code with your authenticator app</p>
              {mfaQrCode && (
                <img
                  src={mfaQrCode}
                  alt="2FA QR code"
                  className="w-40 h-40 rounded-lg border border-gray-200 bg-white p-1"
                />
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Or enter this key manually:</p>
                <code className="block text-xs font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 break-all text-gray-800 select-all">
                  {mfaSecret}
                </code>
              </div>
              <form onSubmit={handleMfaVerify} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enter the 6-digit code from your app</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={mfaLoading || mfaCode.length !== 6}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {mfaLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify &amp; Enable
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaStep('idle'); setMfaCode(''); setMfaQrCode(''); setMfaSecret('') }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border-2 border-red-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="font-semibold text-sm text-red-700">Danger Zone</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Delete All Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cancels your subscription and permanently removes all tickets, invoices, dispatch records, and company data. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={delDataInput}
                onChange={e => setDelDataInput(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                disabled={deletingData}
                className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 disabled:opacity-50"
              />
              <button
                onClick={handleDeleteData}
                disabled={delDataInput !== 'DELETE' || deletingData}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deletingData && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingData ? 'Deleting…' : 'Delete Data'}
              </button>
            </div>
          </div>

          <div className="border-t border-red-100" />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Delete Account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cancels your subscription and permanently deletes your account, all data, and all records. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={delAccInput}
                onChange={e => setDelAccInput(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                disabled={deletingAccount}
                className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 disabled:opacity-50"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={delAccInput !== 'DELETE' || deletingAccount}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingAccount ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
