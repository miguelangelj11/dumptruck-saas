'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { Plus, Pencil, Trash2, Wallet, Loader2, X, Download } from 'lucide-react'
import { toast } from 'sonner'
import type { Expense } from '@/lib/types'
import LockedFeature from '@/components/dashboard/locked-feature'
import { EXPENSE_CATEGORIES, getCategoryConfig } from '@/lib/expenses/categories'

const DEFAULT_VENDORS = [
  'Shell', 'Pilot Flying J', "Love's", 'BP', 'Chevron', 'Exxon', 'Mobil',
  'NAPA', "O'Reilly Auto Parts", 'AutoZone', 'Pep Boys',
  'Goodyear', 'Bridgestone', 'TA Travel Centers', 'Speedco',
]

const PAYMENT_METHODS = [
  { value: 'cash',        label: '💵 Cash' },
  { value: 'check',       label: '📄 Check' },
  { value: 'credit_card', label: '💳 Credit Card' },
  { value: 'debit_card',  label: '💳 Debit Card' },
  { value: 'ach',         label: '🏦 ACH / Bank Transfer' },
  { value: 'fuel_card',   label: '⛽ Fuel Card' },
  { value: 'other',       label: '📋 Other' },
]

const fmt = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

type SortField = 'date' | 'amount' | 'category' | 'vendor'
type SortDir   = 'asc' | 'desc'

type FormState = {
  description: string
  amount: string
  category: string
  date: string
  paymentMethod: string
  linkType: string
  linkId: string
  notes: string
}

const emptyForm = (): FormState => ({
  description: '',
  amount: '',
  category: 'Fuel',
  date: new Date().toISOString().split('T')[0]!,
  paymentMethod: 'other',
  linkType: '',
  linkId: '',
  notes: '',
})

