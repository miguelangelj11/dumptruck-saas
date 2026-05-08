'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, AlertTriangle, Download, LayoutGrid, List } from 'lucide-react'

// ── Exported types ────────────────────────────────────────────────────────

export type BillingDirection = 'paid_to_us' | 'billed_to_us'

export type ReviewRow = {
  _id: string
  _include: boolean
  confidence: number
  needs_review: boolean
  billing_direction: BillingDirection
  date: string
  truck_number: string
  driver_name: string
  job_name: string
  material: string
  loads: string
  tons: string
  hours: string
  rate: string
  rate_type: string
  estimated_amount: string
  shift: string
  ticket_number: string
  start_time: string
  end_time: string
  broker_name: string
  project_number: string
  phase: string
}

export type DocMeta = {
  document_type: string
  company_name: string
  broker_name: string
  report_date: string
  total_loads: number
  total_tons: number
  total_amount: number
}

export function makeReviewRow(
  raw: Record<string, unknown> = {},
  docMeta?: DocMeta,
  defaultBilling: BillingDirection = 'paid_to_us',
): ReviewRow {
  const conf = Number(raw.confidence ?? 0.5)
  return {
    _id:               crypto.randomUUID(),
    _include:          true,
    confidence:        conf,
    needs_review:      Boolean(raw.needs_review) || conf < 0.8,
    billing_direction: (raw.billing_direction as BillingDirection) ?? defaultBilling,
    date:              String(raw.date ?? new Date().toISOString().slice(0, 10)),
    truck_number:      raw.truck_number ? String(raw.truck_number) : '',
    driver_name:       raw.driver_name  ? String(raw.driver_name)  : '',
    job_name:          raw.job_name     ? String(raw.job_name)     : '',
    material:          raw.material     ? String(raw.material)     : '',
    loads:             raw.loads        != null ? String(raw.loads) : '',
    tons:              raw.tons         != null ? String(raw.tons)  : '',
    hours:             raw.hours        != null ? String(raw.hours) : '',
    rate:              raw.rate         != null ? String(raw.rate)  : '',
    rate_type:         String(raw.rate_type ?? 'per_load'),
    estimated_amount:  raw.estimated_amount != null ? String(raw.estimated_amount) : '',
    shift:             raw.shift          ? String(raw.shift)          : '',
    ticket_number:     raw.ticket_number  ? String(raw.ticket_number)  : '',
    start_time:        raw.start_time     ? String(raw.start_time)     : '',
    end_time:          raw.end_time       ? String(raw.end_time)       : '',
    broker_name:       (raw.broker_name   ? String(raw.broker_name)   : '') || (docMeta?.broker_name ?? ''),
    project_number:    raw.project_number ? String(raw.project_number) : '',
    phase:             raw.phase          ? String(raw.phase)          : '',
  }
}

// ── Props ─────────────────────────────────────────────────────────────────

