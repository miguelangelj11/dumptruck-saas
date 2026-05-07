'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FolderOpen, Search, LayoutGrid, List, X, ExternalLink,
  FileText, Image as ImageIcon, Bot, Receipt, Truck,
  RefreshCw, Download,
} from 'lucide-react'
import type { DocumentItem } from '@/app/api/documents/route'

type Category = 'all' | 'ai_import' | 'ticket_photo' | 'subcontractor_photo' | 'received_invoice'
type ViewMode = 'grid' | 'list'

const CATEGORY_TABS: { id: Category; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all',                 label: 'All Documents',      icon: FolderOpen,  color: 'text-gray-600'   },
  { id: 'ai_import',           label: 'AI Imports',         icon: Bot,         color: 'text-violet-600' },
  { id: 'ticket_photo',        label: 'Ticket Photos',      icon: Truck,       color: 'text-blue-600'   },
  { id: 'subcontractor_photo', label: 'Sub Photos',         icon: ImageIcon,   color: 'text-orange-600' },
  { id: 'received_invoice',    label: 'Received Invoices',  icon: Receipt,     color: 'text-green-600'  },
]

const CATEGORY_BADGE: Record<Category, string> = {
  all:                 'bg-gray-100 text-gray-700',
  ai_import:           'bg-violet-100 text-violet-700',
  ticket_photo:        'bg-blue-100 text-blue-700',
  subcontractor_photo: 'bg-orange-100 text-orange-700',
  received_invoice:    'bg-green-100 text-green-700',
}

const CATEGORY_LABEL: Record<Category, string> = {
  all:                 'All',
  ai_import:           'AI Import',
  ticket_photo:        'Ticket Photo',
  subcontractor_photo: 'Sub Photo',
  received_invoice:    'Invoice',
}

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
  const [docs, setDocs]           = useState<DocumentItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [category, setCategory]   = useState<Category>('all')
  const [search, setSearch]       = useState('')
  const [view, setView]           = useState<ViewMode>('grid')
  const [preview, setPreview]     = useState<PreviewModal | null>(null)

  const fetchDocs = useCallback(async (cat: Category, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ category: cat })
      if (q) params.set('search', q)
      const res  = await fetch(`/api/documents?${params}`)
      const json = await res.json()
      setDocs(json.docs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchDocs(category, search), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [category, search, fetchDocs])

  const counts = docs.reduce<Record<Category, number>>((acc, d) => {
    acc.all++
    acc[d.category] = (acc[d.category] ?? 0) + 1
    return acc
  }, { all: 0, ai_import: 0, ticket_photo: 0, subcontractor_photo: 0, received_invoice: 0 })

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
            onClick={() => fetchDocs(category, search)}
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
          const count  = category === 'all' ? counts[tab.id] : (tab.id === 'all' ? counts.all : counts[tab.id])
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
          <p className="text-gray-500 font-medium">No documents found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Try a different search term' : 'Upload ticket photos or import AI documents to get started'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {docs.map(doc => (
            <button
              key={doc.id}
              onClick={() => setPreview({ doc, loaded: false })}
              className="group text-left bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-[var(--brand-primary)] hover:shadow-md transition-all"
            >
              {/* Thumbnail */}
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
                {/* Category badge */}
                <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[doc.category]}`}>
                  {CATEGORY_LABEL[doc.category]}
                </span>
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">{doc.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">{fmtDate(doc.created_at)}</p>
              </div>
            </button>
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
                <tr key={doc.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setPreview({ doc, loaded: false })}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <DocIcon doc={doc} size={18} />
                      <span className="font-medium text-gray-900 truncate max-w-[260px]">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[doc.category]}`}>
                      {CATEGORY_LABEL[doc.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">{doc.job_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(doc.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); window.open(doc.url, '_blank') }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            {/* Modal header */}
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

            {/* Metadata */}
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

            {/* Preview body */}
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
