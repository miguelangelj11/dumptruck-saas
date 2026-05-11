'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  FolderOpen, Search, LayoutGrid, List, X, ExternalLink,
  FileText, Image as ImageIcon, Bot, Receipt, Truck,
  RefreshCw, Download, Upload, Plus, Folder, FolderPlus,
  Trash2, MoreHorizontal, FolderInput, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCompanyId } from '@/lib/get-company-id'
import LockedFeature from '@/components/dashboard/locked-feature'

type Category = 'all' | 'ai_import' | 'ticket_photo' | 'subcontractor_photo' | 'received_invoice' | 'uploaded'

type DocumentItem = {
  id: string
  category: Exclude<Category, 'all'>
  name: string
  url: string
  mime: string
  job_name: string | null
  created_at: string
  meta: Record<string, unknown>
}

type DocFolder = {
  id: string
  name: string
  color: string
  count: number
}

type ViewMode = 'grid' | 'list'

const CATEGORY_TABS: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: 'all',                 label: 'All',             icon: FolderOpen  },
  { id: 'ai_import',           label: 'AI Imports',      icon: Bot         },
  { id: 'ticket_photo',        label: 'Ticket Photos',   icon: Truck       },
  { id: 'subcontractor_photo', label: 'Sub Photos',      icon: ImageIcon   },
  { id: 'received_invoice',    label: 'Received Inv.',   icon: Receipt     },
  { id: 'uploaded',            label: 'Uploaded',        icon: Upload      },
]

const CATEGORY_BADGE: Record<Category, string> = {
  all:                 'bg-gray-100 text-gray-700',
  ai_import:           'bg-violet-100 text-violet-700',
  ticket_photo:        'bg-blue-100 text-blue-700',
  subcontractor_photo: 'bg-orange-100 text-orange-700',
  received_invoice:    'bg-green-100 text-green-700',
  uploaded:            'bg-teal-100 text-teal-700',
}

const CATEGORY_LABEL: Record<Category, string> = {
  all:                 'All',
  ai_import:           'AI Import',
  ticket_photo:        'Ticket Photo',
  subcontractor_photo: 'Sub Photo',
  received_invoice:    'Invoice',
  uploaded:            'Uploaded',
}

const FOLDER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#8b5cf6', '#f97316', '#06b6d4',
]

function isImage(doc: DocumentItem) {
  return doc.mime.startsWith('image') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(doc.url)
}

function isPdf(doc: DocumentItem) {
  return doc.mime === 'application/pdf' || /\.pdf$/i.test(doc.url)
}

