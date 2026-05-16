'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Users, Phone, Mail, X, Pencil, Trash2, DollarSign, CreditCard, Calendar, AlertCircle, Lock, FileText, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Driver, Load, DriverPayment } from '@/lib/types'
import { getCompanyId } from '@/lib/get-company-id'
import { calculateDriverOwed, calculateDriverEarned } from '@/lib/drivers/calculate-owed'

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const ymd = s.slice(0, 10)
  const [y, m, d] = ymd.split('-')
  return `${parseInt(m!)}/${parseInt(d!)}/${y}`
}

function ExpiryBadge({ date }: { date: string }) {
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86400000)
  if (days < 0) return <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold whitespace-nowrap">❌ Expired</span>
  if (days <= 30) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold whitespace-nowrap">⚠️ {days}d left</span>
  return <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold whitespace-nowrap">✅ Valid</span>
}

function getDriverComplianceStatus(driver: Driver): { status: 'compliant'|'expiring'|'expired'|'unknown'; issues: string[]; warnings: string[] } {
  const cdlDays = driver.cdl_expiry ? Math.floor((new Date(driver.cdl_expiry).getTime() - Date.now()) / 86400000) : null
  const medDays = driver.medical_card_expiry ? Math.floor((new Date(driver.medical_card_expiry).getTime() - Date.now()) / 86400000) : null
  const issues: string[] = []
  const warnings: string[] = []
  if (cdlDays !== null && cdlDays < 0) issues.push('CDL expired')
  if (medDays !== null && medDays < 0) issues.push('Medical card expired')
  if (driver.drug_test_result === 'failed') issues.push('Failed drug test')
  if (cdlDays !== null && cdlDays >= 0 && cdlDays <= 30) warnings.push('CDL expiring')
  if (medDays !== null && medDays >= 0 && medDays <= 30) warnings.push('Medical expiring')
  if (!driver.cdl_number) warnings.push('No CDL on file')
  if (issues.length > 0) return { status: 'expired', issues, warnings }
  if (warnings.length > 0) return { status: 'expiring', issues, warnings }
  if (driver.cdl_number && driver.medical_card_expiry) return { status: 'compliant', issues: [], warnings: [] }
  return { status: 'unknown', issues: [], warnings: [] }
}

type LoadWithTickets = Load & { load_tickets?: { ticket_number: string | null }[] }

const EMPTY_DRIVER = { name: '', email: '', phone: '', status: 'active' }
const PAY_METHODS = ['Check', 'Cash', 'Zelle', 'ACH', 'Direct Deposit']
const EMPTY_PAY = {
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'Check',
  check_number: '',
  period_start: '',
  period_end: '',
  notes: '',
}

