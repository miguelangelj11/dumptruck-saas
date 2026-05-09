'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import { toast } from 'sonner'
import { Shield, Download, RefreshCw, Upload, Loader2, Database, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

type BackupFile = {
  name: string
  date: string
  size: number | null
  path: string
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m!) - 1]} ${parseInt(d!)}, ${y}`
}

export default function BackupsPage() {
  const [authorized,    setAuthorized]    = useState<boolean | null>(null)
  const [backups,       setBackups]       = useState<BackupFile[]>([])
  const [loading,       setLoading]       = useState(true)
  const [triggering,    setTriggering]    = useState(false)
  const [downloading,   setDownloading]   = useState<string | null>(null)
  const [restoring,     setRestoring]     = useState(false)
  const [restoreResult, setRestoreResult] = useState<{ inserted: Record<string, number> } | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthorized(false); setLoading(false); return }

      const cid = await getCompanyId()
      if (!cid) { setAuthorized(false); setLoading(false); return }

      const { data: co } = await supabase
        .from('companies')
        .select('is_super_admin, subscription_override')
        .eq('id', cid)
        .maybeSingle()

      if (!co?.is_super_admin) { setAuthorized(false); setLoading(false); return }
      setAuthorized(true)
      await loadBackups()
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadBackups() {
    setLoading(true)
    const res = await fetch('/api/backups')
    const data = await res.json()
    if (res.ok) setBackups(data.backups ?? [])
    else toast.error(data.error ?? 'Failed to load backups')
    setLoading(false)
  }

  async function handleTrigger() {
    setTriggering(true)
    const res = await fetch('/api/backups/trigger', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast.success('Backup created successfully')
      await loadBackups()
    } else {
      toast.error(data.error ?? 'Backup failed')
    }
    setTriggering(false)
  }

  async function handleDownload(backup: BackupFile) {
    setDownloading(backup.path)
    const res = await fetch(`/api/backups/download?path=${encodeURIComponent(backup.path)}`)
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Download failed')
      setDownloading(null)
      return
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = backup.name
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(null)
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!confirm(`Restore from "${file.name}"? This will re-insert any records that are missing from your account. Existing records will NOT be overwritten.`)) return

    setRestoring(true)
    setRestoreResult(null)

    const text = await file.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { toast.error('Invalid backup file'); setRestoring(false); return }

    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: parsed }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Restore completed')
      setRestoreResult(data)
    } else {
      toast.error(data.error ?? 'Restore failed')
    }
    setRestoring(false)
  }

  if (authorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Access Restricted</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          This page is only accessible to the account owner.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
            <Database className="h-5 w-5 text-[var(--brand-primary)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Data Backups</h1>
            <p className="text-xs text-gray-400">Encrypted · Owner-only · Permanent retention</p>
          </div>
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60 transition-colors"
        >
          {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {triggering ? 'Backing up…' : 'Back Up Now'}
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
        <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold">Automatic daily backups at midnight</p>
          <p className="text-xs text-blue-600 mt-0.5">All data is stored in a private, encrypted storage bucket. Only you (the account owner) can access or download these files. Backups include tickets, invoices, drivers, dispatches, expenses, and client companies. Each backup is a complete snapshot — backups are kept permanently and never auto-deleted.</p>
        </div>
      </div>

      {/* Backup list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-900">Available Backups</h2>
          <button onClick={loadBackups} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No backups yet</p>
            <p className="text-xs text-gray-300 mt-0.5">Click "Back Up Now" to create your first backup, or wait for tonight's automatic backup</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {backups.map(b => (
              <li key={b.path} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fmtDate(b.date)}</p>
                    <p className="text-xs text-gray-400">{fmtBytes(b.size)} · {b.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(b)}
                  disabled={downloading === b.path}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {downloading === b.path
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Restore section */}
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-sm text-gray-900">Restore from Backup</h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Upload a previously downloaded backup file. Missing records will be re-inserted. Existing records will <strong>not</strong> be overwritten — this is safe to run at any time.
          </p>
          <label className={`inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-200 px-4 py-3 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors ${restoring ? 'opacity-50 pointer-events-none' : ''}`}>
            {restoring
              ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              : <Upload className="h-4 w-4 text-amber-500" />}
            <span className="text-sm font-medium text-amber-700">
              {restoring ? 'Restoring…' : 'Choose backup file (.json)'}
            </span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} disabled={restoring} />
          </label>

          {restoreResult && (
            <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-sm font-semibold text-green-700 mb-1">Restore complete</p>
              <ul className="text-xs text-green-600 space-y-0.5">
                {Object.entries(restoreResult.inserted).map(([table, count]) => (
                  <li key={table}>{table}: {count} record{count !== 1 ? 's' : ''} restored</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