function DocIcon({ doc, size = 24 }: { doc: DocumentItem; size?: number }) {
  if (isImage(doc)) return <ImageIcon className="text-blue-400" style={{ width: size, height: size }} />
  if (isPdf(doc))   return <FileText  className="text-red-400"  style={{ width: size, height: size }} />
  return <FileText className="text-gray-400" style={{ width: size, height: size }} />
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type PreviewModal = { doc: DocumentItem; loaded: boolean }

export default function DocumentsPage() {
  const [planLocked, setPlanLocked] = useState<null | { plan: string; price: number }>(null)
  const [docs, setDocs]             = useState<DocumentItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [category, setCategory]     = useState<Category>('all')
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState<ViewMode>('grid')
  const [preview, setPreview]       = useState<PreviewModal | null>(null)

  // Upload state
  const [uploadOpen, setUploadOpen]   = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [uploadName, setUploadName]   = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Folder state
  const [folders, setFolders]               = useState<DocFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen]   = useState(false)
  const [newFolderName, setNewFolderName]   = useState('')
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderMenuDoc, setFolderMenuDoc]   = useState<string | null>(null) // doc.id with open menu
  const [movingDoc, setMovingDoc]           = useState<string | null>(null)  // doc.id being moved

  useEffect(() => {
    const supaClient = createClient()
    getCompanyId().then(async id => {
      if (!id) return
      const { data } = await supaClient.from('companies').select('plan, is_super_admin, subscription_override').eq('id', id).maybeSingle()
      if (data?.is_super_admin || data?.subscription_override) return
      const p = (data?.plan as string | null) ?? 'owner_operator'
      if (p === 'solo' || p === 'owner_operator') setPlanLocked({ plan: 'Fleet', price: 200 })
    })
  }, [])

  const fetchFolders = useCallback(async () => {
    const res  = await fetch('/api/documents/folders')
    const json = await res.json()
    setFolders(json.folders ?? [])
  }, [])

  useEffect(() => { fetchFolders() }, [fetchFolders])

  const fetchDocs = useCallback(async (cat: Category, q: string, folderId: string | null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ category: cat })
      if (q)        params.set('search', q)
      if (folderId) params.set('folder_id', folderId)
      const res  = await fetch(`/api/documents?${params}`)
      const json = await res.json()
      setDocs(json.docs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchDocs(category, search, activeFolderId), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [category, search, activeFolderId, fetchDocs])

  const counts = docs.reduce<Record<Category, number>>((acc, d) => {
    acc.all++
    acc[d.category] = (acc[d.category] ?? 0) + 1
    return acc
  }, { all: 0, ai_import: 0, ticket_photo: 0, subcontractor_photo: 0, received_invoice: 0, uploaded: 0 })

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('name', uploadName || uploadFile.name)
      if (uploadNotes) fd.append('notes', uploadNotes)
      const res = await fetch('/api/documents', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      setUploadOpen(false)
      setUploadFile(null)
      setUploadName('')
      setUploadNotes('')
      fetchDocs(category, search, activeFolderId)
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const res  = await fetch('/api/documents/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), color: newFolderColor }),
      })
      const json = await res.json()
      if (json.folder) {
        setFolders(f => [...f, json.folder])
        setNewFolderOpen(false)
        setNewFolderName('')
        setNewFolderColor(FOLDER_COLORS[0])
      }
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleDeleteFolder(id: string) {
    await fetch(`/api/documents/folders/${id}`, { method: 'DELETE' })
    setFolders(f => f.filter(x => x.id !== id))
    if (activeFolderId === id) setActiveFolderId(null)
  }

  async function handleMoveToFolder(docId: string, folderId: string) {
    setMovingDoc(docId)
    setFolderMenuDoc(null)
    try {
      await fetch(`/api/documents/folders/${folderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ref: docId, action: 'add' }),
      })
      await fetchFolders()
      if (activeFolderId) fetchDocs(category, search, activeFolderId)
    } finally {
      setMovingDoc(null)
    }
  }

  async function handleRemoveFromFolder(docId: string, folderId: string) {
    setMovingDoc(docId)
    setFolderMenuDoc(null)
    try {
      await fetch(`/api/documents/folders/${folderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ref: docId, action: 'remove' }),
      })
      await fetchFolders()
      fetchDocs(category, search, activeFolderId)
    } finally {
      setMovingDoc(null)
    }
  }

  if (planLocked) {
    return <LockedFeature title="Documents Hub" description="All your AI-imported tickets, ticket photos, subcontractor photos, and received invoices in one place. Includes AI document reader." plan={planLocked.plan} price={planLocked.price} />
  }

  const activeFolder = folders.find(f => f.id === activeFolderId)

  return (
    <div className="p-6 md:p-8 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-[var(--brand-primary)]" />
            Documents
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">All files uploaded or generated in your account</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </button>
          <button
            onClick={() => fetchDocs(category, search, activeFolderId)}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-lg border transition-colors ${view === 'grid' ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg border transition-colors ${view === 'list' ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">

        {/* ── Folders Sidebar ───────────────────────────────────────────── */}
        <aside className="w-52 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Folders</span>
              <button
                onClick={() => setNewFolderOpen(true)}
                className="p-1 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                title="New folder"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>

            <div className="py-1">
              {/* All Documents */}
              <button
                onClick={() => setActiveFolderId(null)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  !activeFolderId ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">All Documents</span>
              </button>

              {/* User folders */}
              {folders.length === 0 && (
                <p className="px-4 py-3 text-xs text-gray-400 italic">No folders yet</p>
              )}
              {folders.map(folder => (
                <div key={folder.id} className="group relative flex items-center">
                  <button
                    onClick={() => setActiveFolderId(folder.id === activeFolderId ? null : folder.id)}
                    className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors min-w-0 ${
                      activeFolderId === folder.id
                        ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    {folder.count > 0 && (
                      <span className="text-[10px] font-bold text-gray-400">{folder.count}</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="shrink-0 mr-2 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* New folder inline form */}
            {newFolderOpen && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderOpen(false) }}
                  placeholder="Folder name…"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                />
                <div className="flex gap-1 flex-wrap">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={`h-5 w-5 rounded-full transition-all ${newFolderColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setNewFolderOpen(false); setNewFolderName('') }}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                  >Cancel</button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="flex-1 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-semibold disabled:opacity-50"
                  >{creatingFolder ? '…' : 'Create'}</button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Breadcrumb when in a folder */}
          {activeFolder && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              <button onClick={() => setActiveFolderId(null)} className="hover:text-gray-800 transition-colors">All Documents</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold flex items-center gap-1.5" style={{ color: activeFolder.color }}>
                <Folder className="h-3.5 w-3.5" style={{ color: activeFolder.color }} />
                {activeFolder.name}
              </span>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)] bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap mb-6">
            {CATEGORY_TABS.map(tab => {
              const Icon   = tab.icon
              const active = category === tab.id
              const count  = tab.id === 'all' ? counts.all : counts[tab.id as Category]
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-24">
              <FolderOpen className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {activeFolder ? `No documents in "${activeFolder.name}"` : 'No documents found'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {activeFolder
                  ? 'Move documents here using the folder icon on any document card'
                  : search ? 'Try a different search term' : 'Upload ticket photos or import AI documents to get started'}
              </p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {docs.map(doc => (
                <div key={doc.id} className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-[var(--brand-primary)] hover:shadow-md transition-all">
                  {/* Thumbnail — clickable */}
                  <button
                    className="w-full text-left"
                    onClick={() => setPreview({ doc, loaded: false })}
                  >
                    <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                      {isImage(doc) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.url}
                          alt={doc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <DocIcon doc={doc} size={36} />
                      )}
                      <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[doc.category]}`}>
                        {CATEGORY_LABEL[doc.category]}
                      </span>
                    </div>
                    <div className="px-3 pt-2.5 pb-1">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{fmtDate(doc.created_at)}</p>
                    </div>
                  </button>

                  {/* Folder action row */}
                  <div className="px-3 pb-2.5 flex items-center justify-between gap-1">
                    <div className="flex gap-1 flex-wrap min-w-0">
                      {folders.filter(() => false).map(f => ( // placeholder — replaced by move button
                        <span key={f.id} className="text-[9px]" style={{ color: f.color }}>{f.name}</span>
                      ))}
                    </div>
                    <div className="relative ml-auto">
                      <button
                        onClick={e => { e.stopPropagation(); setFolderMenuDoc(folderMenuDoc === doc.id ? null : doc.id) }}
                        disabled={movingDoc === doc.id}
                        className="p-1 rounded-lg text-gray-300 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                        title="Move to folder"
                      >
                        {movingDoc === doc.id
                          ? <div className="h-3.5 w-3.5 rounded-full border border-gray-400 border-t-transparent animate-spin" />
                          : <FolderInput className="h-3.5 w-3.5" />
                        }
                      </button>

                      {/* Folder picker dropdown */}
                      {folderMenuDoc === doc.id && (
                        <div
                          className="absolute bottom-full right-0 mb-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden"
                          onClick={e => e.stopPropagation()}
                        >
                          <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Move to folder</p>
                          {folders.length === 0 && (
                            <p className="px-3 py-2 text-xs text-gray-400">No folders yet — create one in the sidebar</p>
                          )}
                          {folders.map(f => (
                            <button
                              key={f.id}
                              onClick={() => handleMoveToFolder(doc.id, f.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
                              <span className="truncate">{f.name}</span>
                            </button>
                          ))}
                          {activeFolderId && (
                            <>
                              <div className="border-t border-gray-100" />
                              <button
                                onClick={() => handleRemoveFromFolder(doc.id, activeFolderId)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                                Remove from folder
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Category', 'Job', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {docs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setPreview({ doc, loaded: false })}>
                        <div className="flex items-center gap-2.5">
                          <DocIcon doc={doc} size={18} />
                          <span className="font-medium text-gray-900 truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setPreview({ doc, loaded: false })}>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[doc.category]}`}>
                          {CATEGORY_LABEL[doc.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[120px] cursor-pointer" onClick={() => setPreview({ doc, loaded: false })}>{doc.job_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap cursor-pointer" onClick={() => setPreview({ doc, loaded: false })}>{fmtDate(doc.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                            title="Open"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <div className="relative">
                            <button
                              onClick={() => setFolderMenuDoc(folderMenuDoc === doc.id ? null : doc.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                              title="Move to folder"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                            {folderMenuDoc === doc.id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden"
                                onClick={e => e.stopPropagation()}
                              >
                                <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Move to folder</p>
                                {folders.length === 0 && (
                                  <p className="px-3 py-2 text-xs text-gray-400">No folders yet</p>
                                )}
                                {folders.map(f => (
                                  <button
                                    key={f.id}
                                    onClick={() => handleMoveToFolder(doc.id, f.id)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
                                    <span className="truncate">{f.name}</span>
                                  </button>
                                ))}
                                {activeFolderId && (
                                  <>
                                    <div className="border-t border-gray-100" />
                                    <button
                                      onClick={() => handleRemoveFromFolder(doc.id, activeFolderId)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Remove from folder
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Close folder menus on outside click */}
      {folderMenuDoc && (
        <div className="fixed inset-0 z-10" onClick={() => setFolderMenuDoc(null)} />
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => { if (!uploading) setUploadOpen(false) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="h-4 w-4 text-[var(--brand-primary)]" />
                Upload Document
              </h2>
              <button onClick={() => setUploadOpen(false)} disabled={uploading} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">File <span className="text-red-500">*</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setUploadFile(f)
                    if (f && !uploadName) setUploadName(f.name)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors text-gray-500 hover:text-[var(--brand-primary)]"
                >
                  {uploadFile ? (
                    <>
                      <FileText className="h-8 w-8 text-[var(--brand-primary)]" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[280px]">{uploadFile.name}</span>
                      <span className="text-xs text-gray-400">{(uploadFile.size / 1024).toFixed(0)} KB — click to change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8" />
                      <span className="text-sm font-medium">Click to choose a file</span>
                      <span className="text-xs text-gray-400">Images, PDFs, or any file type</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Document Name</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Insurance Certificate 2026"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value)}
                  placeholder="Any details about this document…"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-4 w-4" /> Upload</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
              <DocIcon doc={preview.doc} size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{preview.doc.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(preview.doc.created_at)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={preview.doc.url}
                  download
                  onClick={e => e.stopPropagation()}
                  className="p-2 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
                <a
                  href={preview.doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-2 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button onClick={() => setPreview(null)} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {Object.keys(preview.doc.meta).length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                {Object.entries(preview.doc.meta).map(([k, v]) => v != null && (
                  <span key={k}>
                    <span className="font-medium text-gray-700 capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                    {String(v)}
                  </span>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-[300px]">
              {isImage(preview.doc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.doc.url}
                  alt={preview.doc.name}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : isPdf(preview.doc) ? (
                <div className="text-center py-12 px-6">
                  <FileText className="h-16 w-16 text-red-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-3">{preview.doc.name}</p>
                  <a
                    href={preview.doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open PDF
                  </a>
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <FolderOpen className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                  <a
                    href={preview.doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
