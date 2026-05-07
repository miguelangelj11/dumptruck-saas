'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, FileText, Image as ImageIcon, Bot, Receipt, Truck } from 'lucide-react'
type DocumentItem = {
  id: string
  category: 'ai_import' | 'ticket_photo' | 'subcontractor_photo' | 'received_invoice'
  name: string
  url: string
  mime: string
  job_name: string | null
  created_at: string
  meta: Record<string, unknown>
}

type Category = DocumentItem['category']

const CAT_ICON: Record<Category, React.ElementType> = {
  ai_import:           Bot,
  ticket_photo:        Truck,
  subcontractor_photo: ImageIcon,
  received_invoice:    Receipt,
}

const CAT_BADGE: Record<Category, string> = {
  ai_import:           'bg-violet-100 text-violet-700',
  ticket_photo:        'bg-blue-100 text-blue-700',
  subcontractor_photo: 'bg-orange-100 text-orange-700',
  received_invoice:    'bg-green-100 text-green-700',
}

const CAT_LABEL: Record<Category, string> = {
  ai_import:           'AI Import',
  ticket_photo:        'Ticket Photo',
  subcontractor_photo: 'Sub Photo',
  received_invoice:    'Invoice',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isImage(doc: DocumentItem) {
  return doc.mime.startsWith('image') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(doc.url)
}

export default function RecentDocuments() {
  const [docs, setDocs]       = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documents?category=all')
      .then(r => r.json())
      .then(j => setDocs((j.docs ?? []).slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && docs.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[var(--brand-primary)]" />
          <h2 className="font-semibold text-gray-900 text-sm">Recent Documents</h2>
        </div>
        <Link href="/dashboard/documents" className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-50">
          {docs.map(doc => {
            const Icon = CAT_ICON[doc.category] ?? FileText
            return (
              <Link
                key={doc.id}
                href="/dashboard/documents"
                className="group flex flex-col hover:bg-gray-50/60 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-50">
                  {isImage(doc) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.url}
                      alt={doc.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Icon className="h-8 w-8 text-gray-300" />
                  )}
                  <span className={`absolute bottom-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded-full ${CAT_BADGE[doc.category]}`}>
                    {CAT_LABEL[doc.category]}
                  </span>
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="text-[11px] font-medium text-gray-800 line-clamp-1">{doc.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(doc.created_at)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
