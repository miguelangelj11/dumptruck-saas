import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import FeaturesSection from '@/components/landing/features-section'
import { FileText, Users, TrendingUp, Truck, Receipt, BarChart3, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Features — DumpTruckBoss',
}

const detailFeatures = [
  {
    icon: FileText,
    title: 'Smart Ticket Management',
    description: 'Create load tickets in under 30 seconds. Capture job name, material type, driver, quantity, rate, date, and site location. Filter, search, and bulk-convert to invoices.',
    bullets: ['Bulk select and invoice', 'Status tracking (Pending → Invoiced → Paid)', 'Date and driver filters', 'Edit and delete any ticket'],
  },
  {
    icon: Receipt,
    title: 'Professional Invoicing',
    description: 'Build invoices from selected tickets. Send polished PDFs to contractors. Track payment status from Draft through Paid — and get overdue alerts.',
    bullets: ['PDF invoice generation', 'Contractor invoices + driver pay stubs', 'Status: Draft, Sent, Paid, Overdue', 'Invoice history and audit trail'],
  },
  {
    icon: Users,
    title: 'Driver Management',
    description: 'Keep every driver\'s info, history, and earnings in one place. See who\'s moving loads and who\'s outstanding at a glance.',
    bullets: ['Driver cards with load history', 'Total loads & revenue per driver', 'Active / inactive status', 'One-click driver detail view'],
  },
  {
    icon: TrendingUp,
    title: 'Revenue & Analytics',
    description: 'Stop guessing and start knowing. Revenue by driver, by month, profit vs. loss — every number you need to run a smarter operation.',
    bullets: ['Revenue by driver bar chart', 'Revenue by month line chart', 'Expense tracker', 'Profit / loss summary'],
  },
]

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      <Nav />
      <div className="pt-24 bg-[#0f1923]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Features</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Built for how you <em className="not-italic text-[#4ade80]">actually</em> work
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto mb-8">
            No bloat. No learning curve. Just the tools a dump truck operator needs to run a tight business.
          </p>
          <Link
            href="/signup"
            className="inline-flex rounded-lg bg-[#2d7a4f] px-6 py-3 text-base font-semibold text-white hover:bg-[#245f3e] transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>

      <div className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          {detailFeatures.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={f.title} className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                <div className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <div className="inline-flex rounded-xl bg-[#2d7a4f]/10 p-3 mb-4">
                    <Icon className="h-6 w-6 text-[#2d7a4f]" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{f.title}</h2>
                  <p className="text-gray-500 text-base leading-relaxed mb-6">{f.description}</p>
                  <ul className="space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-[#2d7a4f] shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`rounded-2xl bg-gray-50 border border-gray-100 p-8 aspect-[4/3] flex items-center justify-center ${i % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                  <div className="text-center">
                    <Icon className="h-16 w-16 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-300">{f.title} preview</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <FeaturesSection />
      <Footer />
    </div>
  )
}
