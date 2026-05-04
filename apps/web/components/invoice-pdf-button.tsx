'use client'

import { useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import InvoicePDF, { type TicketPhoto } from '@/components/invoice-pdf'
import type { Invoice, InvoiceLineItem } from '@/lib/types'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFDownloadLink),
  { ssr: false }
)

type CompanyInfo = {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
}

type Props = {
  invoice: Invoice & { invoice_line_items?: InvoiceLineItem[] }
  company: CompanyInfo
  ticketPhotos: TicketPhoto[]
}

export default function InvoicePDFButton({ invoice, company, ticketPhotos }: Props) {
  const photoCount = ticketPhotos.length
  const toastedRef = useRef(false)

  const doc = useMemo(
    () => <InvoicePDF invoice={invoice} company={company} ticketPhotos={ticketPhotos} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoice.id, ticketPhotos.length]
  )

  return (
    <PDFDownloadLink
      document={doc}
      fileName={`invoice-${invoice.invoice_number}.pdf`}
    >
      {({ loading }) => {
        if (!loading && !toastedRef.current) {
          toastedRef.current = true
          setTimeout(() => {
            toast.success(photoCount > 0
              ? `PDF ready — includes ${photoCount} ticket photo${photoCount !== 1 ? 's' : ''}`
              : 'PDF ready'
            )
          }, 0)
        }
        return (
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />
            }
            {loading ? 'Generating PDF…' : 'Download PDF'}
          </button>
        )
      }}
    </PDFDownloadLink>
  )
}
