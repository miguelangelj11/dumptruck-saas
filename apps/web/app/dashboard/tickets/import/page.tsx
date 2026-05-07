'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { toast } from 'sonner'
import { Upload, Loader2, Check, FileText, Bot, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ImportReviewTable, {
  type ReviewRow,
  type DocMeta,
  type BillingDirection,
  makeReviewRow,
} from '@/components/tickets/ImportReviewTable'

type Step = 'upload' | 'review' | 'success'

type ImportResult = {
  paid_to_us:   { count: number; total: number }
  billed_to_us: { count: number; total: number }
  total_imported: number
  failed: number
}

export default function ImportPage() {
  const supabase = createClient()

  const [step, setStep]               = useState<Step>('upload')
  const [file, setFile]               = useState<File | null>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [extracting, setExtracting]   = useState(false)

  const [docMeta, setDocMeta]         = useState<DocMeta | null>(null)
  const [rows, setRows]               = useState<ReviewRow[]>([])
  const [rawExtraction, setRawExtraction] = useState<Record<string, unknown> | null>(null)
  const [importId]                    = useState(() => crypto.randomUUID())

  const [billingDirection, setBillingDirection] = useState<BillingDirection>('paid_to_us')

  const [importing, setImporting]     = useState(false)
  const [result, setResult]           = useState<ImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Restore saved review from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`dtb_import_review_${importId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ReviewRow[]
        if (parsed.length > 0) { setRows(parsed); setStep('review') }
      } catch { /* ignore */ }
    }
  }, [importId])

  // When global billing direction changes, update all rows
  const handleBillingDirectionChange = (dir: BillingDirection) => {
    setBillingDirection(dir)
    setRows(prev => prev.map(r => ({ ...r, billing_direction: dir })))
  }

  // ── File handling ──────────────────────────────────────────────────────

  const processFile = useCallback(async (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast.error('File too large — max 10 MB'); return }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(f.type)) { toast.error('Unsupported file type — use PDF, JPG, or PNG'); return }
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    await runExtraction(f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  // ── AI Extraction ──────────────────────────────────────────────────────

  async function runExtraction(f: File) {
    setExtracting(true)
    try {
      // Use FileReader (browser-native) — Buffer is Node-only and not reliably polyfilled
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // result = "data:<mime>;base64,<data>" — strip the prefix
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(f)
      })

      if (!base64) { toast.error('Could not read file — try again'); setExtracting(false); return }

      // Detect MIME type; fallback to extension if browser leaves it empty
      const mimeType = f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      const companyId = await getCompanyId()

      const res = await fetch('/api/ai/extract-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentBase64: base64, mimeType, companyId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; details?: string }
        const msg = err.error ?? 'AI extraction failed'
        const detail = err.details ? ` — ${err.details}` : ''
        toast.error(msg + detail, { duration: 6000 })
        setExtracting(false)
        return
      }

      const { data } = await res.json() as { data: Record<string, unknown> }
      const meta: DocMeta = {
        document_type: String(data.document_type ?? 'Document'),
        company_name:  String(data.company_name  ?? ''),
        broker_name:   String(data.broker_name   ?? ''),
        report_date:   String(data.report_date   ?? ''),
        total_loads:   Number(data.total_loads   ?? 0),
        total_tons:    Number(data.total_tons    ?? 0),
        total_amount:  Number(data.total_amount  ?? 0),
      }
      setDocMeta(meta)
      setRawExtraction(data)
      setRows((data.rows as Record<string, unknown>[]).map(r => makeReviewRow(r, meta, billingDirection)))
      setStep('review')
    } catch (err) {
      console.error(err)
      toast.error('Extraction failed — check your connection and try again')
    } finally {
      setExtracting(false)
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter(r => r._include)
    if (toImport.length === 0) { toast.error('Select at least one row to import'); return }

    setImporting(true)

    let docUrl: string | undefined
    if (file) {
      const companyId = await getCompanyId()
      if (companyId) {
        const ext  = file.name.split('.').pop() ?? 'bin'
        const path = `documents/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('ticket-photos').upload(path, file, { upsert: false })
        if (!upErr) docUrl = supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl
      }
    }

    const payload = toImport.map(r => ({
      date:              r.date,
      truck_number:      r.truck_number      || null,
      driver_name:       r.driver_name,
      job_name:          r.job_name,
      material:          r.material          || null,
      loads:             r.loads             ? Number(r.loads)             : null,
      tons:              r.tons              ? Number(r.tons)              : null,
      hours:             r.hours             ? Number(r.hours)             : null,
      rate:              r.rate              ? Number(r.rate)              : null,
      rate_type:         r.rate_type,
      estimated_amount:  r.estimated_amount  ? Number(r.estimated_amount)  : null,
      shift:             r.shift             || null,
      ticket_number:     r.ticket_number     || null,
      start_time:        r.start_time        || null,
      end_time:          r.end_time          || null,
      broker_name:       r.broker_name       || null,
      project_number:    r.project_number    || null,
      phase:             r.phase             || null,
      confidence:        r.confidence,
      billing_direction: r.billing_direction,
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
          rawExtraction,
        }),
      })

      const data = await res.json() as {
        error?: string
        paid_to_us?:   { count: number; total: number }
        billed_to_us?: { count: number; total: number }
        total_imported?: number
        failed?: unknown[]
        // legacy shape
        imported?: number
      }

      if (!res.ok) { toast.error(data.error ?? 'Import failed'); setImporting(false); return }

      setResult({
        paid_to_us:   data.paid_to_us   ?? { count: data.imported ?? 0, total: 0 },
        billed_to_us: data.billed_to_us ?? { count: 0, total: 0 },
        total_imported: data.total_imported ?? data.imported ?? 0,
        failed: data.failed?.length ?? 0,
      })

      // Clear localStorage on success
      localStorage.removeItem(`dtb_import_review_${importId}`)
      setStep('success')
    } catch {
      toast.error('Import failed — check your connection')
    } finally {
      setImporting(false)
    }
  }

  // ── Included row stats for the import button label ─────────────────────
  const includedRows = rows.filter(r => r._include)

  // ────────────────────────────────────────────────────────────────────────
  // STEP: UPLOAD
  // ────────────────────────────────────────────────────────────────────────

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
            isDragging   ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' :
            extracting   ? 'border-gray-200 bg-gray-50 cursor-default' :
            'border-gray-300 hover:border-[var(--brand-primary)] hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
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

  // ────────────────────────────────────────────────────────────────────────
  // STEP: REVIEW
  // ────────────────────────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <div className="p-6 md:p-8 max-w-[1440px]">

        {/* Back + header */}
        <div className="mb-5">
          <button
            onClick={() => { setStep('upload'); setRows([]); setDocMeta(null); setFile(null); setPreview(null) }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Upload different document
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900">Review &amp; Import</h1>
            <button
              onClick={handleImport}
              disabled={importing || includedRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {importing ? 'Importing…' : `Import ${includedRows.length} Ticket${includedRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* ── Billing direction selector ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleBillingDirectionChange('paid_to_us')}
            className={`p-5 rounded-xl border-2 text-left transition-all ${
              billingDirection === 'paid_to_us'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💰</span>
              <span className={`font-bold text-lg ${billingDirection === 'paid_to_us' ? 'text-green-700' : 'text-gray-700'}`}>
                Paid To Us
              </span>
              {billingDirection === 'paid_to_us' && (
                <span className="ml-auto h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              We hauled for a broker or client and they owe us money. Creates income tickets for invoicing.
            </p>
            <p className="text-xs text-green-600 font-semibold mt-2">→ Goes to Revenue &amp; Client Invoicing</p>
          </button>

          <button
            onClick={() => handleBillingDirectionChange('billed_to_us')}
            className={`p-5 rounded-xl border-2 text-left transition-all ${
              billingDirection === 'billed_to_us'
                ? 'border-red-400 bg-red-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📤</span>
              <span className={`font-bold text-lg ${billingDirection === 'billed_to_us' ? 'text-red-600' : 'text-gray-700'}`}>
                Billed To Us
              </span>
              {billingDirection === 'billed_to_us' && (
                <span className="ml-auto h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              A subcontractor hauled for us and we owe them money. Creates expense records for payment.
            </p>
            <p className="text-xs text-red-500 font-semibold mt-2">→ Goes to Subcontractor Invoicing &amp; Expenses</p>
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          You can override billing direction per row using the dropdown in each row.
          Changing the selector above updates all rows at once.
        </p>

        {/* Review table */}
        <ImportReviewTable
          rows={rows}
          onRowsChange={setRows}
          docMeta={docMeta}
          importId={importId}
          filename={file?.name ?? null}
        />

        {/* Sticky mobile import button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 sm:hidden z-40">
          <button
            onClick={handleImport}
            disabled={importing || includedRows.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {importing ? 'Importing…' : `Import ${includedRows.length} Ticket${includedRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP: SUCCESS
  // ────────────────────────────────────────────────────────────────────────

  const paidToUsTotal   = rows.filter(r => r.billing_direction === 'paid_to_us').reduce((s, r) => s + (parseFloat(r.estimated_amount) || 0), 0)
  const billedToUsTotal = rows.filter(r => r.billing_direction === 'billed_to_us').reduce((s, r) => s + (parseFloat(r.estimated_amount) || 0), 0)

  return (
    <div className="p-6 md:p-8 max-w-lg">
      <div className="text-center py-8">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {result?.total_imported ?? 0} ticket{(result?.total_imported ?? 0) !== 1 ? 's' : ''} imported!
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          All tickets have been created as pending and are ready to review.
        </p>

        {/* Split summary */}
        {((result?.paid_to_us.count ?? 0) > 0 || (result?.billed_to_us.count ?? 0) > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4 text-left">
            {(result?.paid_to_us.count ?? 0) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs text-green-600 font-semibold mb-1">💰 Income Tickets</p>
                <p className="text-2xl font-bold text-green-700">{result?.paid_to_us.count}</p>
                <p className="text-xs text-green-600 mt-1">${paidToUsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            )}
            {(result?.billed_to_us.count ?? 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs text-red-500 font-semibold mb-1">📤 Expense Records</p>
                <p className="text-2xl font-bold text-red-600">{result?.billed_to_us.count}</p>
                <p className="text-xs text-red-500 mt-1">${billedToUsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            )}
          </div>
        )}

        {result && result.failed > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {result.failed} row{result.failed !== 1 ? 's' : ''} failed to import.
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            View Income Tickets →
          </Link>
          {(result?.billed_to_us.count ?? 0) > 0 && (
            <Link
              href="/dashboard/contractors"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              View Subcontractor Tickets →
            </Link>
          )}
          <button
            onClick={() => { setStep('upload'); setRows([]); setDocMeta(null); setFile(null); setPreview(null); setResult(null) }}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Import Another Document
          </button>
        </div>
      </div>
    </div>
  )
}