export default function ExpensesPage() {
  const t = useTranslations('revenue')
  const [planLocked, setPlanLocked] = useState<null | { plan: string; price: number }>(null)
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Expense | null>(null)
  const [form, setForm]             = useState<FormState>(emptyForm())
  const [orgId, setOrgId]           = useState('')

  // Filter / search / sort
  const [activeCategory,      setActiveCategory]      = useState('all')
  const [searchQuery,         setSearchQuery]         = useState('')
  const [sortBy,              setSortBy]              = useState<SortField>('date')
  const [sortDir,             setSortDir]             = useState<SortDir>('desc')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all')

  // Bulk select
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([])

  // Vendor autocomplete
  const [vendorInput,          setVendorInput]          = useState('')
  const [showVendorSuggestions,setShowVendorSuggestions] = useState(false)

  // Receipt upload
  const [receiptUrl,       setReceiptUrl]       = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [dragOver,         setDragOver]         = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Link To options
  const [jobs,        setJobs]        = useState<{ id: string; job_name: string }[]>([])
  const [localDrivers,setLocalDrivers] = useState<{ id: string; name: string }[]>([])
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([])

  const supabase = createClient()

  // Plan gate
  useEffect(() => {
    getCompanyId().then(async id => {
      if (!id) return
      const supaClient = createClient()
      const { data } = await supaClient.from('companies').select('plan, is_super_admin, subscription_override').eq('id', id).maybeSingle()
      if (data?.is_super_admin || data?.subscription_override) return
      const p = (data?.plan as string | null) ?? 'owner_operator'
      if (p === 'solo') setPlanLocked({ plan: 'Owner Operator Pro', price: 65 })
    })
  }, [])

  // Auto-open from deep link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new-expense') === '1') {
      setShowForm(true)
      window.history.replaceState({}, '', '/dashboard/expenses')
    }
  }, [])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const id = await getCompanyId()
    if (!id) { setLoading(false); return }
    setOrgId(id)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', id)
      .order('date', { ascending: false })
    if (error) toast.error('Failed to load expenses')
    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // Fetch link-to options once orgId is known
  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase.from('jobs').select('id, job_name').eq('company_id', orgId).eq('status', 'active'),
      supabase.from('drivers').select('id, name').eq('company_id', orgId).eq('status', 'active'),
      supabase.from('contractors').select('id, name').eq('company_id', orgId).eq('status', 'active'),
    ]).then(([jobsRes, driversRes, contractorsRes]) => {
      setJobs(jobsRes.data ?? [])
      setLocalDrivers(driversRes.data ?? [])
      setContractors(contractorsRes.data ?? [])
    })
  }, [orgId, supabase])

  // Vendor suggestions from past expenses + defaults
  const vendorHistory = [...new Set(expenses.map(e => e.vendor_name).filter(Boolean) as string[])]
  const allVendors    = [...new Set([...vendorHistory, ...DEFAULT_VENDORS])]
  const filteredVendors = vendorInput
    ? allVendors.filter(v => v.toLowerCase().includes(vendorInput.toLowerCase()) && v !== vendorInput)
    : []

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setVendorInput('')
    setReceiptUrl('')
    setShowForm(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      description:   e.description,
      amount:        String(e.amount),
      category:      e.category,
      date:          e.date,
      paymentMethod: e.payment_method ?? 'other',
      linkType:      e.link_type ?? '',
      linkId:        e.link_id ?? '',
      notes:         e.notes ?? '',
    })
    setVendorInput(e.vendor_name ?? '')
    setReceiptUrl(e.receipt_url ?? '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm())
    setVendorInput('')
    setReceiptUrl('')
  }

  async function handleReceiptUpload(file: File) {
    setUploadingReceipt(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `receipts/${orgId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('company-documents').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('company-documents').getPublicUrl(path)
      setReceiptUrl(publicUrl)
    } catch (err) {
      toast.error('Upload failed — try again')
      console.error(err)
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.description.trim() || isNaN(amount) || amount <= 0) {
      toast.error('Please fill in all required fields')
      return
    }
    const newExpense = {
      description:       form.description.trim(),
      amount,
      category:          form.category,
      date:              form.date,
      company_id:        orgId,
      vendor_name:       vendorInput.trim() || null,
      payment_method:    form.paymentMethod || 'other',
      receipt_url:       receiptUrl || null,
      notes:             form.notes.trim() || null,
      link_type:         form.linkType || null,
      link_id:           form.linkId || null,
      is_duplicate_flag: false,
    }

    // Duplicate detection (new entries only)
    if (!editing) {
      const oneDayMs  = 86400000
      const expDate   = new Date(form.date + 'T00:00:00').getTime()
      const duplicate = expenses.find(e =>
        e.vendor_name === newExpense.vendor_name &&
        e.vendor_name !== null &&
        e.amount === amount &&
        Math.abs(new Date(e.date + 'T00:00:00').getTime() - expDate) <= oneDayMs
      )
      if (duplicate) {
        const proceed = confirm(
          `⚠️ Possible duplicate detected!\n\nA ${duplicate.category} expense of $${duplicate.amount} from ${duplicate.vendor_name} already exists on or near this date.\n\nSave anyway?`
        )
        if (!proceed) return
        newExpense.is_duplicate_flag = true
      }
    }

    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('expenses').update(newExpense).eq('id', editing.id)
      if (error) { toast.error('Failed to update expense'); setSaving(false); return }
      toast.success('Expense updated')
    } else {
      const { error } = await supabase.from('expenses').insert(newExpense)
      if (error) { toast.error('Failed to add expense'); setSaving(false); return }
      toast.success('Expense added')
    }
    setSaving(false)
    closeForm()
    fetchExpenses()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete expense'); return }
    toast.success('Expense deleted')
    setExpenses(prev => prev.filter(e => e.id !== id))
    setSelectedExpenses(prev => prev.filter(sid => sid !== id))
  }

  // ── Filtering + sorting ───────────────────────────────────────────────────
  const filtered = expenses
    .filter(e => {
      const matchCategory = activeCategory === 'all' || e.category === activeCategory
      const q = searchQuery.toLowerCase()
      const matchSearch = !q ||
        e.description.toLowerCase().includes(q) ||
        (e.vendor_name ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      const matchPayment = filterPaymentMethod === 'all' || e.payment_method === filterPaymentMethod
      return matchCategory && matchSearch && matchPayment
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount
      let aVal = '', bVal = ''
      if (sortBy === 'date')     { aVal = a.date;              bVal = b.date }
      if (sortBy === 'category') { aVal = a.category;          bVal = b.category }
      if (sortBy === 'vendor')   { aVal = a.vendor_name ?? ''; bVal = b.vendor_name ?? '' }
      if (sortDir === 'desc') return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    })

  const allSelected = selectedExpenses.length === filtered.length && filtered.length > 0
  const total       = filtered.reduce((s, e) => s + e.amount, 0)

  // Category totals for summary cards
  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat: cat.id,
    label: cat.label,
    emoji: cat.emoji,
    total: expenses.filter(e => e.category === cat.id).reduce((s, e) => s + e.amount, 0),
  })).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

  function handleExportCSV() {
    const toExport = selectedExpenses.length > 0
      ? expenses.filter(e => selectedExpenses.includes(e.id))
      : filtered
    const headers = ['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Payment Method', 'Link Type', 'Link', 'Notes']
    const rows = toExport.map(e => [
      e.date, e.category, e.description, e.vendor_name ?? '', e.amount,
      e.payment_method ?? '', e.link_type ?? '', e.link_id ?? '', e.notes ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleBulkRecategorize(newCategory: string) {
    if (!newCategory) return
    await supabase.from('expenses').update({ category: newCategory }).in('id', selectedExpenses).eq('company_id', orgId)
    setSelectedExpenses([])
    fetchExpenses()
    toast.success('Category updated')
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedExpenses.length} expense${selectedExpenses.length !== 1 ? 's' : ''}?`)) return
    await supabase.from('expenses').delete().in('id', selectedExpenses).eq('company_id', orgId)
    setSelectedExpenses([])
    fetchExpenses()
    toast.success('Deleted')
  }

  if (planLocked) {
    return <LockedFeature title="Expense Tracking" description="Log and categorize your business costs — fuel, tires, maintenance, and more." plan={planLocked.plan} price={planLocked.price} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expenseTracker')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your business costs</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-dark)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            <Plus className="h-4 w-4" /> {t('addExpense')}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">{t('expenseTracker')}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(expenses.reduce((s, e) => s + e.amount, 0))}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('expenseCount', { count: expenses.length })}</p>
        </div>
        {byCategory.slice(0, 3).map(({ cat, label, emoji, total: catTotal }) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium">{emoji} {label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt(catTotal)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('expenseCount', { count: expenses.filter(e => e.category === cat).length })}</p>
          </div>
        ))}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.filter(cat => expenses.some(e => e.category === cat.id)).map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id ? 'bg-gray-900 text-white' : `${cat.color} hover:opacity-80`
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Search + sort + filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search description, vendor, notes..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
          />
        </div>
        <select
          value={`${sortBy}_${sortDir}`}
          onChange={e => {
            const parts = e.target.value.split('_')
            const dir   = parts.pop() as SortDir
            setSortBy(parts.join('_') as SortField)
            setSortDir(dir)
          }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
        >
          <option value="date_desc">Date (Newest)</option>
          <option value="date_asc">Date (Oldest)</option>
          <option value="amount_desc">Amount (High→Low)</option>
          <option value="amount_asc">Amount (Low→High)</option>
          <option value="category_asc">Category (A→Z)</option>
          <option value="vendor_asc">Vendor (A→Z)</option>
        </select>
        <select
          value={filterPaymentMethod}
          onChange={e => setFilterPaymentMethod(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
        >
          <option value="all">All Methods</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="credit_card">Credit Card</option>
          <option value="debit_card">Debit Card</option>
          <option value="fuel_card">Fuel Card</option>
          <option value="ach">ACH</option>
        </select>
        {(searchQuery || filterPaymentMethod !== 'all') && (
          <button
            onClick={() => { setSearchQuery(''); setFilterPaymentMethod('all') }}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">
            {activeCategory !== 'all' || searchQuery ? 'No expenses match your filters' : t('noExpenses')}
          </p>
          {!searchQuery && activeCategory === 'all' && (
            <button onClick={openAdd} className="mt-4 text-sm text-[var(--brand-primary)] font-medium hover:underline">
              + {t('addExpense')}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Bulk action toolbar */}
          {selectedExpenses.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white flex-wrap">
              <span className="text-sm font-semibold">{selectedExpenses.length} selected</span>
              <select
                defaultValue=""
                onChange={e => { handleBulkRecategorize(e.target.value); e.target.value = '' }}
                className="text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white"
              >
                <option value="">Recategorize…</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                📥 Export
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
              >
                🗑 Delete
              </button>
              <button onClick={() => setSelectedExpenses([])} className="ml-auto text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[28px_1fr_120px_100px_80px_52px_72px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => setSelectedExpenses(e.target.checked ? filtered.map(ex => ex.id) : [])}
              className="w-4 h-4 rounded mt-0.5"
            />
            <span>{t('expenseTable.description')}</span>
            <span>{t('expenseTable.category')}</span>
            <span>{t('expenseTable.date')}</span>
            <span className="text-right">{t('expenseTable.amount')}</span>
            <span className="text-center">Receipt</span>
            <span />
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map(exp => {
              const catConfig = getCategoryConfig(exp.category)
              return (
                <div
                  key={exp.id}
                  className={`grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_120px_100px_80px_52px_72px] gap-2 sm:gap-3 px-4 py-3 items-start hover:bg-gray-50 transition-colors ${exp.is_duplicate_flag ? 'bg-orange-50/40' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedExpenses.includes(exp.id)}
                    onChange={e => setSelectedExpenses(prev =>
                      e.target.checked ? [...prev, exp.id] : prev.filter(id => id !== exp.id)
                    )}
                    className="w-4 h-4 rounded mt-1"
                  />

                  {/* Description + sub-info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{exp.description}</p>
                      {exp.is_duplicate_flag && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">⚠️ Possible duplicate</span>
                      )}
                    </div>
                    {/* Mobile category + date */}
                    <p className="text-xs text-gray-400 sm:hidden mt-0.5">
                      {fmtDate(exp.date)} ·{' '}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${catConfig.color}`}>
                        {catConfig.emoji} {catConfig.label}
                      </span>
                    </p>
                    {/* Vendor / payment / link / notes sub-row */}
                    {(exp.vendor_name || (exp.payment_method && exp.payment_method !== 'other') || (exp.link_type && exp.link_id) || exp.notes) && (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {exp.vendor_name && (
                          <span className="text-xs text-gray-400">{exp.vendor_name}</span>
                        )}
                        {exp.payment_method && exp.payment_method !== 'other' && (
                          <span className="text-xs text-gray-300">{exp.payment_method.replace(/_/g, ' ')}</span>
                        )}
                        {exp.link_type && exp.link_id && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">
                            {exp.link_type === 'job' ? '🏗️' : exp.link_type === 'truck' ? '🚛' : exp.link_type === 'driver' ? '👷' : '🤝'}{' '}
                            {exp.link_id}
                          </span>
                        )}
                        {exp.notes && (
                          <span className="text-xs text-gray-400 italic truncate max-w-[200px]">"{exp.notes}"</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Category badge (desktop) */}
                  <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold self-start mt-0.5 ${catConfig.color}`}>
                    {catConfig.emoji} {catConfig.label}
                  </span>

                  {/* Date (desktop) */}
                  <span className="hidden sm:block text-sm text-gray-500 self-start mt-0.5">{fmtDate(exp.date)}</span>

                  {/* Amount */}
                  <span className="text-sm font-semibold text-gray-900 text-right self-start mt-0.5">{fmt(exp.amount)}</span>

                  {/* Receipt thumbnail (desktop) */}
                  <div className="hidden sm:flex items-start justify-center mt-0.5">
                    {exp.receipt_url ? (
                      <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80">
                        {exp.receipt_url.endsWith('.pdf') ? (
                          <div className="w-full h-full bg-red-50 flex items-center justify-center text-red-500 text-[10px] font-bold">PDF</div>
                        ) : (
                          <img src={exp.receipt_url} className="w-full h-full object-cover" alt="Receipt" />
                        )}
                      </a>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
                        <span className="text-gray-300 text-xs">—</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 self-start mt-0.5">
                    <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(exp.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer total */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {t('expenseSummary', { count: filtered.length, total: fmt(total) })}
              {activeCategory !== 'all' ? ` · ${getCategoryConfig(activeCategory).label}` : ''}
              {searchQuery ? ` · "${searchQuery}"` : ''}
            </span>
            <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-semibold text-gray-900">{t('addExpenseModal')}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('descriptionLabel')} *</label>
                <input
                  type="text" required
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Diesel fill-up"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('amountLabel')} *</label>
                  <input
                    type="number" required min="0.01" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('dateLabel')} *</label>
                  <input
                    type="date" required
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">{t('categoryLabel')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <button
                      key={cat.id} type="button"
                      onClick={() => setForm(p => ({ ...p, category: cat.id }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        form.category === cat.id ? 'bg-gray-900 text-white' : `${cat.color} hover:opacity-80`
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vendor autocomplete */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  value={vendorInput}
                  onChange={e => setVendorInput(e.target.value)}
                  onFocus={() => setShowVendorSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 150)}
                  placeholder="e.g. Shell, NAPA, O'Reilly…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
                {showVendorSuggestions && filteredVendors.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredVendors.slice(0, 6).map(vendor => (
                      <button
                        key={vendor} type="button"
                        onMouseDown={() => setVendorInput(vendor)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                      >
                        {vendor}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Link To */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Link To
                  <span className="text-gray-400 font-normal ml-1">— optional, enables per-job/truck profit tracking</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {(['job', 'truck', 'driver', 'subcontractor'] as const).map(type => (
                    <button
                      key={type} type="button"
                      onClick={() => setForm(p => ({ ...p, linkType: p.linkType === type ? '' : type, linkId: '' }))}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border-2 capitalize text-center transition-all ${
                        form.linkType === type
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {type === 'job' ? '🏗️' : type === 'truck' ? '🚛' : type === 'driver' ? '👷' : '🤝'}
                      <br />{type}
                    </button>
                  ))}
                </div>
                {form.linkType === 'job' && (
                  <select
                    value={form.linkId}
                    onChange={e => setForm(p => ({ ...p, linkId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="">Select job…</option>
                    {jobs.map(j => <option key={j.id} value={j.job_name}>{j.job_name}</option>)}
                  </select>
                )}
                {form.linkType === 'truck' && (
                  <input
                    type="text" value={form.linkId}
                    onChange={e => setForm(p => ({ ...p, linkId: e.target.value }))}
                    placeholder="Truck number e.g. W23"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none"
                  />
                )}
                {form.linkType === 'driver' && (
                  <select
                    value={form.linkId}
                    onChange={e => setForm(p => ({ ...p, linkId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="">Select driver…</option>
                    {localDrivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                )}
                {form.linkType === 'subcontractor' && (
                  <select
                    value={form.linkId}
                    onChange={e => setForm(p => ({ ...p, linkId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    <option value="">Select subcontractor…</option>
                    {contractors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Tire blew out on 285, replaced with Goodyear 11R22.5…"
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
                />
              </div>

              {/* Receipt upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Receipt Photo</label>
                {receiptUrl ? (
                  <div className="relative">
                    {receiptUrl.endsWith('.pdf') ? (
                      <div className="w-full h-24 bg-red-50 border border-gray-200 rounded-xl flex items-center justify-center gap-2">
                        <span className="text-red-500 font-bold">PDF</span>
                        <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">View</a>
                      </div>
                    ) : (
                      <img src={receiptUrl} alt="Receipt" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptUrl('')}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={async e => {
                      e.preventDefault()
                      setDragOver(false)
                      const file = e.dataTransfer.files[0]
                      if (file) await handleReceiptUpload(file)
                    }}
                    onClick={() => receiptInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {uploadingReceipt ? (
                      <p className="text-sm text-gray-500">Uploading…</p>
                    ) : (
                      <>
                        <span className="text-2xl block mb-1">📷</span>
                        <p className="text-sm text-gray-500">Tap to take photo or upload receipt</p>
                        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, PDF</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f) }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={closeForm}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="flex-1 rounded-xl bg-[var(--brand-dark)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {saving ? t('adding') : t('addExpense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
