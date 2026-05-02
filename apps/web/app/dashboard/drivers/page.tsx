'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Users, Phone, Mail, X, Pencil, Trash2, DollarSign, CreditCard, Calendar, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Driver, Load, DriverPayment } from '@/lib/types'
import { getCompanyId } from '@/lib/get-company-id'

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
  const supabase = createClient()

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const companyId = await getCompanyId()
    if (!companyId) { setLoading(false); return }

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const cutoff = sixMonthsAgo.toISOString().split('T')[0]!

    const [dRes, lRes, dpRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('company_id', companyId).order('name'),
      supabase.from('loads').select('*').eq('company_id', companyId).gte('date', cutoff),
      supabase.from('driver_payments').select('*').eq('company_id', companyId).order('payment_date', { ascending: false }),
    ])
    if (dRes.error) toast.error('Failed to load drivers: ' + dRes.error.message)
    setDrivers(dRes.data ?? [])
    setLoads(lRes.data ?? [])
    setDriverPayments(dpRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Derived: unpaid work per driver ─────────────────────────────────────
  const unpaidLoads = loads.filter(l => l.status === 'approved' && !l.driver_paid)

  const driverUnpaidSummary = drivers.map(d => {
    const dLoads = unpaidLoads.filter(l => l.driver_name === d.name)
    const total  = dLoads.reduce((s, l) => s + (l.rate ?? 0), 0)
    const sorted = [...dLoads].sort((a, b) => a.date < b.date ? -1 : 1)
    return { driver: d, loads: dLoads, total, oldestDate: sorted[0]?.date ?? null }
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  // ── Driver form ──────────────────────────────────────────────────────────
  function openAdd() { setEditingDriver(null); setForm(EMPTY_DRIVER); setShowForm(true) }
  function openEdit(d: Driver, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingDriver(d)
    setForm({ name: d.name, email: d.email ?? '', phone: d.phone ?? '', status: d.status })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const companyId = await getCompanyId()
    if (!companyId) { toast.error('Company not found'); setSaving(false); return }
    if (editingDriver) {
      const { error } = await supabase.from('drivers').update({ name: form.name, email: form.email || null, phone: form.phone || null, status: form.status }).eq('id', editingDriver.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Driver updated')
      if (selectedDriver?.id === editingDriver.id) setSelectedDriver(p => p ? { ...p, name: form.name, email: form.email || null, phone: form.phone || null, status: form.status as Driver['status'] } : null)
    } else {
      const { error } = await supabase.from('drivers').insert({ name: form.name, email: form.email || null, phone: form.phone || null, status: form.status, company_id: companyId })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Driver added')
    }
    setSaving(false); setShowForm(false); setForm(EMPTY_DRIVER); setEditingDriver(null); fetchData()
  }

  async function handleDelete(d: Driver, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete ${d.name}? This cannot be undone.`)) return
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

  // ── Stats helpers ─────────────────────────────────────────────────────────
  function getDriverStats(name: string) {
    const dl = loads.filter(l => l.driver_name === name)
    const revenue = dl.filter(l => l.status === 'paid').reduce((s, l) => s + (l.rate ?? 0), 0)
    const owed    = dl.filter(l => l.status === 'approved' && !l.driver_paid).reduce((s, l) => s + (l.rate ?? 0), 0)
    return { loads: dl.length, revenue, owed }
  }

  // Detail panel data
  const driverLoads          = selectedDriver ? loads.filter(l => l.driver_name === selectedDriver.name) : []
  const driverUnpaidLoads    = driverLoads.filter(l => l.status === 'approved' && !l.driver_paid)
  const driverAmountOwed     = driverUnpaidLoads.reduce((s, l) => s + (l.rate ?? 0), 0)
  const driverPaymentHistory = selectedDriver ? driverPayments.filter(p => p.driver_name === selectedDriver.name) : []

  const shownDrivers = activeTab === 'unpaid'
    ? drivers.filter(d => driverUnpaidSummary.some(u => u.driver.id === d.id))
    : drivers

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 text-sm mt-0.5">{drivers.filter(d => d.status === 'active').length} active · {driverUnpaidSummary.length} with unpaid work</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-[#2d7a4f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] transition-colors">
          <Plus className="h-4 w-4" /> Add Driver
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'unpaid'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'all' ? 'All Drivers' : (
              <span className="flex items-center gap-1.5">
                Unpaid
                {driverUnpaidSummary.length > 0 && <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">{driverUnpaidSummary.length}</span>}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#2d7a4f]" /></div>
      ) : activeTab === 'unpaid' ? (
        // ── Unpaid Tab ──────────────────────────────────────────────────────
        driverUnpaidSummary.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <DollarSign className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-400">No unpaid driver work</p>
            <p className="text-xs text-gray-400 mt-1">All approved tickets are settled</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-gray-900">Drivers with Unpaid Work</h2>
                <p className="text-xs text-gray-400 mt-0.5">Approved tickets awaiting payment</p>
              </div>
              <span className="text-sm font-bold text-orange-600">
                ${driverUnpaidSummary.reduce((s, u) => s + u.total, 0).toLocaleString()} total owed
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {driverUnpaidSummary.map(({ driver: d, loads: dLoads, total, oldestDate }) => (
                <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-[#1e3a2a] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-400">{dLoads.length} ticket{dLoads.length !== 1 ? 's' : ''}{oldestDate ? ` · since ${new Date(oldestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-lg font-bold text-orange-600">${total.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">owed</p>
                  </div>
                  <button
                    onClick={() => openPayModal(d, total)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2d7a4f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245f3e] transition-colors shrink-0"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Record Payment
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        // ── All Drivers Tab ─────────────────────────────────────────────────
        drivers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-400 mb-1">No drivers yet</p>
            <button onClick={openAdd} className="text-sm text-[#2d7a4f]">Add your first driver →</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map(d => {
              const stats = getDriverStats(d.name)
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedDriver(d)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#1e3a2a] flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {d.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{d.name}</p>
                        <span className={`inline-flex text-xs rounded-full px-2 py-0.5 font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{d.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => openEdit(d, e)} className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#2d7a4f]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={e => handleDelete(d, e)} className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 text-xs mb-0.5">Loads</p>
                      <p className="font-bold text-gray-900">{stats.loads}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400 text-xs mb-0.5">Revenue</p>
                      <p className="font-bold text-[#2d7a4f] text-xs">${stats.revenue.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg p-2.5 ${stats.owed > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                      <p className="text-gray-400 text-xs mb-0.5">Owed</p>
                      <p className={`font-bold text-xs ${stats.owed > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{stats.owed > 0 ? `$${stats.owed.toLocaleString()}` : '—'}</p>
                    </div>
                  </div>
                  {d.phone && <div className="flex items-center gap-2 mt-3 text-xs text-gray-400"><Phone className="h-3 w-3" /> {d.phone}</div>}
                  {d.email && <div className="flex items-center gap-2 mt-1 text-xs text-gray-400"><Mail className="h-3 w-3" /> {d.email}</div>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={e => { e.stopPropagation(); toggleStatus(d) }} className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#2d7a4f] hover:text-[#2d7a4f] transition-colors">
                      {d.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                    </button>
                    {stats.owed > 0 && (
                      <button onClick={e => { e.stopPropagation(); openPayModal(d, stats.owed) }} className="flex-1 text-xs py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors font-medium">
                        Pay ${stats.owed.toLocaleString()}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingDriver ? 'Edit Driver' : 'Add Driver'}</h2>
              <button onClick={() => { setShowForm(false); setEditingDriver(null); setForm(EMPTY_DRIVER) }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="Jake Morrison" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="(555) 000-0000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="driver@email.com" />
              </div>
              {editingDriver && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingDriver(null); setForm(EMPTY_DRIVER) }} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#2d7a4f] py-2.5 text-sm font-semibold text-white hover:bg-[#245f3e] disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving…' : editingDriver ? 'Save Changes' : 'Add Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
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
                    <span className="text-orange-700">{cnt} approved ticket{cnt !== 1 ? 's' : ''} unpaid</span>
                    <span className="font-bold text-orange-700">${owed.toLocaleString()} owed</span>
                  </div>
                ) : null
              })()}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($) *</label>
                <input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                  <input required type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                  <select value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]">
                    {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {payForm.payment_method === 'Check' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Check Number</label>
                  <input value={payForm.check_number} onChange={e => setPayForm(p => ({ ...p, check_number: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="1234" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period Start</label>
                  <input type="date" value={payForm.period_start} onChange={e => setPayForm(p => ({ ...p, period_start: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period End</label>
                  <input type="date" value={payForm.period_end} onChange={e => setPayForm(p => ({ ...p, period_end: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a4f]/20 focus:border-[#2d7a4f]" placeholder="Reference, memo, etc." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setPayingDriver(null); setPayForm(EMPTY_PAY) }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingPay} className="flex-1 h-10 rounded-xl bg-[#2d7a4f] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#245f3e] disabled:opacity-60">
                  {savingPay && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingPay ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver detail panel */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedDriver(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#1e3a2a] flex items-center justify-center text-white font-bold text-sm shrink-0">{selectedDriver.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
                  <p className="text-xs text-gray-400">{driverLoads.length} loads total</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => openEdit(selectedDriver, e)} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#2d7a4f]"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-6">
              {(selectedDriver.phone || selectedDriver.email) && (
                <div className="mb-5 space-y-1.5">
                  {selectedDriver.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="h-4 w-4 text-gray-400" /> {selectedDriver.phone}</div>}
                  {selectedDriver.email && <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="h-4 w-4 text-gray-400" /> {selectedDriver.email}</div>}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Total Loads</p>
                  <p className="text-xl font-bold text-gray-900">{driverLoads.length}</p>
                </div>
                <div className="bg-[#2d7a4f]/5 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Revenue</p>
                  <p className="text-base font-bold text-[#2d7a4f]">${driverLoads.filter(l => l.status === 'paid').reduce((s, l) => s + (l.rate ?? 0), 0).toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-3 ${driverAmountOwed > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-400 mb-1">Owed</p>
                  <p className={`text-base font-bold ${driverAmountOwed > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{driverAmountOwed > 0 ? `$${driverAmountOwed.toLocaleString()}` : '—'}</p>
                </div>
              </div>

              {/* Unpaid Work */}
              {driverUnpaidLoads.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" /> Unpaid Work
                    </h3>
                    <button onClick={() => openPayModal(selectedDriver, driverAmountOwed)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#2d7a4f] rounded-lg px-2.5 py-1.5 hover:bg-[#245f3e] transition-colors">
                      <CreditCard className="h-3 w-3" /> Pay Now
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
                      <span className="text-orange-700">Total owed</span>
                      <span className="text-orange-700">${driverAmountOwed.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {driverPaymentHistory.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm text-gray-900 mb-3">Payment History</h3>
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
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Load History</h3>
              {driverLoads.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No loads recorded</p>
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
                        <span className={`text-xs capitalize ${l.status === 'paid' ? 'text-green-600' : l.status === 'invoiced' ? 'text-blue-600' : l.status === 'approved' ? 'text-[#2d7a4f]' : 'text-yellow-600'}`}>{l.status}{l.driver_paid ? ' · paid' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
