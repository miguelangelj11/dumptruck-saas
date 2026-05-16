'use client'

import { useState, useEffect, useRef } from 'react'
import { getCompanyId } from '@/lib/get-company-id'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  Loader2, Plus, Trash2, Building2, Upload, X, Palette, Globe,
  FileText, Users, Bell, CreditCard, Shield, Download,
  Check, AlertTriangle, Mail, Lock, Eye, EyeOff, Truck, Clock,
  Hash, Package, Link2, Pencil, Database, ChevronRight, BarChart2,
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
  const t = useTranslations('settings')
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // ── Company / profile state ─────────────────────────────────────────────
  const [saving,         setSaving]         = useState(false)
  const [userId,         setUserId]         = useState('')
  const [email,          setEmail]          = useState('')
  const [fullName,       setFullName]       = useState('')
  const [companyId,        setCompanyId]        = useState('')
  const [companyName,      setCompanyName]      = useState('')
  const [companyAddress,   setCompanyAddress]   = useState('')
  const [companyPhone,     setCompanyPhone]     = useState('')
  const [revenueGoal,      setRevenueGoal]      = useState('')

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
  const [newCompanyName,         setNewCompanyName]         = useState('')
  const [newCompanyAddress,      setNewCompanyAddress]      = useState('')
  const [newCompanyEmail,        setNewCompanyEmail]        = useState('')
  const [newCompanyPhone,        setNewCompanyPhone]        = useState('')
  const [newCompanyPaymentTerms, setNewCompanyPaymentTerms] = useState('net_30')
  const [newCompanyTaxExempt,    setNewCompanyTaxExempt]    = useState(false)
  const [newCompanyTaxExemptCert,setNewCompanyTaxExemptCert]= useState('')
  const [addingCompany,   setAddingCompany]   = useState(false)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)
  const [editingCompany,  setEditingCompany]  = useState<ClientCompany | null>(null)
  const [editForm, setEditForm] = useState({ name: '', address: '', email: '', phone: '', payment_terms: 'net_30', tax_exempt: false, tax_exempt_cert: '' })
  const [savingEdit, setSavingEdit] = useState(false)

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
  const [exportingMyData, setExportingMyData] = useState(false)

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

      const companySelect = 'id, name, address, phone, logo_url, primary_color, accent_color, monthly_revenue_goal'

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
        const goal = (c as unknown as Record<string, unknown>).monthly_revenue_goal
        if (goal != null) setRevenueGoal(String(goal))
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
          name:                 companyName.trim(),
          address:              companyAddress.trim() || null,
          phone:                companyPhone.trim() || null,
          monthly_revenue_goal: revenueGoal.trim() ? parseInt(revenueGoal.trim(), 10) || null : null,
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
      .insert({ name: newCompanyName.trim(), address: newCompanyAddress.trim() || null, email: newCompanyEmail.trim() || null, phone: newCompanyPhone.trim() || null, company_id: companyId, payment_terms: newCompanyPaymentTerms || 'net_30', tax_exempt: newCompanyTaxExempt, tax_exempt_cert: newCompanyTaxExemptCert.trim() || null })
    if (error) { toast.error(error.message); setAddingCompany(false); return }
    toast.success(`"${newCompanyName.trim()}" added`)
    setNewCompanyName('')
    setNewCompanyAddress('')
    setNewCompanyEmail('')
    setNewCompanyPhone('')
    setNewCompanyPaymentTerms('net_30')
    setNewCompanyTaxExempt(false)
    setNewCompanyTaxExemptCert('')
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

  async function handleSaveEditCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCompany || !editForm.name.trim()) return
    setSavingEdit(true)
    const { error } = await supabase
      .from('client_companies')
      .update({ name: editForm.name.trim(), address: editForm.address.trim() || null, email: editForm.email.trim() || null, phone: editForm.phone.trim() || null, payment_terms: editForm.payment_terms || 'net_30', tax_exempt: editForm.tax_exempt, tax_exempt_cert: editForm.tax_exempt_cert.trim() || null })
      .eq('id', editingCompany.id)
    if (error) { toast.error(error.message); setSavingEdit(false); return }
    toast.success(`"${editForm.name.trim()}" updated`)
    setClientCompanies(prev => prev.map(c => c.id === editingCompany.id
      ? { ...c, name: editForm.name.trim(), address: editForm.address.trim() || null, email: editForm.email.trim() || null, phone: editForm.phone.trim() || null, payment_terms: editForm.payment_terms || 'net_30', tax_exempt: editForm.tax_exempt, tax_exempt_cert: editForm.tax_exempt_cert.trim() || null }
      : c
    ))
    setEditingCompany(null)
    setSavingEdit(false)
  }

  async function handleAddTruck(e: React.FormEvent) {
    e.preventDefault()
    if (!newTruckNum.trim() || !companyId) return
    // Enforce per-plan truck limits
    const truckLimit = subscriptionPlan === 'solo' ? 1 : (subscriptionPlan === 'pro' || subscriptionPlan === 'owner_operator') ? 5 : null
    if (truckLimit !== null && trucks.length >= truckLimit) {
      const nextPlan = subscriptionPlan === 'solo' ? 'Owner Operator Pro ($80/mo)' : 'Fleet ($200/mo)'
      toast.error(`Truck limit (${truckLimit}) reached. Upgrade to ${nextPlan} for more trucks.`)
      return
    }
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

  async function handleExportMyData() {
    setExportingMyData(true)
    try {
      const res = await fetch('/api/user/export')
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'dumptruckboss-export.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Export failed — check your connection')
    } finally {
      setExportingMyData(false)
    }
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
    <>
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          1. COMPANY INFORMATION
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('companyInfo')} subtitle={t('companyInfoSubtitle')} />
        <form onSubmit={handleSaveCompany} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('companyName')} <span className="text-red-400">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('companyAddress')}</label>
            <textarea
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              placeholder="123 Main St, City, State 12345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('phoneNumber')}</label>
            <input
              type="tel"
              value={companyPhone}
              onChange={e => setCompanyPhone(e.target.value)}
              className={inputCls}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Revenue Goal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                value={revenueGoal}
                onChange={e => setRevenueGoal(e.target.value)}
                className="w-full rounded-lg border border-gray-200 pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                placeholder="e.g. 50000"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Shows a progress bar on your dashboard. Leave blank to hide.</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('email')}</label>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">{t('emailNote')}</p>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? t('saving') : t('saveChanges')}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. CLIENT COMPANIES
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader
          title={t('clientCompanies')}
          subtitle={t('clientCompaniesSubtitle')}
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
                {t('addCompany')}
              </button>
            </div>
            <input
              value={newCompanyAddress}
              onChange={e => setNewCompanyAddress(e.target.value)}
              placeholder="Address (optional) — auto-fills on invoices"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="email"
                value={newCompanyEmail}
                onChange={e => setNewCompanyEmail(e.target.value)}
                placeholder="Email (for sending invoices)"
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <input
                type="tel"
                value={newCompanyPhone}
                onChange={e => setNewCompanyPhone(e.target.value)}
                placeholder="Phone (for SMS invoices)"
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
              <select value={newCompanyPaymentTerms} onChange={e => setNewCompanyPaymentTerms(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="2_10_net_30">2/10 Net 30</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={newCompanyTaxExempt} onChange={e => setNewCompanyTaxExempt(e.target.checked)} className="w-4 h-4 rounded" />
                Tax Exempt
              </label>
            </div>
            {newCompanyTaxExempt && (
              <input type="text" value={newCompanyTaxExemptCert} onChange={e => setNewCompanyTaxExemptCert(e.target.value)} placeholder="Exemption certificate number" className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
            )}
          </form>

          {clientCompanies.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
              <Building2 className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('noClientCompanies')}</p>
              <p className="text-xs text-gray-300 mt-0.5">{t('clientCompaniesHint')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {clientCompanies.map(c => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-[var(--brand-dark)]/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      {c.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.address}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {c.email && <p className="text-xs text-blue-500">{c.email}</p>}
                        {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                      onClick={() => { setEditingCompany(c); setEditForm({ name: c.name, address: c.address ?? '', email: c.email ?? '', phone: c.phone ?? '', payment_terms: c.payment_terms ?? 'net_30', tax_exempt: c.tax_exempt ?? false, tax_exempt_cert: c.tax_exempt_cert ?? '' }) }}
                      className="p-1.5 text-gray-400 hover:text-[var(--brand-primary)] transition-colors"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
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
        <SectionHeader title={t('branding')} subtitle={t('brandingSubtitle')} />
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
                <p className="text-sm font-medium text-gray-700 mb-1">{t('companyLogo')}</p>
                <p className="text-xs text-gray-400">{t('logoHint')}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoUrl || logoPreview ? t('changeLogo') : t('uploadLogo')}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={uploadingLogo || !companyId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {uploadingLogo ? t('saving') : t('saveLogo')}
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
                    <X className="h-3.5 w-3.5" /> {t('remove')}
                  </button>
                )}
              </div>
              {!companyId && (
                <p className="text-xs text-amber-500">{t('saveCompanyFirst')}</p>
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
        <SectionHeader title={t('appearance')} subtitle={t('appearanceSubtitle')} />
        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t('colorTheme')}</p>
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('sidebarBg')}</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('accentColor')}</label>
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
            {t('livePreview')}
          </div>

          <button
            type="button"
            onClick={handleSaveTheme}
            disabled={savingTheme || !companyId}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--hf-sidebar-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {savingTheme && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingTheme ? t('saving') : t('saveTheme')}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('language')} subtitle={t('languageSubtitle')} />
        <div className="p-6">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-gray-400" />
            <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
              <LanguageSelector companyId={companyId} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {t('languageNote')}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. TRUCK MANAGEMENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('trucks')} subtitle={t('trucksSubtitle')} />
        <div className="p-6 space-y-4">
          <form onSubmit={handleAddTruck} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newTruckNum}
                onChange={e => setNewTruckNum(e.target.value)}
                placeholder={t('truckNumber')}
                className="w-full sm:flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <input
                value={newTruckNotes}
                onChange={e => setNewTruckNotes(e.target.value)}
                placeholder={t('truckDriver')}
                className="w-full sm:flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
              <button
                type="submit"
                disabled={addingTruck || !newTruckNum.trim() || !companyId}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 shrink-0"
              >
                {addingTruck ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('addTruck')}
              </button>
            </div>
          </form>

          {trucks.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
              <Truck className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('noTrucks')}</p>
              <p className="text-xs text-gray-300 mt-0.5">{t('trucksHint')}</p>
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
        <SectionHeader title={t('invoiceSettingsTitle')} subtitle={t('invoiceSettingsSubtitle')} />
        <form onSubmit={handleSaveInvoice} className="p-6 space-y-6">

          {/* Numbering */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">{t('invoiceNumbering')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('numberPrefix')}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('startingNumber')}</label>
                <input
                  type="number"
                  min={1}
                  value={invStartNum}
                  onChange={e => setInvStartNum(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('defaultDueDays')}</label>
                <select
                  value={invDueDays}
                  onChange={e => setInvDueDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                >
                  {DUE_DAYS_OPTIONS.map(d => (
                    <option key={d} value={d}>{d === 0 ? t('dueOnReceipt') : t('netDays', { days: d })}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                {t('previewLabel', { prefix: invPrefix, number: String(invStartNum).padStart(4, '0') })}
              </p>
            </div>
          </div>

          {/* Column toggles */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">{t('showHideColumns')}</p>
            <p className="text-xs text-gray-400 mb-3">{t('columnsSubtitle')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { icon: Truck,   labelKey: 'showTruckCol' as const,  val: invShowTruck,  set: setInvShowTruck  },
                { icon: Clock,   labelKey: 'showTimeCol' as const,   val: invShowTime,   set: setInvShowTime   },
                { icon: Hash,    labelKey: 'showTicketCol' as const, val: invShowTicket, set: setInvShowTicket },
                { icon: Package, labelKey: 'showMaterialCol' as const, val: invShowMat,  set: setInvShowMat    },
              ]).map(({ icon: Icon, labelKey, val, set }) => (
                <label
                  key={labelKey}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon className="h-4 w-4 text-gray-400" />{t(labelKey)}
                  </span>
                  <Toggle on={val} onChange={set} />
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('defaultInvoiceNotes')}
            </label>
            <p className="text-xs text-gray-400 mb-1.5">{t('invoiceNotesSubtitle')}</p>
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
              {t('defaultPaymentInstructions')}
            </label>
            <p className="text-xs text-gray-400 mb-1.5">{t('paymentInstructionsSubtitle')}</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('emailSignature')}</label>
            <p className="text-xs text-gray-400 mb-1.5">{t('emailSignatureSubtitle')}</p>
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
            {savingInvoice ? t('saving') : t('saveInvoiceSettings')}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          6. NOTIFICATIONS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('notifications')} subtitle={t('notificationsSubtitle')} />
        <form onSubmit={handleSaveNotify} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('notificationEmail')}
            </label>
            <p className="text-xs text-gray-400 mb-1.5">{t('notificationEmailSubtitle')}</p>
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
            <p className="text-sm font-semibold text-gray-800 mb-3">{t('notifyWhen')}</p>
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
              {([
                { labelKey: 'notifyNewTicket' as const,      val: notifyNewTicket, set: setNotifyNewTicket },
                { labelKey: 'notifyTicketApproved' as const, val: notifyApproved,  set: setNotifyApproved  },
                { labelKey: 'notifyInvoiceSent' as const,    val: notifyInvSent,   set: setNotifyInvSent   },
                { labelKey: 'notifyPaymentReceived' as const,val: notifyPayment,   set: setNotifyPayment   },
                { labelKey: 'notifyInvoiceOverdue' as const, val: notifyOverdue,   set: setNotifyOverdue   },
                { labelKey: 'notifyDocExpiring' as const,    val: notifyExpiring,  set: setNotifyExpiring  },
                { labelKey: 'notifyMissingTickets' as const, val: notifyMissing,   set: setNotifyMissing   },
              ]).map(({ labelKey, val, set }) => (
                <label
                  key={labelKey}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <span className="text-sm text-gray-700">{t(labelKey)}</span>
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
            {savingNotify ? t('saving') : t('saveNotifications')}
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          7. TEAM MEMBERS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('team')} subtitle={t('teamSubtitle')} />
        <div className="p-6 space-y-6">

          {/* Role descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { roleKey: 'admin' as const,      color: 'bg-purple-100 text-purple-700', descKey: 'roleDesc.admin' as const },
              { roleKey: 'dispatcher' as const, color: 'bg-blue-100 text-blue-700',    descKey: 'roleDesc.dispatcher' as const },
              { roleKey: 'driver' as const,     color: 'bg-green-100 text-green-700',  descKey: 'roleDesc.driver' as const },
              { roleKey: 'accountant' as const, color: 'bg-amber-100 text-amber-700',  descKey: 'roleDesc.accountant' as const },
            ].map(r => (
              <div key={r.roleKey} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${r.color}`}>{t(`roles.${r.roleKey}`)}</span>
                <p className="text-xs text-gray-600">{t(r.descKey)}</p>
              </div>
            ))}
          </div>

          {/* Invite form — locked for solo and pro */}
          {(subscriptionPlan === 'solo' || subscriptionPlan === 'pro' || subscriptionPlan === 'owner_operator') ? (
            <div className="border-t border-gray-100 pt-5">
              <div className="rounded-xl border border-[#F5B731]/40 p-5 flex items-start gap-4" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2000 100%)' }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F5B731' }}>
                  <Lock className="h-5 w-5 text-[#1a1a1a]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Team logins require the Fleet Plan</p>
                  <p className="text-xs text-white/60 mt-1 mb-4">
                    {subscriptionPlan === 'solo'
                      ? 'Owner Operator Solo is a single-user plan. Upgrade to Fleet to add dispatchers, drivers, and accountants as team members with their own logins.'
                      : 'Owner Operator Pro is a single-user plan. Upgrade to Fleet to add dispatchers, drivers, and accountants as team members with their own logins.'}
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
            <p className="text-sm font-semibold text-gray-800">{t('addTeamMember')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('notificationEmail')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder={t('teamEmailPlaceholder')}
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('teamRole')}</label>
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
              {sendingInvite ? t('saving') : t('addMember')}
            </button>
            <p className="text-xs text-gray-400">
              {t('teamHint')}
            </p>
          </form>
          )}

          {/* Current Members */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              {t('currentMembers')}
              {members.length > 0 && (
                <span className="text-xs text-gray-400 font-normal ml-2">
                  {t('memberSummary', { active: members.filter(m => !!m.accepted_at).length, pending: members.filter(m => !m.accepted_at).length })}
                </span>
              )}
            </p>
            {members.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{t('noClientCompanies')}</p>
                <p className="text-xs text-gray-300 mt-0.5">{t('teamHint')}</p>
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
                              ? t('joined', { date: new Date(m.accepted_at!).toLocaleDateString() })
                              : t('memberStatusPending')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isActive ? t('memberStatusDriver') : t('memberStatusPending')}
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
          UPGRADE PROMPT — solo and pro
      ═══════════════════════════════════════════════════════════════════ */}
      {(subscriptionPlan === 'solo' || subscriptionPlan === 'pro' || subscriptionPlan === 'owner_operator') && (
        <div className="rounded-xl border border-[#F5B731]/30 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #1e1800 100%)' }}>
          <div className="px-6 pt-6 pb-4">
            <p className="text-base font-bold text-white">Unlock More Features</p>
            <p className="text-xs text-white/50 mt-1">
              {subscriptionPlan === 'solo'
                ? 'Upgrade to Owner Operator Pro ($80/mo) to get dispatch, 5 trucks & 5 drivers.'
                : 'Upgrade to Fleet ($200/mo) to stop leaving money on the table.'}
            </p>
          </div>
          <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
{(() => {
              const cards = subscriptionPlan === 'solo' ? [
                { icon: '📋', title: 'Dispatching & Job Management', desc: 'Assign drivers, manage jobs, and track loads from one board. Solo plan does not include dispatch.' },
                { icon: '🚚', title: 'Up to 5 Trucks & Drivers', desc: 'Solo is limited to 1 truck and 1 driver. Grow your operation without replacing your tools.' },
                { icon: '🏢', title: 'Client Companies', desc: 'Track your clients, manage their jobs, and stay organized as your business expands.' },
              ] : [
                { icon: '🔍', title: 'Missing Ticket Detection', desc: 'Automatically find loads where tickets never came in. Stop losing $500–$2,000/month to missing paperwork.' },
                { icon: '🤝', title: 'Subcontractor Management', desc: 'Track subs, their loads, and what you owe them — all in one place with automated billing.' },
                { icon: '⚡', title: 'Follow-Up Automation', desc: 'Automatically chase overdue invoices and missing tickets so you don\'t have to make awkward calls.' },
              ]
              return cards.map(card => (
                <div key={card.title} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                  <span className="text-2xl">{card.icon}</span>
                  <p className="text-sm font-bold text-white">{card.title}</p>
                  <p className="text-xs text-white/50 flex-1">{card.desc}</p>
                </div>
              ))
            })()}
          </div>
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={async () => {
                setUpgradePlanLoading(true)
                try {
                  const upgradeTo = subscriptionPlan === 'solo' ? 'pro' : 'fleet'
                  const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: upgradeTo }) })
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
              {subscriptionPlan === 'solo' ? 'Upgrade to Owner Operator Pro — $80/mo →' : 'Upgrade to Fleet — $200/mo →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          8. DATA EXPORT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('export')} subtitle={t('exportSubtitle')} />
        <div className="p-6 space-y-5">

          {/* Date range */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t('dateRange')}</p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">{t('exportFrom')}</label>
                <input
                  type="date"
                  value={expStart}
                  onChange={e => setExpStart(e.target.value)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">{t('exportTo')}</label>
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
              { key: 'tickets'  as const, icon: FileText,   titleKey: 'exportTickets' as const,  desc: `${expStart} → ${expEnd}`,   iconColor: 'text-blue-600',   bg: 'bg-blue-50'   },
              { key: 'invoices' as const, icon: CreditCard, titleKey: 'exportInvoices' as const, desc: t('fullHistory'),            iconColor: 'text-green-600',  bg: 'bg-green-50'  },
              { key: 'payments' as const, icon: Check,      titleKey: 'exportPayments' as const, desc: t('fullHistory'),            iconColor: 'text-purple-600', bg: 'bg-purple-50' },
              { key: 'expenses' as const, icon: Building2,  titleKey: 'exportExpenses' as const, desc: `${expStart} → ${expEnd}`,   iconColor: 'text-amber-600',  bg: 'bg-amber-50'  },
            ]).map(({ key, icon: Icon, titleKey, desc, iconColor, bg }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4 flex items-start gap-3">
                <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{t(titleKey)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => handleExport(key)}
                  disabled={exporting !== null}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exporting === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting === key ? t('exporting') : 'CSV'}
                </button>
              </div>
            ))}
          </div>

          {/* Export all */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('exportAll')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('exportAllSubtitle')}</p>
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
              {exporting === 'all' ? t('exporting') : t('exportAll')}
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
                    <div className="text-sm font-semibold text-gray-900">👑 Owner — Enterprise Plan</div>
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
              subscriptionPlan === 'solo'                        ? 'Owner Operator Solo Plan' :
              (subscriptionPlan === 'pro' || subscriptionPlan === 'owner_operator') ? 'Owner Operator Pro Plan' :
              subscriptionPlan === 'fleet'                      ? 'Fleet Plan' :
              subscriptionPlan === 'enterprise'                 ? 'Enterprise Plan' :
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
            const normalizePlan = (p: string | null): 'solo' | 'pro' | 'fleet' | 'enterprise' => {
              if (p === 'solo')                                       return 'solo'
              if (p === 'fleet')                                      return 'fleet'
              if (p === 'enterprise' || p === 'growth')               return 'enterprise'
              if (p === 'pro' || p === 'owner_operator' || p === 'starter') return 'pro'
              return 'pro'
            }

            const NEXT: Record<'solo' | 'pro' | 'fleet' | 'enterprise', { label: string; price: string; checkoutKey: string | null; features: string[] } | null> = {
              solo: {
                label:       'Owner Operator Pro',
                price:       '$65/mo',
                checkoutKey: 'pro',
                features: [
                  'Up to 5 trucks & 5 drivers',
                  'Full dispatch board',
                  'Driver management',
                  'Client companies',
                  'Revenue analytics',
                ],
              },
              pro: {
                label:       'Fleet Plan',
                price:       '$125/mo',
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
                label:       'Enterprise Plan',
                price:       'Custom',
                checkoutKey: null,
                features: [
                  'Custom onboarding',
                  'Dedicated account manager',
                  'CRM Growth Pipeline',
                  'Quote builder',
                  'Advanced job profitability',
                  'Mobile ticket + signature capture',
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
                    href="/enterprise"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a1a1a] py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition-colors border border-[#F5B731]/40"
                  >
                    Contact Us About Enterprise →
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
        <SectionHeader title={t('changeEmail')} subtitle={t('changeEmailSubtitle')} />
        <form onSubmit={handleChangeEmail} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('currentEmail')}</label>
            <input value={email} disabled className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('currentPassword')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('newEmail')}</label>
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
            {savingEmail ? t('saving') : t('updateEmail')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('changePassword')} subtitle={t('passwordHint')} />
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('currentPassword')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('newPassword')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('confirmNewPassword')}</label>
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
            {savingPwd ? t('saving') : t('updatePassword')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <SectionHeader title={t('twoFactor')} subtitle={t('twoFactorSubtitle')} />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">{t('authenticatorApp')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('authenticatorHint')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${mfaEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {mfaEnabled ? t('enabled') : t('disabled')}
              </span>
              {mfaEnabled ? (
                <button
                  onClick={handleMfaDisable}
                  disabled={mfaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {mfaLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('disable')}
                </button>
              ) : mfaStep === 'idle' ? (
                <button
                  onClick={handleMfaEnable}
                  disabled={mfaLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {mfaLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('enable')}
                </button>
              ) : null}
            </div>
          </div>

          {mfaStep === 'enrolling' && (
            <div className="border border-gray-100 rounded-xl p-5 space-y-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-700">{t('scanQr')}</p>
              {mfaQrCode && (
                <img
                  src={mfaQrCode}
                  alt="2FA QR code"
                  className="w-40 h-40 rounded-lg border border-gray-200 bg-white p-1"
                />
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('orEnterKey')}</p>
                <code className="block text-xs font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 break-all text-gray-800 select-all">
                  {mfaSecret}
                </code>
              </div>
              <form onSubmit={handleMfaVerify} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('enterCode')}</label>
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
                    {t('verifyEnable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaStep('idle'); setMfaCode(''); setMfaQrCode(''); setMfaSecret('') }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Preferences */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Hash className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-sm text-gray-900">Sidebar Preferences</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Navigation Order</p>
            <p className="text-xs text-gray-500 mt-0.5">Drag sidebar items to reorder them. Use this button to restore the default order.</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/company/nav-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nav_order: null }),
              })
              window.location.reload()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            Reset to default order
          </button>
        </div>
      </div>

      {/* Legal & Compliance */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-sm text-gray-900">Legal &amp; Compliance</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Export My Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Download a JSON copy of all your company data — tickets, invoices, drivers, dispatches, contractors, and leads.
              </p>
            </div>
            <button
              onClick={handleExportMyData}
              disabled={exportingMyData}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
            >
              {exportingMyData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exportingMyData ? t('exporting') : 'Export Data'}
            </button>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Legal Documents</p>
            <div className="flex flex-wrap gap-3">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                <FileText className="h-3.5 w-3.5" /> Terms of Service
              </a>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                <FileText className="h-3.5 w-3.5" /> Privacy Policy
              </a>
              <a href="/legal/acceptable-use" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                <FileText className="h-3.5 w-3.5" /> Acceptable Use
              </a>
              <a href="/legal/ai-disclaimer" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                <FileText className="h-3.5 w-3.5" /> AI Disclaimer
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Data Backups — owner only */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--brand-primary)]" />
            <h2 className="font-semibold text-sm text-gray-900">Data Backups</h2>
            <span className="ml-1 text-xs bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold px-2 py-0.5 rounded-full">Owner Only</span>
          </div>
          <div className="p-6">
            <p className="text-xs text-gray-500 mb-4">
              Your data is automatically backed up every night at midnight. Each backup is a complete snapshot of all tickets, invoices, drivers, dispatches, expenses, and client companies — kept permanently and encrypted. You can download any backup or restore missing records at any time.
            </p>
            <Link
              href="/dashboard/backups"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              <Database className="h-4 w-4" />
              Manage Backups
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Business Analytics — owner only */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[var(--brand-primary)]" />
            <h2 className="font-semibold text-sm text-gray-900">Business Analytics</h2>
            <span className="ml-1 text-xs bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold px-2 py-0.5 rounded-full">Owner Only</span>
          </div>
          <div className="p-6">
            <p className="text-xs text-gray-500 mb-4">
              View signup trends, referral source breakdown, plan distribution, and trial-to-paid conversion across all DumpTruckBoss accounts.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/admin/analytics"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
              >
                <BarChart2 className="h-4 w-4" />
                View Analytics
                <ChevronRight className="h-4 w-4" />
              </Link>
              <a
                href="https://app.posthog.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                PostHog Dashboard →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border-2 border-red-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="font-semibold text-sm text-red-700">{t('dangerZone')}</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('deleteAllData')}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('deleteAllDataDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={delDataInput}
                onChange={e => setDelDataInput(e.target.value)}
                placeholder={t('typeDelete')}
                disabled={deletingData}
                className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 disabled:opacity-50"
              />
              <button
                onClick={handleDeleteData}
                disabled={delDataInput !== 'DELETE' || deletingData}
                className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deletingData && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingData ? t('deleting') : t('deleteData')}
              </button>
            </div>
          </div>

          <div className="border-t border-red-100" />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('deleteAccount')}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('deleteAccountDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={delAccInput}
                onChange={e => setDelAccInput(e.target.value)}
                placeholder={t('typeDelete')}
                disabled={deletingAccount}
                className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 disabled:opacity-50"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={delAccInput !== 'DELETE' || deletingAccount}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingAccount ? t('deleting') : t('deleteAccount')}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    {/* Edit Client Company Modal */}
    {editingCompany && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">{t('clientCompanies')}</h2>
            <button onClick={() => setEditingCompany(null)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSaveEditCompany} className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('companyName')} *</label>
              <input
                required
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('companyAddress')}</label>
              <input
                value={editForm.address}
                onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St, City, ST 00000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('email')}</label>
              <input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                placeholder="billing@client.com"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('phoneNumber')}</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Terms</label>
              <select value={editForm.payment_terms} onChange={e => setEditForm(p => ({ ...p, payment_terms: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="2_10_net_30">2/10 Net 30 (2% if paid in 10 days)</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.tax_exempt} onChange={e => setEditForm(p => ({ ...p, tax_exempt: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium text-gray-700">Tax Exempt</span>
              </label>
              {editForm.tax_exempt && (
                <input type="text" value={editForm.tax_exempt_cert} onChange={e => setEditForm(p => ({ ...p, tax_exempt_cert: e.target.value }))} placeholder="Exemption certificate number" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditingCompany(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {t('cancel')}
              </button>
              <button type="submit" disabled={savingEdit || !editForm.name.trim()} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingEdit ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