type Props = {
  rows: ReviewRow[]
  onRowsChange: (rows: ReviewRow[]) => void
  docMeta: DocMeta | null
  importId: string
  filename: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function rowAccent(conf: number) {
  if (conf >= 0.85) return { border: 'border-l-green-400',  bg: '',             badge: 'bg-green-100 text-green-700'  }
  if (conf >= 0.60) return { border: 'border-l-amber-400',  bg: 'bg-amber-50/50', badge: 'bg-amber-100 text-amber-700'  }
  return              { border: 'border-l-red-400',    bg: 'bg-red-50/50',   badge: 'bg-red-100 text-red-700'      }
}

// Tiny always-visible text input
function TCell({
  value, onChange, type = 'text', placeholder = '', className = '',
}: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string
}) {
  return (
    <input
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
      className={`w-full min-w-0 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/20 ${className}`}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function ImportReviewTable({ rows, onRowsChange, docMeta, importId, filename }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')

  // ── Auto-save to localStorage ────────────────────────────────────────────
  useEffect(() => {
    if (rows.length > 0 && importId) {
      try {
        localStorage.setItem(`dtb_import_review_${importId}`, JSON.stringify(rows))
      } catch { /* quota exceeded — ignore */ }
    }
  }, [rows, importId])

  // ── Row operations ────────────────────────────────────────────────────────
  const updateRow = useCallback((id: string, field: keyof ReviewRow, value: unknown) => {
    onRowsChange(rows.map(r => r._id === id ? { ...r, [field]: value } : r))
  }, [rows, onRowsChange])

  const deleteRow = useCallback((id: string) => {
    onRowsChange(rows.filter(r => r._id !== id))
  }, [rows, onRowsChange])

  const addRow = useCallback(() => {
    const billing = rows[0]?.billing_direction ?? 'paid_to_us'
    onRowsChange([...rows, makeReviewRow({}, undefined, billing)])
  }, [rows, onRowsChange])

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const toggleAll = (checked: boolean) => onRowsChange(rows.map(r => ({ ...r, _include: checked })))

  const selectHighConfidence = () => onRowsChange(rows.map(r => ({ ...r, _include: r.confidence >= 0.85 })))

  const deleteSelected = () => onRowsChange(rows.filter(r => !r._include))

  const exportCSV = () => {
    const headers = ['Date','Driver','Truck #','Job','Material','Ticket #','Jobs','Tons','Hours','Start','End','Rate','Rate Type','Amount','Billing','Confidence']
    const body = rows
      .filter(r => r._include)
      .map(r => [r.date,r.driver_name,r.truck_number,r.job_name,r.material,r.ticket_number,r.loads,r.tons,r.hours,r.start_time,r.end_time,r.rate,r.rate_type,r.estimated_amount,r.billing_direction,r.confidence].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','))
    const csv  = [headers.join(','), ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `import-${Date.now()}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const included      = rows.filter(r => r._include)
  const totalLoads    = included.reduce((s, r) => s + (parseFloat(r.loads)  || 0), 0)
  const totalTons     = included.reduce((s, r) => s + (parseFloat(r.tons)   || 0), 0)
  const paidToUs      = included.filter(r => r.billing_direction === 'paid_to_us').reduce((s, r) => s + (parseFloat(r.estimated_amount) || 0), 0)
  const billedToUs    = included.filter(r => r.billing_direction === 'billed_to_us').reduce((s, r) => s + (parseFloat(r.estimated_amount) || 0), 0)
  const highConf      = rows.filter(r => r.confidence >= 0.85).length
  const medConf       = rows.filter(r => r.confidence >= 0.6 && r.confidence < 0.85).length
  const lowConf       = rows.filter(r => r.confidence < 0.6).length
  const allChecked    = rows.length > 0 && rows.every(r => r._include)
  const someChecked   = rows.some(r => r._include)
  const missingFields = included.filter(r => !r.date || (!r.driver_name && !r.truck_number) || !r.estimated_amount)

  return (
    <div>
      {/* ── Document metadata panel ────────────────────────────────────── */}
      {docMeta && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{docMeta.document_type}</span>
                {filename && <span className="text-xs text-gray-400">· {filename}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                {docMeta.company_name && <span className="font-medium">{docMeta.company_name}</span>}
                {docMeta.broker_name  && <span className="text-gray-400">· {docMeta.broker_name}</span>}
                {docMeta.report_date  && <span className="text-gray-400">· {docMeta.report_date}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">AI extracted {rows.length} rows from this document</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-700 bg-green-100 rounded-full px-2.5 py-1 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {highConf} high
              </span>
              {medConf > 0 && (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-100 rounded-full px-2.5 py-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {medConf} medium
                </span>
              )}
              {lowConf > 0 && (
                <span className="flex items-center gap-1 text-red-700 bg-red-100 rounded-full px-2.5 py-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {lowConf} low
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Summary stats bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Selected Rows</p>
          <p className="text-2xl font-bold text-gray-900">{included.length}</p>
        </div>
        {totalLoads > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total Jobs</p>
            <p className="text-2xl font-bold text-gray-900">{totalLoads}</p>
          </div>
        )}
        {totalTons > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total Tons</p>
            <p className="text-2xl font-bold text-gray-900">{totalTons.toFixed(2)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-green-600 mb-0.5">Paid To Us</p>
          <p className="text-2xl font-bold text-green-600">${fmt(paidToUs)}</p>
        </div>
        {billedToUs > 0 && (
          <div>
            <p className="text-xs text-red-500 mb-0.5">Billed To Us</p>
            <p className="text-2xl font-bold text-red-500">${fmt(billedToUs)}</p>
          </div>
        )}
      </div>

      {/* ── Validation warning ────────────────────────────────────────────── */}
      {missingFields.length > 0 && (
        <div className="flex items-center gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{missingFields.length} row{missingFields.length !== 1 ? 's are' : ' is'} missing required fields</strong> (date, driver or truck, amount) — review before importing.
          </span>
        </div>
      )}

      {/* ── Bulk actions toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => toggleAll(!allChecked)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {allChecked ? 'Deselect All' : 'Select All'}
        </button>
        <button
          onClick={selectHighConfidence}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
        >
          <Check className="h-3 w-3" /> High Confidence Only
        </button>
        {someChecked && (
          <button
            onClick={deleteSelected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Delete Selected
          </button>
        )}
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3 w-3" /> Export CSV
        </button>
        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            title="Table view"
            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            title="Card view"
            className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'card' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Table view ───────────────────────────────────────────────────── */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto -mx-0">
            <table className="w-full text-xs" style={{ minWidth: 1280 }}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={e => toggleAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-1 py-2.5 w-16 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Conf</th>
                  {['Date','Driver','Truck #','Job','Material','Ticket #','Jobs','Tons','Hrs','Rate','Type','Amount','Billing'].map(h => (
                    <th key={h} className="px-1 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-2 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => {
                  const { border, bg, badge } = rowAccent(row.confidence)
                  return (
                    <tr
                      key={row._id}
                      className={`border-l-2 transition-colors ${border} ${bg} ${!row._include ? 'opacity-40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="pl-4 pr-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={row._include}
                          onChange={e => updateRow(row._id, '_include', e.target.checked)}
                          className="rounded"
                        />
                      </td>

                      {/* Confidence badge */}
                      <td className="px-1 py-1.5">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badge}`}>
                          {row.confidence >= 0.85 ? '✓' : row.confidence >= 0.6 ? '!' : '✗'}
                          {' '}{Math.round(row.confidence * 100)}%
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-1 py-1.5" style={{ minWidth: 110 }}>
                        <TCell value={row.date} onChange={v => updateRow(row._id, 'date', v)} type="date" />
                      </td>

                      {/* Driver */}
                      <td className="px-1 py-1.5" style={{ minWidth: 120 }}>
                        <TCell value={row.driver_name} onChange={v => updateRow(row._id, 'driver_name', v)} placeholder="Driver" />
                      </td>

                      {/* Truck # */}
                      <td className="px-1 py-1.5" style={{ minWidth: 76 }}>
                        <TCell value={row.truck_number} onChange={v => updateRow(row._id, 'truck_number', v)} placeholder="T-00" />
                      </td>

                      {/* Job */}
                      <td className="px-1 py-1.5" style={{ minWidth: 140 }}>
                        <TCell value={row.job_name} onChange={v => updateRow(row._id, 'job_name', v)} placeholder="Job / site" />
                      </td>

                      {/* Material */}
                      <td className="px-1 py-1.5" style={{ minWidth: 90 }}>
                        <TCell value={row.material} onChange={v => updateRow(row._id, 'material', v)} placeholder="Material" />
                      </td>

                      {/* Ticket # */}
                      <td className="px-1 py-1.5" style={{ minWidth: 84 }}>
                        <TCell value={row.ticket_number} onChange={v => updateRow(row._id, 'ticket_number', v)} placeholder="Ticket #" />
                      </td>

                      {/* Loads */}
                      <td className="px-1 py-1.5" style={{ minWidth: 56 }}>
                        <TCell value={row.loads} onChange={v => updateRow(row._id, 'loads', v)} type="number" placeholder="0" />
                      </td>

                      {/* Tons */}
                      <td className="px-1 py-1.5" style={{ minWidth: 66 }}>
                        <TCell value={row.tons} onChange={v => updateRow(row._id, 'tons', v)} type="number" placeholder="0.00" />
                      </td>

                      {/* Hours */}
                      <td className="px-1 py-1.5" style={{ minWidth: 56 }}>
                        <TCell value={row.hours} onChange={v => updateRow(row._id, 'hours', v)} type="number" placeholder="0.0" />
                      </td>

                      {/* Rate */}
                      <td className="px-1 py-1.5" style={{ minWidth: 76 }}>
                        <TCell value={row.rate} onChange={v => updateRow(row._id, 'rate', v)} type="number" placeholder="0.00" />
                      </td>

                      {/* Rate type */}
                      <td className="px-1 py-1.5" style={{ minWidth: 74 }}>
                        <select
                          value={row.rate_type}
                          onChange={e => updateRow(row._id, 'rate_type', e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-[var(--brand-primary)]"
                        >
                          <option value="per_load">/job</option>
                          <option value="per_hour">/hr</option>
                          <option value="per_ton">/ton</option>
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="px-1 py-1.5" style={{ minWidth: 84 }}>
                        <TCell value={row.estimated_amount} onChange={v => updateRow(row._id, 'estimated_amount', v)} type="number" placeholder="0.00" />
                      </td>

                      {/* Billing direction */}
                      <td className="px-1 py-1.5" style={{ minWidth: 110 }}>
                        <select
                          value={row.billing_direction}
                          onChange={e => updateRow(row._id, 'billing_direction', e.target.value as BillingDirection)}
                          className={`w-full border rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-[var(--brand-primary)] ${
                            row.billing_direction === 'paid_to_us'
                              ? 'border-green-300 text-green-700'
                              : 'border-red-300 text-red-600'
                          }`}
                        >
                          <option value="paid_to_us">💰 Paid to Us</option>
                          <option value="billed_to_us">📤 Billed to Us</option>
                        </select>
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => deleteRow(row._id)}
                          className="h-6 w-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Add row + row count footer */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[var(--brand-primary)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row Manually
            </button>
            <span className="text-xs text-gray-400">{included.length} of {rows.length} rows selected</span>
          </div>
        </div>
      ) : (
        /* ── Card view ─────────────────────────────────────────────────── */
        <div className="space-y-3">
          {rows.map(row => {
            const { border, bg, badge } = rowAccent(row.confidence)
            return (
              <div
                key={row._id}
                className={`bg-white rounded-xl border border-gray-100 border-l-4 p-4 ${border} ${bg} ${!row._include ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row._include}
                      onChange={e => updateRow(row._id, '_include', e.target.checked)}
                      className="rounded"
                    />
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                      {Math.round(row.confidence * 100)}% confidence
                    </span>
                    <select
                      value={row.billing_direction}
                      onChange={e => updateRow(row._id, 'billing_direction', e.target.value as BillingDirection)}
                      className={`border rounded px-2 py-0.5 text-[10px] bg-white ${row.billing_direction === 'paid_to_us' ? 'border-green-300 text-green-700' : 'border-red-300 text-red-600'}`}
                    >
                      <option value="paid_to_us">💰 Paid to Us</option>
                      <option value="billed_to_us">📤 Billed to Us</option>
                    </select>
                  </div>
                  <button onClick={() => deleteRow(row._id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Date</p>
                    <input type="date" value={row.date} onChange={e => updateRow(row._id, 'date', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Driver</p>
                    <input value={row.driver_name} onChange={e => updateRow(row._id, 'driver_name', e.target.value)}
                      placeholder="Driver name"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Truck #</p>
                    <input value={row.truck_number} onChange={e => updateRow(row._id, 'truck_number', e.target.value)}
                      placeholder="Truck #"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">Job Name</p>
                    <input value={row.job_name} onChange={e => updateRow(row._id, 'job_name', e.target.value)}
                      placeholder="Job / site name"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Material</p>
                    <input value={row.material} onChange={e => updateRow(row._id, 'material', e.target.value)}
                      placeholder="Material"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Ticket #</p>
                    <input value={row.ticket_number} onChange={e => updateRow(row._id, 'ticket_number', e.target.value)}
                      placeholder="Ticket #"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Rate</p>
                    <div className="flex gap-1">
                      <input type="number" value={row.rate} onChange={e => updateRow(row._id, 'rate', e.target.value)}
                        placeholder="0.00"
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)]" />
                      <select value={row.rate_type} onChange={e => updateRow(row._id, 'rate_type', e.target.value)}
                        className="border border-gray-200 rounded px-1 py-1 text-xs bg-white focus:outline-none">
                        <option value="per_load">/load</option>
                        <option value="per_hour">/hr</option>
                        <option value="per_ton">/ton</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Amount</p>
                    <input type="number" value={row.estimated_amount} onChange={e => updateRow(row._id, 'estimated_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-[var(--brand-primary)]" />
                  </div>
                </div>
              </div>
            )
          })}
          <button
            onClick={addRow}
            className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Row Manually
          </button>
        </div>
      )}
    </div>
  )
}