export default function DriversPage() {
  const t = useTranslations('drivers')
  const [drivers, setDrivers]               = useState<Driver[]>([])
  const [loads, setLoads]                   = useState<Load[]>([])
  const [driverPayments, setDriverPayments] = useState<DriverPayment[]>([])
  const [loading, setLoading]               = useState(true)
  const [activeTab, setActiveTab]           = useState<'all' | 'unpaid'>('all')
  const [showForm, setShowForm]             = useState(false)
  const [editingDriver, setEditingDriver]   = useState<Driver | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [form, setForm]                     = useState(EMPTY_DRIVER)
  const [saving, setSaving]                 = useState(false)
  const [payingDriver, setPayingDriver]     = useState<Driver | null>(null)
  const [payForm, setPayForm]               = useState(EMPTY_PAY)
  const [savingPay, setSavingPay]           = useState(false)
  const [viewingTicketsDriver, setViewingTicketsDriver] = useState<Driver | null>(null)
  const [driverTickets, setDriverTickets]               = useState<LoadWithTickets[]>([])
  const [loadingDriverTickets, setLoadingDriverTickets] = useState(false)
  const [driverTicketFilter, setDriverTicketFilter]     = useState<'all' | 'pending' | 'invoiced' | 'paid'>('all')
  const [companyPlan, setCompanyPlan]           = useState<string | null>(null)
  const [isInternal, setIsInternal]             = useState(false)
  const [nearLimitDismissed, setNearLimitDismissed] = useState(false)
  const [atLimitCardDismissed, setAtLimitCardDismissed] = useState(false)
  const [upgradeLoading, setUpgradeLoading]     = useState(false)

  // Pay rate form state
  const [payType, setPayType]           = useState('per_load')
  const [payRateValue, setPayRateValue] = useState('')
  const [workerType, setWorkerType]     = useState('employee')

  // Unpaid tab
  const [selectedUnpaid, setSelectedUnpaid] = useState<string[]>([])
  const [unpaidSortBy, setUnpaidSortBy]     = useState('oldest')
  const [payDriverModal, setPayDriverModal] = useState(false)
  const [payModalDriver, setPayModalDriver] = useState<Driver | null>(null)
  const [payModalMethod, setPayModalMethod] = useState('check')
  const [payModalRef, setPayModalRef]       = useState('')
  const [payModalDate, setPayModalDate]     = useState(new Date().toISOString().slice(0, 10))
  const [payModalNotes, setPayModalNotes]   = useState('')
  const [savingDriverPay, setSavingDriverPay] = useState(false)

  // Driver detail panel tab
  const [detailTab, setDetailTab] = useState<'overview' | 'compliance'>('overview')

  const supabase = createClient()

  async function startUpgradeCheckout(plan: string) {
    setUpgradeLoading(true)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
    } catch { /* fall through */ }
    setUpgradeLoading(false)
    toast.error('Could not start checkout')
  }

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const companyId = await getCompanyId()
    if (!companyId) { setLoading(false); return }

    const [dRes, lRes, dpRes, coRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('company_id', companyId).order('name'),
      supabase.from('loads').select('*').eq('company_id', companyId).order('date', { ascending: false }),
      supabase.from('driver_payments').select('*').eq('company_id', companyId).order('payment_date', { ascending: false }),
      supabase.from('companies').select('plan, is_internal').eq('id', companyId).maybeSingle(),
    ])
    if (dRes.error) toast.error('Failed to load drivers: ' + dRes.error.message)
    setDrivers(dRes.data ?? [])
    setLoads(lRes.data ?? [])
    setDriverPayments(dpRes.data ?? [])
    const coData = coRes.data as Record<string, unknown> | null
    setCompanyPlan(coData?.plan as string | null ?? null)
    setIsInternal(!!(coData?.is_internal))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Plan limits ───────────────────────────────────────────────────────────
  const activeDriverCount = drivers.filter(d => d.status === 'active').length
  const driverLimit       = isInternal || companyPlan === 'enterprise' ? Infinity : companyPlan === 'fleet' ? 15 : 3
  const limitLabel        = driverLimit === Infinity ? '∞' : String(driverLimit)
  const atLimit           = driverLimit !== Infinity && activeDriverCount >= driverLimit

  // ── Derived: unpaid work per driver ─────────────────────────────────────
  const unpaidLoads = loads.filter(l => !l.driver_paid && ['pending', 'approved', 'invoiced'].includes(l.status ?? ''))

  const driverUnpaidSummary = drivers.map(d => {
    const dLoads = unpaidLoads.filter(l => l.driver_name === d.name)
    const total  = calculateDriverOwed(dLoads, d)
    const sorted = [...dLoads].sort((a, b) => a.date < b.date ? -1 : 1)
    return { driver: d, loads: dLoads, total, oldestDate: sorted[0]?.date ?? null }
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  // ── Unpaid tab: per-ticket list across all drivers ────────────────────────
  const sortedUnpaidLoads = [...unpaidLoads].sort((a, b) => {
    if (unpaidSortBy === 'newest') return b.date.localeCompare(a.date)
    if (unpaidSortBy === 'amount') {
      const dA = drivers.find(d => d.name === a.driver_name)
      const dB = drivers.find(d => d.name === b.driver_name)
      return calculateDriverOwed([b], dB ?? {}) - calculateDriverOwed([a], dA ?? {})
    }
    if (unpaidSortBy === 'driver') return (a.driver_name ?? '').localeCompare(b.driver_name ?? '')
    return a.date.localeCompare(b.date) // oldest first
  })
  const selectedUnpaidTotal = loads
    .filter(l => selectedUnpaid.includes(l.id))
    .reduce((s, l) => {
      const d = drivers.find(dr => dr.name === l.driver_name)
      return s + calculateDriverOwed([l], d ?? {})
    }, 0)

  // ── Pay liability summary ─────────────────────────────────────────────────
  const totalOwed = driverUnpaidSummary.reduce((s, u) => s + u.total, 0)
  const driversWithOwedCount = driverUnpaidSummary.length

  // ── Driver form ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditingDriver(null)
    setForm(EMPTY_DRIVER)
    setPayType('per_load')
    setPayRateValue('')
    setWorkerType('employee')
    setShowForm(true)
  }
  function openEdit(d: Driver, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingDriver(d)
    setForm({ name: d.name, email: d.email ?? '', phone: d.phone ?? '', status: d.status })
    setPayType(d.pay_type ?? 'per_load')
    setPayRateValue(d.pay_rate_value ? String(d.pay_rate_value) : '')
    setWorkerType(d.worker_type ?? 'employee')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const companyId = await getCompanyId()
    if (!companyId) { toast.error('Company not found'); setSaving(false); return }
    const payFields = {
      pay_type: payType,
      pay_rate_value: payRateValue !== '' ? parseFloat(payRateValue) : null,
      worker_type: workerType,
    }
    if (editingDriver) {
      const { error } = await supabase.from('drivers').update({ name: form.name, email: form.email || null, phone: form.phone || null, status: form.status, ...payFields }).eq('id', editingDriver.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Driver updated')
      if (selectedDriver?.id === editingDriver.id) setSelectedDriver(p => p ? { ...p, name: form.name, email: form.email || null, phone: form.phone || null, status: form.status as Driver['status'], ...payFields } : null)
      setDrivers(prev => prev.map(x => x.id === editingDriver.id ? { ...x, name: form.name, email: form.email || null, phone: form.phone || null, status: form.status as Driver['status'], ...payFields } : x))
    } else {
      const res  = await fetch('/api/drivers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: form.name, email: form.email, phone: form.phone, status: form.status, pay_type: payType, pay_rate_value: payRateValue, worker_type: workerType }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to add driver'); setSaving(false); return }
      toast.success('Driver added')
    }
    setSaving(false); setShowForm(false); setForm(EMPTY_DRIVER); setEditingDriver(null); fetchData()
  }

  async function handleDelete(d: Driver, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('deleteConfirm', { name: d.name }))) return
    const { error } = await supabase.from('drivers').delete().eq('id', d.id)
    if (error) { toast.error('Delete failed: ' + error.message); return }
    toast.success('Driver deleted')
    if (selectedDriver?.id === d.id) setSelectedDriver(null)
    setDrivers(prev => prev.filter(x => x.id !== d.id))
  }

  async function toggleStatus(d: Driver) {
    const ns = d.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('drivers').update({ status: ns }).eq('id', d.id)
    if (error) { toast.error('Status update failed'); return }
    setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, status: ns } : x))
    if (selectedDriver?.id === d.id) setSelectedDriver(p => p ? { ...p, status: ns } : null)
  }

  // ── View Tickets modal ────────────────────────────────────────────────────
  async function openDriverTickets(driver: Driver, e: React.MouseEvent) {
    e.stopPropagation()
    setViewingTicketsDriver(driver)
    setDriverTicketFilter('all')
    setLoadingDriverTickets(true)
    const companyId = await getCompanyId()
    if (!companyId) { setLoadingDriverTickets(false); return }
    const { data, error } = await supabase
      .from('loads')
      .select('*, load_tickets(ticket_number)')
      .eq('company_id', companyId)
      .eq('driver_name', driver.name)
      .order('date', { ascending: false })
    if (error) toast.error('Failed to load tickets: ' + error.message)
    setDriverTickets((data ?? []) as LoadWithTickets[])
    setLoadingDriverTickets(false)
  }

  // ── Payment modal ─────────────────────────────────────────────────────────
  function openPayModal(d: Driver, prefillAmount?: number) {
    setPayingDriver(d)
    setPayForm({ ...EMPTY_PAY, amount: prefillAmount ? String(prefillAmount) : '', payment_date: new Date().toISOString().slice(0, 10) })
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payingDriver) return
    const amount = parseFloat(payForm.amount) || 0
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return }
    setSavingPay(true)
    const companyId = await getCompanyId()
    if (!companyId) { toast.error('Company not found'); setSavingPay(false); return }

    const { data: payment, error } = await supabase.from('driver_payments').insert({
      company_id: companyId,
      driver_id: payingDriver.id,
      driver_name: payingDriver.name,
      amount,
      payment_date: payForm.payment_date,
      payment_method: payForm.payment_method,
      check_number: payForm.payment_method === 'Check' ? payForm.check_number || null : null,
      period_start: payForm.period_start || null,
      period_end: payForm.period_end || null,
      notes: payForm.notes || null,
    }).select().maybeSingle()

    if (error) { toast.error(error.message); setSavingPay(false); return }

    // Mark this driver's approved unpaid loads as paid
    const toMark = loads.filter(l => l.driver_name === payingDriver.name && l.status === 'approved' && !l.driver_paid).map(l => l.id)
    if (toMark.length > 0 && payment) {
      await supabase.from('loads').update({ driver_paid: true, driver_paid_date: payForm.payment_date, driver_payment_id: payment.id }).in('id', toMark)
      setLoads(prev => prev.map(l => toMark.includes(l.id) ? { ...l, driver_paid: true, driver_paid_date: payForm.payment_date } : l))
    }

    toast.success(`$${amount.toLocaleString()} recorded for ${payingDriver.name}`)
    setSavingPay(false)
    setPayingDriver(null)
    setPayForm(EMPTY_PAY)
    fetchData()
  }

  async function updateDriver(updates: Partial<Driver>) {
    if (!selectedDriver) return
    const { error } = await supabase.from('drivers').update(updates).eq('id', selectedDriver.id)
    if (error) { toast.error(error.message); return }
    setSelectedDriver(p => p ? { ...p, ...updates } : p)
    setDrivers(prev => prev.map(d => d.id === selectedDriver.id ? { ...d, ...updates } : d))
  }

  async function handleBatchPay() {
    if (!payModalDriver || selectedUnpaid.length === 0) return
    setSavingDriverPay(true)
    const companyId = await getCompanyId()
    if (!companyId) { setSavingDriverPay(false); return }

    const selectedTickets = loads.filter(l => selectedUnpaid.includes(l.id))
    const total = selectedTickets.reduce((s, t) => s + calculateDriverOwed([t], payModalDriver), 0)

    const { data: payment, error } = await supabase.from('driver_payments').insert({
      company_id: companyId,
      driver_id: payModalDriver.id,
      driver_name: payModalDriver.name,
      amount: total,
      ticket_count: selectedTickets.length,
      ticket_ids: selectedUnpaid,
      payment_method: payModalMethod,
      payment_reference: payModalRef || null,
      check_number: payModalMethod === 'Check' ? payModalRef || null : null,
      payment_date: payModalDate,
      notes: payModalNotes || null,
    }).select('id').maybeSingle()

    if (error) { toast.error(error.message); setSavingDriverPay(false); return }

    await supabase.from('loads').update({
      driver_paid: true,
      driver_paid_at: new Date(payModalDate).toISOString(),
      driver_pay_amount: total / selectedTickets.length,
      driver_payment_id: (payment as Record<string, unknown>)?.id as string | null ?? null,
    }).in('id', selectedUnpaid)

    await supabase.from('drivers').update({
      ytd_paid: (payModalDriver.ytd_paid ?? 0) + total,
      lifetime_paid: (payModalDriver.lifetime_paid ?? 0) + total,
      last_active_at: payModalDate,
    }).eq('id', payModalDriver.id)

    toast.success(`✅ $${total.toFixed(2)} payment recorded for ${payModalDriver.name}`)
    setPayDriverModal(false)
    setSelectedUnpaid([])
    setPayModalRef('')
    setPayModalNotes('')
    setSavingDriverPay(false)
    fetchData()
  }

  // ── Stats helpers ─────────────────────────────────────────────────────────
  function getDriverStats(driver: Driver) {
    const dl = loads.filter(l => l.driver_name === driver.name)
    const revenue = dl
      .filter(l => ['approved', 'invoiced', 'paid'].includes(l.status))
      .reduce((s, l) => s + ((l as { total_pay?: number | null }).total_pay ?? l.rate ?? 0), 0)
    const owed = calculateDriverOwed(dl, driver)
    // Earned = driver's cut from tickets where the client invoice has been paid
    const paidTickets = dl.filter(l => l.status === 'paid')
    const earned = calculateDriverEarned(paidTickets, driver)
    return { loads: dl.length, revenue, owed, earned }
  }

  // Detail panel data
  const driverLoads          = selectedDriver ? loads.filter(l => l.driver_name === selectedDriver.name) : []
  const driverUnpaidLoads    = driverLoads.filter(l => !l.driver_paid && ['pending', 'approved', 'invoiced'].includes(l.status ?? ''))
  const driverAmountOwed     = selectedDriver ? calculateDriverOwed(driverUnpaidLoads, selectedDriver) : 0
  const driverPaymentHistory = selectedDriver ? driverPayments.filter(p => p.driver_name === selectedDriver.name) : []

  const shownDrivers = activeTab === 'unpaid'
    ? drivers.filter(d => driverUnpaidSummary.some(u => u.driver.id === d.id))
    : drivers

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {t('summary', { active: `${activeDriverCount}/${limitLabel}`, unpaid: driverUnpaidSummary.length })}
          </p>
        </div>
        <button
          onClick={() => {
            if (atLimit) {
              toast.error(`You've reached your ${limitLabel} driver limit. Upgrade your plan to add more drivers.`)
              return
            }
            openAdd()
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${atLimit ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]'}`}
        >
          <Plus className="h-4 w-4" /> {t('addDriver')}
        </button>
      </div>

      {/* Near-limit warning banner (80%+) */}
      {!nearLimitDismissed && !atLimit && driverLimit !== Infinity && activeDriverCount / driverLimit >= 0.8 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-base">⚠️</span>
          <p className="flex-1 text-sm font-medium text-amber-800">
            You&apos;re almost at your driver limit ({activeDriverCount}/{limitLabel} used). Upgrade your plan to add more drivers.{' '}
            <button
              onClick={() => startUpgradeCheckout(companyPlan === 'owner_operator' ? 'fleet' : 'enterprise')}
              disabled={upgradeLoading}
              className="underline font-semibold hover:no-underline disabled:opacity-60"
            >
              Upgrade now →
            </button>
          </p>
          <button onClick={() => setNearLimitDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pay liability banner */}
      {totalOwed > 0 && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-red-800">💰 {t('awaitingPayment')}</p>
            <p className="text-sm text-red-600 mt-0.5">{t('totalOwed', { total: totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2 }) })} — {t('driversWithUnpaid')}: {driversWithOwedCount}</p>
          </div>
          <button onClick={() => setActiveTab('unpaid')} className="shrink-0 px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700">{t('tabs.unpaid')} →</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'unpaid'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'all' ? t('tabs.all') : (
              <span className="flex items-center gap-1.5">
                {t('tabs.unpaid')}
                {driverUnpaidSummary.length > 0 && <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">{driverUnpaidSummary.length}</span>}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
      ) : activeTab === 'unpaid' ? (
        // ── Unpaid Tab ──────────────────────────────────────────────────────
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{unpaidLoads.length !== 1 ? t('ticketsUnpaidPlural', { count: unpaidLoads.length }) : t('ticketsUnpaid', { count: unpaidLoads.length })}</p>
            <select value={unpaidSortBy} onChange={e => setUnpaidSortBy(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none">
              <option value="oldest">Oldest First</option>
              <option value="newest">Newest First</option>
              <option value="amount">Highest Amount</option>
              <option value="driver">By Driver</option>
            </select>
          </div>
          {sortedUnpaidLoads.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <span className="text-5xl block mb-3">✅</span>
              <p className="text-sm font-medium text-gray-400">{t('allTicketsSettled')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUnpaidLoads.map(ticket => {
                const driver = drivers.find(d => d.name === ticket.driver_name)
                const payOwed = driver ? calculateDriverOwed([ticket], driver) : 0
                return (
                  <div key={ticket.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <input type="checkbox" checked={selectedUnpaid.includes(ticket.id)} onChange={e => setSelectedUnpaid(prev => e.target.checked ? [...prev, ticket.id] : prev.filter(id => id !== ticket.id))} className="w-4 h-4 rounded" />
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{ticket.driver_name}</p>
                        <p className="text-xs text-gray-500">{ticket.job_name} · {fmtDate(ticket.date)}</p>
                        <p className="text-xs text-gray-400">Ticket revenue: ${((ticket as {total_pay?: number|null}).total_pay ?? ticket.rate ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {payOwed > 0 ? (
                        <>
                          <p className="font-black text-red-600">${payOwed.toFixed(2)} {t('owed')}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{driver?.pay_type?.replace(/_/g, ' ')} rate</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-400">—</p>
                          <p className="text-xs text-gray-300 italic">No rate set</p>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Floating bulk pay toolbar */}
          {selectedUnpaid.length > 0 && (() => {
            const firstTicketDriver = drivers.find(d => d.name === loads.find(l => l.id === selectedUnpaid[0])?.driver_name)
            return (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-gray-900 text-white rounded-2xl shadow-2xl">
                <p className="font-semibold text-sm">{selectedUnpaid.length !== 1 ? t('ticketCountPlural', { count: selectedUnpaid.length }) : t('ticketCount', { count: selectedUnpaid.length })} · ${selectedUnpaidTotal.toFixed(2)}</p>
                <button onClick={() => { setPayModalDriver(firstTicketDriver ?? null); setPayDriverModal(true) }} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl text-sm">💵 {t('recordPayment')}</button>
                <button onClick={() => setSelectedUnpaid([])} className="text-gray-400 hover:text-white">✕</button>
              </div>
            )
          })()}
        </div>
      ) : (
        // ── All Drivers Tab ─────────────────────────────────────────────────
        drivers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-400 mb-1">{t('noDrivers')}</p>
            <button onClick={openAdd} className="text-sm text-[var(--brand-primary)]">{t('addFirstDriver')} →</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map(d => {
              const stats = getDriverStats(d)
              const { status: compStatus, issues, warnings } = getDriverComplianceStatus(d)
              const compDotColor = compStatus === 'compliant' ? 'bg-green-500' : compStatus === 'expiring' ? 'bg-amber-500' : compStatus === 'expired' ? 'bg-red-500' : 'bg-gray-300'
              const dLoadsForCard = loads.filter(l => l.driver_name === d.name)
              const lastWorked = dLoadsForCard.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null
              const daysSinceWork = lastWorked ? Math.floor((Date.now() - new Date(lastWorked + 'T00:00:00').getTime()) / 86400000) : null
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer group" onClick={() => { setSelectedDriver(d); setDetailTab('overview') }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {d.name.slice(0, 2).toUpperCase()}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${compDotColor}`} title={compStatus} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{d.name}</p>
                        <span className={`inline-flex text-xs rounded-full px-2 py-0.5 font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.status === 'active' ? t('status.active') : t('status.inactive')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => openEdit(d, e)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[var(--brand-primary)]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={e => handleDelete(d, e)} className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 text-xs mb-0.5">{t('loads')}</p>
                      <p className="font-bold text-gray-900 text-xs">
                        {d.pay_rate_value
                          ? `$${stats.earned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-gray-300 text-[10px]">Set rate</span>
                        }
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 text-xs mb-0.5">{t('revenue')}</p>
                      <p className="font-bold text-[var(--brand-primary)] text-xs">${stats.revenue.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg p-2.5 ${stats.owed > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                      <p className="text-gray-400 text-xs mb-0.5">{t('owed')}</p>
                      <p className={`font-bold text-xs ${stats.owed > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{stats.owed > 0 ? `$${stats.owed.toFixed(2)}` : d.pay_rate_value ? '—' : <span className="text-gray-300 text-[10px]">Set rate</span>}</p>
                    </div>
                  </div>
                  {d.phone && <div className="flex items-center gap-2 mt-3 text-xs text-gray-400"><Phone className="h-3 w-3" /> {d.phone}</div>}
                  {d.email && <div className="flex items-center gap-2 mt-1 text-xs text-gray-400"><Mail className="h-3 w-3" /> {d.email}</div>}
                  {/* Last active */}
                  <div className="mt-2 text-xs">
                    {lastWorked ? (
                      <span className={daysSinceWork! > 60 ? 'text-gray-300' : daysSinceWork! > 30 ? 'text-gray-400' : 'text-green-600'}>
                        {t('since', { date: fmtDate(lastWorked) })}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">{t('noUnpaidWork')}</span>
                    )}
                  </div>
                  {/* Compliance issues tooltip */}
                  {(issues.length > 0 || warnings.length > 0) && (
                    <div className={`mt-2 px-2 py-1 rounded-lg text-xs font-medium ${issues.length > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {issues.length > 0 ? `❌ ${issues[0]}` : `⚠️ ${warnings[0]}`}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button onClick={e => { e.stopPropagation(); toggleStatus(d) }} className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors">
                      {d.status === 'active' ? t('markInactive') : t('markActive')}
                    </button>
                    {stats.owed > 0 && (
                      <button onClick={e => { e.stopPropagation(); openPayModal(d, stats.owed) }} className="flex-1 text-xs py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors font-medium">
                        {t('payAmount', { amount: stats.owed.toFixed(2) })}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={e => openDriverTickets(d, e)}
                    className="w-full rounded-lg bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-sm font-medium py-2 transition-colors mt-2"
                  >
                    View Tickets →
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* At-limit upgrade card */}
      {!atLimitCardDismissed && atLimit && companyPlan !== 'enterprise' && (
        <div className="mt-4 relative rounded-2xl overflow-hidden border-2 border-[var(--brand-primary)] bg-[var(--brand-dark)] text-white p-6">
          <button
            onClick={() => setAtLimitCardDismissed(true)}
            className="absolute top-3 right-3 text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              {companyPlan === 'owner_operator' ? (
                <>
                  <p className="text-xs font-semibold text-[#4ade80] uppercase tracking-wide mb-1">Growing your fleet?</p>
                  <p className="text-base font-bold text-white mb-1">Upgrade to Fleet Plan — up to 15 drivers</p>
                  <p className="text-sm text-white/60">Unlimited tickets · Full dispatch board · 3 team logins · Email invoices · <strong className="text-white">$200/mo</strong></p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-[#4ade80] uppercase tracking-wide mb-1">Running a large operation?</p>
                  <p className="text-base font-bold text-white mb-1">Upgrade to Enterprise — unlimited drivers</p>
                  <p className="text-sm text-white/60">Mobile driver app · AI ticket reader · SMS invoicing · Dedicated manager · <strong className="text-white">$300+/mo</strong></p>
                </>
              )}
            </div>
            {companyPlan === 'owner_operator' ? (
              <button
                onClick={() => startUpgradeCheckout('fleet')}
                disabled={upgradeLoading}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-bold text-white hover:bg-[#3a9462] transition-colors disabled:opacity-60"
              >
                {upgradeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upgrade to Fleet →
              </button>
            ) : (
              <a
                href="/schedule-demo"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#FFB800] px-5 py-3 text-sm font-bold text-black hover:bg-[#E6A600] transition-colors"
              >
                Talk to Sales →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingDriver ? t('editDriver') : atLimit ? 'Driver Limit Reached' : t('addDriver')}</h2>
              <button onClick={() => { setShowForm(false); setEditingDriver(null); setForm(EMPTY_DRIVER) }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Upgrade prompt when at limit and not editing */}
            {atLimit && !editingDriver ? (
              <div className="p-6 text-center space-y-4">
                <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Lock className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    You&apos;re using <strong>{activeDriverCount}/{limitLabel}</strong> active drivers on your current plan.
                    Upgrade to add more.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    href="/pricing"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
                  >
                    View Plans &amp; Upgrade →
                  </a>
                  <a
                    href="/dashboard/settings"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Manage Subscription
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('fullName')} *</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Jake Morrison" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('phone')}</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="(555) 000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('email')}</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="driver@email.com" />
                </div>
                {editingDriver && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('statusLabel')}</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                      <option value="active">{t('status.active')}</option>
                      <option value="inactive">{t('status.inactive')}</option>
                    </select>
                  </div>
                )}
                {/* Pay Rate */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pay Rate</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Pay Type</label>
                      <select value={payType} onChange={e => setPayType(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                        <option value="per_load">Per Load</option>
                        <option value="per_hour">Per Hour</option>
                        <option value="per_ton">Per Ton</option>
                        <option value="percent_revenue">% of Revenue</option>
                        <option value="day_rate">Day Rate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {payType === 'percent_revenue' ? 'Percent (%)' : 'Rate ($)'}
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={payRateValue}
                        onChange={e => setPayRateValue(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                        placeholder={payType === 'percent_revenue' ? '30' : '0.00'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Worker Type</label>
                    <div className="flex gap-2">
                      {(['employee', 'contractor'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setWorkerType(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${workerType === t ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          {t === 'employee' ? 'W-4 Employee' : 'W-9 Contractor'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditingDriver(null); setForm(EMPTY_DRIVER) }} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? t('saving') : editingDriver ? t('saveChanges') : t('addDriver')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('paymentModal')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{payingDriver.name}</p>
              </div>
              <button onClick={() => { setPayingDriver(null); setPayForm(EMPTY_PAY) }} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              {/* Amount owed summary */}
              {(() => {
                const owed = loads.filter(l => l.driver_name === payingDriver.name && l.status === 'approved' && !l.driver_paid).reduce((s, l) => s + (l.rate ?? 0), 0)
                const cnt  = loads.filter(l => l.driver_name === payingDriver.name && l.status === 'approved' && !l.driver_paid).length
                return owed > 0 ? (
                  <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-orange-700">{cnt !== 1 ? t('ticketsUnpaidPlural', { count: cnt }) : t('ticketsUnpaid', { count: cnt })}</span>
                    <span className="font-bold text-orange-700">${owed.toLocaleString()} {t('owed')}</span>
                  </div>
                ) : null
              })()}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('amountLabel')} ($) *</label>
                <input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('paymentDate')} *</label>
                  <input required type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('method')}</label>
                  <select value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                    {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {payForm.payment_method === 'Check' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('checkNumber')}</label>
                  <input value={payForm.check_number} onChange={e => setPayForm(p => ({ ...p, check_number: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="1234" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('periodStart')}</label>
                  <input type="date" value={payForm.period_start} onChange={e => setPayForm(p => ({ ...p, period_start: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('periodEnd')}</label>
                  <input type="date" value={payForm.period_end} onChange={e => setPayForm(p => ({ ...p, period_end: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder={t('notesPlaceholder')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setPayingDriver(null); setPayForm(EMPTY_PAY) }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingPay} className="flex-1 h-10 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">
                  {savingPay && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingPay ? t('saving') : t('recordPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Pay Modal */}
      {payDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('paymentModal')}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedUnpaid.length !== 1 ? t('ticketCountPlural', { count: selectedUnpaid.length }) : t('ticketCount', { count: selectedUnpaid.length })} · ${selectedUnpaidTotal.toFixed(2)}</p>
              </div>
              <button onClick={() => setPayDriverModal(false)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {payModalDriver && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                  Paying <strong>{payModalDriver.name}</strong> for {selectedUnpaid.length !== 1 ? t('ticketCountPlural', { count: selectedUnpaid.length }) : t('ticketCount', { count: selectedUnpaid.length })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('method')}</label>
                  <select value={payModalMethod} onChange={e => setPayModalMethod(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                    <option value="check">{t('methods.check')}</option>
                    <option value="cash">{t('methods.cash')}</option>
                    <option value="zelle">{t('methods.zelle')}</option>
                    <option value="ach">{t('methods.ach')}</option>
                    <option value="direct_deposit">{t('methods.direct')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('paymentDate')}</label>
                  <input type="date" value={payModalDate} onChange={e => setPayModalDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{payModalMethod === 'check' ? t('checkNumber') : 'Reference / Memo'}</label>
                <input value={payModalRef} onChange={e => setPayModalRef(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder={payModalMethod === 'check' ? '1234' : 'Optional reference'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
                <input value={payModalNotes} onChange={e => setPayModalNotes(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder={t('notesPlaceholder')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setPayDriverModal(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleBatchPay} disabled={savingDriverPay} className="flex-1 h-10 rounded-xl bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-60">
                  {savingDriverPay && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingDriverPay ? t('saving') : t('payAmount', { amount: selectedUnpaidTotal.toFixed(2) })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Tickets Modal */}
      {viewingTicketsDriver && (() => {
        const ticketCounts = {
          all:      driverTickets.length,
          pending:  driverTickets.filter(t => t.status === 'pending').length,
          invoiced: driverTickets.filter(t => t.status === 'invoiced').length,
          paid:     driverTickets.filter(t => t.status === 'paid').length,
        }
        const filtered = driverTicketFilter === 'all'
          ? driverTickets
          : driverTickets.filter(t => t.status === driverTicketFilter)
        const totalAmt = filtered.reduce((s, t) => s + ((t as {total_pay?: number|null}).total_pay ?? t.rate ?? 0), 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {viewingTicketsDriver.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{viewingTicketsDriver.name}&apos;s Tickets</h2>
                    <p className="text-xs text-gray-400">{driverTickets.length} total jobs</p>
                  </div>
                </div>
                <button onClick={() => { setViewingTicketsDriver(null); setDriverTickets([]) }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-4 shrink-0">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                  {(['all', 'pending', 'invoiced', 'paid'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDriverTicketFilter(tab)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${driverTicketFilter === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {ticketCounts[tab] > 0 && <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 font-bold">{ticketCounts[tab]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loadingDriverTickets ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary)]" /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No tickets found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Date</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Job</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Truck #</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Material</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Ticket #</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Hours</th>
                          <th className="text-right text-xs font-semibold text-gray-400 pb-3 pr-4">Rate</th>
                          <th className="text-right text-xs font-semibold text-gray-400 pb-3 pr-4">Total</th>
                          <th className="text-left text-xs font-semibold text-gray-400 pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtered.map(t => {
                          const ticketNums = t.load_tickets?.map(lt => lt.ticket_number).filter(Boolean).join(', ') || '—'
                          return (
                            <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                              <td className="py-3 pr-4 text-gray-900 font-medium max-w-[160px] truncate">{t.job_name}</td>
                              <td className="py-3 pr-4 text-gray-600">{t.truck_number || '—'}</td>
                              <td className="py-3 pr-4 text-gray-600">{t.material || '—'}</td>
                              <td className="py-3 pr-4 text-gray-600 font-mono text-xs">{ticketNums}</td>
                              <td className="py-3 pr-4 text-gray-600">{t.hours_worked || '—'}</td>
                              <td className="py-3 pr-4 text-right text-gray-600">{t.rate != null ? `$${t.rate.toLocaleString()}` : '—'}</td>
                              <td className="py-3 pr-4 text-right font-semibold text-gray-900">{((t as {total_pay?: number|null}).total_pay ?? t.rate) != null ? `$${((t as {total_pay?: number|null}).total_pay ?? t.rate)!.toLocaleString()}` : '—'}</td>
                              <td className="py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  t.status === 'paid'     ? 'bg-green-100 text-green-700' :
                                  t.status === 'invoiced' ? 'bg-blue-100 text-blue-700' :
                                  t.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                  t.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{t.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              {!loadingDriverTickets && filtered.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm shrink-0">
                  <span className="text-gray-400">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-gray-900">Total: ${totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Driver detail panel */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedDriver(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-white font-bold text-sm shrink-0">{selectedDriver.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
                  <p className="text-xs text-gray-400">{driverLoads.length} loads total</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => openEdit(selectedDriver, e)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[var(--brand-primary)]"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
            </div>
            {/* Panel tabs */}
            <div className="px-6 pt-4 pb-0 border-b border-gray-100 flex gap-1">
              {(['overview', 'compliance'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${detailTab === tab ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab === 'compliance' ? (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Compliance
                      {(() => { const s = getDriverComplianceStatus(selectedDriver); return s.status === 'expired' ? <span className="h-2 w-2 rounded-full bg-red-500" /> : s.status === 'expiring' ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null })()}
                    </span>
                  ) : 'Overview'}
                </button>
              ))}
            </div>

            <div className="p-6">
              {detailTab === 'compliance' ? (
                <div className="space-y-5">
                  {/* CDL */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">CDL</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">CDL Number</label>
                        <input defaultValue={selectedDriver.cdl_number ?? ''} onBlur={e => updateDriver({ cdl_number: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="—" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Class</label>
                        <select defaultValue={selectedDriver.cdl_class ?? ''} onBlur={e => updateDriver({ cdl_class: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                          <option value="">—</option>
                          <option value="A">Class A</option>
                          <option value="B">Class B</option>
                          <option value="C">Class C</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">State</label>
                        <input defaultValue={selectedDriver.cdl_state ?? ''} onBlur={e => updateDriver({ cdl_state: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="TX" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Expiry</label>
                        <input type="date" defaultValue={selectedDriver.cdl_expiry ?? ''} onBlur={e => updateDriver({ cdl_expiry: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                      </div>
                    </div>
                    {selectedDriver.cdl_expiry && <div className="mt-2"><ExpiryBadge date={selectedDriver.cdl_expiry} /></div>}
                  </div>

                  {/* Medical Card */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Medical Card</h4>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Expiry Date</label>
                      <input type="date" defaultValue={selectedDriver.medical_card_expiry ?? ''} onBlur={e => updateDriver({ medical_card_expiry: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                    </div>
                    {selectedDriver.medical_card_expiry && <div className="mt-2"><ExpiryBadge date={selectedDriver.medical_card_expiry} /></div>}
                  </div>

                  {/* Drug Test */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Drug Test</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Date</label>
                        <input type="date" defaultValue={selectedDriver.drug_test_date ?? ''} onBlur={e => updateDriver({ drug_test_date: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Result</label>
                        <select defaultValue={selectedDriver.drug_test_result ?? ''} onBlur={e => updateDriver({ drug_test_result: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]">
                          <option value="">—</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* MVR */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">MVR Review</h4>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Last Reviewed</label>
                      <input type="date" defaultValue={selectedDriver.mvr_last_reviewed ?? ''} onBlur={e => updateDriver({ mvr_last_reviewed: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Emergency Contact</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input defaultValue={selectedDriver.emergency_contact_name ?? ''} onBlur={e => updateDriver({ emergency_contact_name: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="—" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Phone</label>
                          <input defaultValue={selectedDriver.emergency_contact_phone ?? ''} onBlur={e => updateDriver({ emergency_contact_phone: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="(555) 000-0000" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Relation</label>
                          <input defaultValue={selectedDriver.emergency_contact_relation ?? ''} onBlur={e => updateDriver({ emergency_contact_relation: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Spouse" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Truck & Pay Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assignment & Pay</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Primary Truck #</label>
                        <input defaultValue={selectedDriver.primary_truck ?? ''} onBlur={e => updateDriver({ primary_truck: e.target.value || null })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]" placeholder="Truck 01" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1">YTD Paid</p>
                          <p className="font-bold text-gray-900">${(selectedDriver.ytd_paid ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1">Lifetime Paid</p>
                          <p className="font-bold text-gray-900">${(selectedDriver.lifetime_paid ?? 0).toLocaleString()}</p>
                        </div>
                      </div>
                      {selectedDriver.pay_type && (
                        <div className="bg-blue-50 rounded-xl p-3 text-sm">
                          <span className="text-blue-600 font-medium capitalize">{selectedDriver.pay_type.replace(/_/g, ' ')}</span>
                          {selectedDriver.pay_rate_value != null && <span className="text-blue-400 ml-2">@ ${selectedDriver.pay_rate_value}{selectedDriver.pay_type === 'percent_revenue' ? '%' : ''}</span>}
                          {selectedDriver.worker_type && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{selectedDriver.worker_type === 'employee' ? 'W-4' : 'W-9'}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
              <>
              {(selectedDriver.phone || selectedDriver.email) && (
                <div className="mb-5 space-y-1.5">
                  {selectedDriver.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="h-4 w-4 text-gray-400" /> {selectedDriver.phone}</div>}
                  {selectedDriver.email && <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="h-4 w-4 text-gray-400" /> {selectedDriver.email}</div>}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{t('totalLoads')}</p>
                  <p className="text-xl font-bold text-gray-900">{driverLoads.length}</p>
                </div>
                <div className="bg-[var(--brand-primary)]/5 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{t('revenue')}</p>
                  <p className="text-base font-bold text-[var(--brand-primary)]">${driverLoads.filter(l => ['approved', 'invoiced', 'paid'].includes(l.status)).reduce((s, l) => s + ((l as { total_pay?: number | null }).total_pay ?? l.rate ?? 0), 0).toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-3 ${driverAmountOwed > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-400 mb-1">{t('owed')}</p>
                  <p className={`text-base font-bold ${driverAmountOwed > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{driverAmountOwed > 0 ? `$${driverAmountOwed.toLocaleString()}` : '—'}</p>
                </div>
              </div>

              {/* Unpaid Work */}
              {driverUnpaidLoads.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" /> {t('unpaidWork')}
                    </h3>
                    <button onClick={() => openPayModal(selectedDriver, driverAmountOwed)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[var(--brand-primary)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--brand-primary-hover)] transition-colors">
                      <CreditCard className="h-3 w-3" /> {t('payNow')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {driverUnpaidLoads.map(l => (
                      <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{l.job_name}</p>
                          <p className="text-xs text-gray-400">{new Date(l.date + 'T00:00:00').toLocaleDateString()}</p>
                        </div>
                        <p className="text-sm font-semibold text-orange-700 shrink-0">${l.rate?.toLocaleString()}</p>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold border-t border-orange-200">
                      <span className="text-orange-700">{t('owed')}</span>
                      <span className="text-orange-700">${driverAmountOwed.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {driverPaymentHistory.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm text-gray-900 mb-3">{t('paymentHistory')}</h3>
                  <div className="space-y-2">
                    {driverPaymentHistory.map(p => (
                      <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                        <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                          <DollarSign className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-green-700">${p.amount.toLocaleString()}</p>
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{p.payment_method}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(p.payment_date + 'T00:00:00').toLocaleDateString()}</p>
                          {p.check_number && <p className="text-xs text-gray-400">Check #{p.check_number}</p>}
                          {p.period_start && <p className="text-xs text-gray-400">{new Date(p.period_start + 'T00:00:00').toLocaleDateString()} – {p.period_end ? new Date(p.period_end + 'T00:00:00').toLocaleDateString() : '?'}</p>}
                          {p.notes && <p className="text-xs text-gray-400 truncate">{p.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load History */}
              <h3 className="font-semibold text-sm text-gray-900 mb-3">{t('loadHistory')}</h3>
              {driverLoads.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">{t('noLoadsRecorded')}</p>
              ) : (
                <div className="space-y-2">
                  {driverLoads.map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{l.job_name}</p>
                        <p className="text-xs text-gray-400">{new Date(l.date + 'T00:00:00').toLocaleDateString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">${l.rate?.toLocaleString()}</p>
                        <span className={`text-xs capitalize ${l.status === 'paid' ? 'text-green-600' : l.status === 'invoiced' ? 'text-blue-600' : l.status === 'approved' ? 'text-[var(--brand-primary)]' : 'text-yellow-600'}`}>{l.status}{l.driver_paid ? ' · paid' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
