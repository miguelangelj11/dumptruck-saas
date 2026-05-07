'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { toast } from 'sonner'
import {
  Upload, Loader2, X, Check, Plus, Trash2, FileText,
  AlertTriangle, Bot, ArrowLeft, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 'upload' | 'review' | 'success'

type DocMeta = {
  document_type: string
  company_name: string
  broker_name: string
  report_date: string
  total_loads: number
  total_tons: number
  total_amount: number
}

type ReviewRow = {
  _id: string
  _include: boolean
  confidence: number
  needs_review: boolean
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

function makeReviewRow(raw: Record<string, unknown>, docMeta?: DocMeta): ReviewRow {
  const conf = Number(raw.confidence ?? 0.5)
  return {
    _id:              crypto.randomUUID(),
    _include:         true,
    confidence:       conf,
    needs_review:     Boolean(raw.needs_review) || conf < 0.8,
    date:             String(raw.date ?? new Date().toISOString().slice(0, 10)),
    truck_number:     raw.truck_number ? String(raw.truck_number) : '',
    driver_name:      raw.driver_name  ? String(raw.driver_name)  : '',
    job_name:         raw.job_name     ? String(raw.job_name)     : '',
    material:         raw.material     ? String(raw.material)     : '',
    loads:            raw.loads        != null ? String(raw.loads) : '',
    tons:             raw.tons         != null ? String(raw.tons)  : '',
    hours:            raw.hours        != null ? String(raw.hours) : '',
    rate:             raw.rate         != null ? String(raw.rate)  : '',
    rate_type:        String(raw.rate_type ?? 'per_load'),
    estimated_amount: raw.estimated_amount != null ? String(raw.estimated_amount) : '',
    shift:            raw.shift         ? String(raw.shift)         : '',
    ticket_number:    raw.ticket_number ? String(raw.ticket_number) : '',
    start_time:       raw.start_time    ? String(raw.start_time)    : '',
    end_time:         raw.end_time      ? String(raw.end_time)      : '',
    broker_name:      (raw.broker_name  ? String(raw.broker_name)  : '') || (docMeta?.broker_name ?? ''),
    project_number:   raw.project_number ? String(raw.project_number) : '',
    phase:            raw.phase         ? String(raw.phase)         : '',
  }
}

function makeEmptyRow(): ReviewRow {
  return makeReviewRow({})
}

const RATE_TYPE_LABELS: Record<string, string> = {
  per_load: '/load',
  per_hour: '/hr',
  per_ton:  '/ton',
}

// ── Cell input ─────────────────────────────────────────────────────────────

function Cell({
  value, onChange, type = 'text', placeholder = '',
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      type={type}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)] bg-white min-w-0"
    />
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ImportPage() {
  const supabase = createClient()

  const [step, setStep]         = useState<Step>('upload')
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [docMeta, setDocMeta]   = useState<DocMeta | null>(null)
  const [rows, setRows]         = useState<ReviewRow[]>([])
  const [rawExtraction, setRawExtraction] = useState<Record<string, unknown> | null>(null)

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; ids: string[] } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File handling ────────────────────────────────────────────────────────

  const processFile = useCallback(async (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast.error('File too large — max 10 MB'); return }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(f.type)) { toast.error('Unsupported file type — use PDF, JPG, or PNG'); return }

    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
    await runExtraction(f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }, [processFile])

  // ── AI Extraction ────────────────────────────────────────────────────────

  async function runExtraction(f: File) {
    setExtracting(true)
    try {
      const bytes  = await f.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const companyId = await getCompanyId()

      const res = await fetch('/api/ai/extract-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentBase64: base64, mimeType: f.type, companyId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'AI extraction failed — try again')
        setExtracting(false)
        return
      }

      const { data } = await res.json()

      const meta: DocMeta = {
        document_type: data.document_type ?? 'Document',
        company_name:  data.company_name  ?? '',
        broker_name:   data.broker_name   ?? '',
        report_date:   data.report_date   ?? '',
        total_loads:   Number(data.total_loads  ?? 0),
        total_tons:    Number(data.total_tons   ?? 0),
        total_amount:  Number(data.total_amount ?? 0),
      }

      setDocMeta(meta)
      setRawExtraction(data)
      setRows((data.rows as Record<string, unknown>[]).map(r => makeReviewRow(r, meta)))
      setStep('review')
    } catch (err) {
      console.error(err)
      toast.error('Extraction failed — check your connection and try again')
    } finally {
      setExtracting(false)
    }
  }

  // ── Row editing ───────────────────────────────────────────────────────────

  function updateRow(id: string, field: keyof ReviewRow, value: unknown) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r))
  }

  function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  function addRow() {
    setRows(prev => [...prev, makeEmptyRow()])
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter(r => r._include)
    if (toImport.length === 0) { toast.error('Select at least one row to import'); return }

    setImporting(true)

    let docUrl: string | undefined
    // Upload document to storage for record-keeping
    if (file) {
      const companyId = await getCompanyId()
      if (companyId) {
        const ext  = file.name.split('.').pop()
        const path = `documents/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('ticket-photos').upload(path, file, { upsert: false })
        if (!upErr) {
          docUrl = supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
        }
      }
    }

    const payload = toImport.map(r => ({
      date:             r.date,
      truck_number:     r.truck_number || null,
      driver_name:      r.driver_name,
      job_name:         r.job_name,
      material:         r.material || null,
      loads:            r.loads ? Number(r.loads) : null,
      tons:             r.tons  ? Number(r.tons)  : null,
      hours:            r.hours ? Number(r.hours) : null,
      rate:             r.rate  ? Number(r.rate)  : null,
      rate_type:        r.rate_type,
      estimated_amount: r.estimated_amount ? Number(r.estimated_amount) : null,
      shift:            r.shift || null,
      ticket_number:    r.ticket_number || null,
      start_time:       r.start_time || null,
      end_time:         r.end_time   || null,
      broker_name:      r.broker_name    || null,
      project_number:   r.project_number || null,
      phase:            r.phase          || null,
      confidence:       r.confidence,
    }))

    try {
      const res = await fetch('/api/tickets/bulk-import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rows:              payload,
          sourceDocumentUrl: docUrl,
          documentName:      file?.name ?? null,
          documentType:      docMeta?.document_type ?? null,
          rawExtraction:     rawExtraction,
        }),
      })

      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Import failed'); setImporting(false); return }

      setImportResult({ imported: data.imported, failed: data.failed?.length ?? 0, ids: data.ids })
      setStep('success')
    } catch {
      toast.error('Import failed — check your connection')
    } finally {
      setImporting(false)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const includedRows   = rows.filter(r => r._include)
  const needsReview    = rows.filter(r => r.needs_review && r._include).length
  const totalAmount    = includedRows.reduce((s, r) => s + (parseFloat(r.estimated_amount) || 0), 0)
  const uniqueDrivers  = [...new Set(includedRows.map(r => r.driver_name).filter(Boolean))]

  // ── Render: Upload step ──────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="p-6 md:p-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/dashboard/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Tickets
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Import Tickets from Document</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload a broker pay sheet, shift summary, or haul report — AI will extract all ticket data automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
              : extracting
              ? 'border-gray-200 bg-gray-50 cursor-default'
              : 'border-gray-300 hover:border-[var(--brand-primary)] hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {extracting ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Bot className="h-12 w-12 text-[var(--brand-primary)]" />
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)] absolute -bottom-1 -right-1" />
              </div>
              <p className="text-base font-semibold text-gray-700">Analyzing document with AI…</p>
              <p className="text-sm text-gray-400">Reading all ticket rows and extracting data</p>
            </div>
          ) : file && preview ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-32 w-48 rounded-lg overflow-hidden border border-gray-200">
                <Image src={preview} alt="Preview" fill className="object-contain" />
              </div>
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-700">Drop your document here or click to upload</p>
              <p className="text-sm text-gray-400 mt-1">PDF, JPG, PNG — up to 10 MB</p>
            </>
          )}
        </div>

        {/* Supported formats */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supported documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              'Broker pay sheets / settlement reports',
              'Daily shift summaries',
              'Asphalt haul reports',
              'Driver earnings sheets',
              'Load manifests',
              'End-of-day production reports',
            ].map(doc => (
              <div key={doc} className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                {doc}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
          <Bot className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Powered by Claude AI · Documents are processed securely and not stored for training</span>
        </div>
      </div>
    )
  }

  // ── Render: Review step ──────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <div className="p-6 md:p-8 max-w-[1400px]">
        {/* Header */}
        <div className="mb-5">
          <button
            onClick={() => { setStep('upload'); setRows([]); setDocMeta(null); setFile(null); setPreview(null) }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Upload different document
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Review Extracted Data</h1>
              {docMeta && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                  <span className="font-medium text-gray-600">{docMeta.document_type}</span>
                  {docMeta.broker_name && <span>· {docMeta.broker_name}</span>}
                  {docMeta.report_date && <span>· {docMeta.report_date}</span>}
                </div>
              )}
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-3 flex-wrap">
              {needsReview > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {needsReview} need review
                </div>
              )}
              <div className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{includedRows.length}</span> rows selected
                {totalAmount > 0 && <span> · <span className="font-semibold text-[var(--brand-primary)]">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> total</span>}
              </div>
              <button
                onClick={handleImport}
                disabled={importing || includedRows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {importing ? 'Importing…' : `Import ${includedRows.length} Ticket${includedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs text-gray-400 mb-3">
          Review each row below. Edit any cell directly, uncheck rows to skip them, or delete rows you don&apos;t need.
          Rows highlighted in amber have low confidence and should be verified.
        </p>

        {/* Review table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 1100 }}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5 text-left w-8">
                    <input
                      type="checkbox"
                      checked={rows.every(r => r._include)}
                      onChange={e => setRows(prev => prev.map(r => ({ ...r, _include: e.target.checked })))}
                      className="rounded"
                    />
                  </th>
                  {['Date', 'Driver', 'Truck #', 'Job', 'Material', 'Ticket #', 'Loads', 'Tons', 'Hrs', 'Rate', 'Type', 'Amount', 'Conf', ''].map(h => (
                    <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => (
                  <tr
                    key={row._id}
                    className={`transition-colors ${
                      !row._include ? 'opacity-40' :
                      row.needs_review ? 'bg-amber-50/70' :
                      'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={row._include}
                        onChange={e => updateRow(row._id, '_include', e.target.checked)}
                        className="rounded"
                      />
                    </td>

                    {/* Date */}
                    <td className="px-2 py-1.5" style={{ minWidth: 110 }}>
                      <Cell value={row.date} onChange={v => updateRow(row._id, 'date', v)} type="date" />
                    </td>

                    {/* Driver */}
                    <td className="px-2 py-1.5" style={{ minWidth: 130 }}>
                      <Cell value={row.driver_name} onChange={v => updateRow(row._id, 'driver_name', v)} placeholder="Driver name" />
                    </td>

                    {/* Truck # */}
                    <td className="px-2 py-1.5" style={{ minWidth: 80 }}>
                      <Cell value={row.truck_number} onChange={v => updateRow(row._id, 'truck_number', v)} placeholder="Truck #" />
                    </td>

                    {/* Job */}
                    <td className="px-2 py-1.5" style={{ minWidth: 150 }}>
                      <Cell value={row.job_name} onChange={v => updateRow(row._id, 'job_name', v)} placeholder="Job / site" />
                    </td>

                    {/* Material */}
                    <td className="px-2 py-1.5" style={{ minWidth: 100 }}>
                      <Cell value={row.material} onChange={v => updateRow(row._id, 'material', v)} placeholder="Material" />
                    </td>

                    {/* Ticket # */}
                    <td className="px-2 py-1.5" style={{ minWidth: 90 }}>
                      <Cell value={row.ticket_number} onChange={v => updateRow(row._id, 'ticket_number', v)} placeholder="Ticket #" />
                    </td>

                    {/* Loads */}
                    <td className="px-2 py-1.5" style={{ minWidth: 60 }}>
                      <Cell value={row.loads} onChange={v => updateRow(row._id, 'loads', v)} type="number" placeholder="0" />
                    </td>

                    {/* Tons */}
                    <td className="px-2 py-1.5" style={{ minWidth: 70 }}>
                      <Cell value={row.tons} onChange={v => updateRow(row._id, 'tons', v)} type="number" placeholder="0.00" />
                    </td>

                    {/* Hours */}
                    <td className="px-2 py-1.5" style={{ minWidth: 60 }}>
                      <Cell value={row.hours} onChange={v => updateRow(row._id, 'hours', v)} type="number" placeholder="0.0" />
                    </td>

                    {/* Rate */}
                    <td className="px-2 py-1.5" style={{ minWidth: 80 }}>
                      <Cell value={row.rate} onChange={v => updateRow(row._id, 'rate', v)} type="number" placeholder="0.00" />
                    </td>

                    {/* Rate type */}
                    <td className="px-2 py-1.5" style={{ minWidth: 80 }}>
                      <select
                        value={row.rate_type}
                        onChange={e => updateRow(row._id, 'rate_type', e.target.value)}
                        className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-[var(--brand-primary)] bg-white"
                      >
                        <option value="per_load">/load</option>
                        <option value="per_hour">/hr</option>
                        <option value="per_ton">/ton</option>
                      </select>
                    </td>

                    {/* Amount */}
                    <td className="px-2 py-1.5" style={{ minWidth: 90 }}>
                      <Cell value={row.estimated_amount} onChange={v => updateRow(row._id, 'estimated_amount', v)} type="number" placeholder="0.00" />
                    </td>

                    {/* Confidence badge */}
                    <td className="px-2 py-1.5">
                      {row.needs_review ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" /> Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-1.5 py-0.5 font-medium whitespace-nowrap">
                          <Check className="h-3 w-3" /> {Math.round(row.confidence * 100)}%
                        </span>
                      )}
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row + footer */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[var(--brand-primary)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
            {includedRows.length > 0 && (
              <span className="text-xs text-gray-500">
                {includedRows.length} of {rows.length} rows · ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Mobile import button */}
        <div className="mt-4 sm:hidden">
          <button
            onClick={handleImport}
            disabled={importing || includedRows.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {importing ? 'Importing…' : `Import ${includedRows.length} Ticket${includedRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Success step ─────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-lg">
      <div className="text-center py-8">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {importResult?.imported ?? 0} ticket{(importResult?.imported ?? 0) !== 1 ? 's' : ''} imported!
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          All tickets have been created as pending and are ready to approve.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-left">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Tickets</p>
            <p className="text-xl font-bold text-gray-900">{importResult?.imported ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">Drivers</p>
            <p className="text-xl font-bold text-gray-900">{uniqueDrivers.length}</p>
          </div>
          <div className="bg-[var(--brand-primary)]/5 rounded-xl p-3">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-lg font-bold text-[var(--brand-primary)]">
              ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {importResult?.failed ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {importResult.failed} row{importResult.failed !== 1 ? 's' : ''} failed to import — check the Tickets page for details.
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            View Tickets →
          </Link>
          <button
            onClick={() => { setStep('upload'); setRows([]); setDocMeta(null); setFile(null); setPreview(null); setImportResult(null) }}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Import Another Document
          </button>
        </div>
      </div>
    </div>
  )
}
