'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { Plus, Pencil, Trash2, Wallet, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Expense } from '@/lib/types'
import LockedFeature from '@/components/dashboard/locked-feature'

const CATEGORIES = ['Fuel', 'DEF', 'Tires', 'Maintenance', 'Insurance', 'Labor', 'Equipment', 'Tolls', 'Other']

const fmt = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const CATEGORY_COLORS: Record<string, string> = {
  Fuel:        'bg-blue-100 text-blue-700',
  DEF:         'bg-cyan-100 text-cyan-700',
  Tires:       'bg-gray-100 text-gray-700',
  Maintenance: 'bg-orange-100 text-orange-700',
  Insurance:   'bg-purple-100 text-purple-700',
  Labor:       'bg-yellow-100 text-yellow-700',
  Equipment:   'bg-green-100 text-green-700',
  Tolls:       'bg-pink-100 text-pink-700',
  Other:       'bg-slate-100 text-slate-700',
}

const emptyForm = () => ({
  description: '',
  amount: '',
  category: 'Fuel',
  date: new Date().toISOString().split('T')[0]!,
})

export default function ExpensesPage() {
  const [planLocked, setPlanLocked] = useState<null | { plan: string; price: number }>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [categoryFilter, setCategoryFilter] = useState('')
  const [orgId, setOrgId] = useState('')
  const supabase = createClient()

  // Plan gate: Expenses requires Owner Operator+
  useEffect(() => {
    getCompanyId().then(async id => {
      if (!id) return
      const supaClient = createClient()
      const { data } = await supaClient.from('companies').select('plan, is_super_admin, subscription_override').eq('id', id).maybeSingle()
      if (data?.is_super_admin || data?.subscription_override) return
      const p = (data?.plan as string | null) ?? 'owner_operator'
      if (p === 'solo') setPlanLocked({ plan: 'Owner Operator', price: 80 })
    })
  }, [])

  // Auto-open from dashboard "Add Expense" button
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
    setExpenses(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({ description: e.description, amount: String(e.amount), category: e.category, date: e.date })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm())
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.description.trim() || isNaN(amount) || amount <= 0) {
      toast.error('Please fill in all fields correctly')
      return
    }
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      amount,
      category: form.category,
      date: form.date,
      company_id: orgId,
    }
    if (editing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id)
      if (error) { toast.error('Failed to update expense'); setSaving(false); return }
      toast.success('Expense updated')
    } else {
      const { error } = await supabase.from('expenses').insert(payload)
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
  }

  const filtered = categoryFilter ? expenses.filter(e => e.category === categoryFilter) : expenses
  const total = filtered.reduce((s, e) => s + e.amount, 0)

  // Category totals for summary
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(r => r.total > 0).sort((a, b) => b.total - a.total)

  if (planLocked) {
    return <LockedFeature title="Expense Tracking" description="Log and categorize your business costs — fuel, tires, maintenance, and more. See exactly where your money is going." plan={planLocked.plan} price={planLocked.price} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your business costs</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-dark)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Total Expenses</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(expenses.reduce((s, e) => s + e.amount, 0))}</p>
          <p className="text-xs text-gray-400 mt-0.5">{expenses.length} entries</p>
        </div>
        {byCategory.slice(0, 3).map(({ cat, total: catTotal }) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 font-medium">{cat}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmt(catTotal)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{expenses.filter(e => e.category === cat).length} entries</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            !categoryFilter ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.filter(c => expenses.some(e => e.category === c)).map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              categoryFilter === cat ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
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
            {categoryFilter ? `No ${categoryFilter} expenses recorded` : 'No expenses recorded yet'}
          </p>
          <button onClick={openAdd} className="mt-4 text-sm text-[var(--brand-primary)] font-medium hover:underline">
            + Add your first expense
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px_80px_80px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Description</span>
            <span>Category</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map(exp => (
              <div key={exp.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_100px_80px_80px] gap-2 sm:gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                  <p className="text-xs text-gray-400 sm:hidden mt-0.5">
                    {fmtDate(exp.date)} · <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'}`}>{exp.category}</span>
                  </p>
                </div>
                <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'}`}>
                  {exp.category}
                </span>
                <span className="hidden sm:block text-sm text-gray-500">{fmtDate(exp.date)}</span>
                <span className="text-sm font-semibold text-gray-900 text-right">{fmt(exp.amount)}</span>
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(exp.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer total */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
            <span className="text-xs text-gray-500">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}{categoryFilter ? ` · ${categoryFilter}` : ''}</span>
            <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Diesel fill-up"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, category: cat }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        form.category === cat
                          ? 'bg-[var(--brand-dark)] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-[var(--brand-dark)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {saving ? (editing ? 'Saving…' : 'Adding…') : (editing ? 'Save Changes' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
