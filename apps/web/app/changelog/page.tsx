import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Changelog — DumpTruckBoss',
  description: "What's new in DumpTruckBoss — release notes and product updates.",
}

type Release = {
  version: string
  date: string
  badge?: 'new' | 'improved' | 'fix'
  entries: { type: 'new' | 'improved' | 'fix'; text: string }[]
}

const releases: Release[] = [
  {
    version: '1.8.0',
    date: 'April 30, 2026',
    entries: [
      { type: 'new', text: 'Enterprise AI Assistant — a floating chat widget powered by Claude that answers platform questions in real time (Enterprise plan only).' },
      { type: 'new', text: 'Full i18n support — the platform is now available in Spanish, French, Russian, and Ukrainian in addition to English.' },
      { type: 'improved', text: 'Trucks table now supports a Notes field for recording maintenance notes, assignments, and other details per truck.' },
      { type: 'improved', text: 'Invoice settings: new toggles to show/hide Truck #, Time, Ticket #, and Material columns on printed invoices.' },
      { type: 'fix', text: 'Fixed an issue where the trial expiry check could redirect valid subscribers to the trial-expired page.' },
    ],
  },
  {
    version: '1.7.0',
    date: 'April 15, 2026',
    entries: [
      { type: 'new', text: 'Two-factor authentication — protect your account with a TOTP authenticator app (Google Authenticator, Authy).' },
      { type: 'new', text: 'Account deletion — owners can now permanently delete all company data from Settings → Danger Zone.' },
      { type: 'new', text: 'Onboarding banner — new accounts now see a setup checklist on the dashboard until company info and first driver are added.' },
      { type: 'improved', text: 'Mobile navigation overhauled with smoother animation and a backdrop dismiss gesture.' },
      { type: 'fix', text: 'Fixed password reset email not delivering in some email clients.' },
    ],
  },
  {
    version: '1.6.0',
    date: 'March 28, 2026',
    entries: [
      { type: 'new', text: 'Team management — invite drivers, dispatchers, and accountants with role-based access. Drivers can now log in and submit tickets directly.' },
      { type: 'new', text: 'Expense tracker — log and categorize operational expenses (fuel, maintenance, insurance, labor) and see them reflected in net profit.' },
      { type: 'improved', text: 'Revenue page redesigned with a new "Driver Pay" tab showing weekly payroll breakdowns by driver and contractor.' },
      { type: 'improved', text: 'Dispatch board now shows real-time load count and last ticket timestamp per driver.' },
      { type: 'fix', text: 'Fixed dispatch status not updating after driver ticket submission in some time zones.' },
    ],
  },
  {
    version: '1.5.0',
    date: 'March 5, 2026',
    entries: [
      { type: 'new', text: 'CSV data export — download tickets, invoices, driver payments, and expenses for any date range.' },
      { type: 'new', text: 'Email notification preferences — choose which events trigger email alerts (new ticket, invoice overdue, payment received, etc.).' },
      { type: 'improved', text: 'Invoice PDF generator updated with cleaner typography and optional exhibit attachment support.' },
      { type: 'improved', text: 'Ticket list now has tabbed views: All Tickets, Office Entered, Driver Submitted, and Missing.' },
      { type: 'fix', text: 'Fixed subcontractor ticket photos not displaying in the ticket modal on iOS Safari.' },
    ],
  },
  {
    version: '1.4.0',
    date: 'February 12, 2026',
    entries: [
      { type: 'new', text: 'Company branding — upload a logo and set primary/accent colors. Your logo appears in the sidebar and on all printed invoices.' },
      { type: 'new', text: 'Fleet management — add truck numbers with optional driver assignments. Trucks appear in dispatch and ticket forms.' },
      { type: 'improved', text: 'Dashboard redesigned with load activity chart (this year vs last year) and a top drivers leaderboard.' },
      { type: 'improved', text: 'Drivers page now shows outstanding unpaid work with one-click payment recording.' },
    ],
  },
  {
    version: '1.3.0',
    date: 'January 20, 2026',
    entries: [
      { type: 'new', text: 'Subcontractors module — manage independent operators, track their tickets and hours, and record payments separately from your own drivers.' },
      { type: 'new', text: 'Missing tickets alert — the dashboard and tickets page now surface past dispatches that have no submitted tickets.' },
      { type: 'improved', text: 'Ticket form now supports multiple load slips / supporting photos per ticket.' },
      { type: 'fix', text: 'Fixed invoice total calculation when line items include a mix of per-load and per-ton rates.' },
    ],
  },
  {
    version: '1.2.0',
    date: 'January 3, 2026',
    entries: [
      { type: 'new', text: 'Invoices — create professional invoices from approved tickets, set payment terms, and track status (Draft → Sent → Paid).' },
      { type: 'new', text: 'Revenue overview — see paid invoices, cash collected, outstanding balance, and net profit at a glance.' },
      { type: 'improved', text: 'Dispatch modal now supports special instructions and an optional start time field.' },
    ],
  },
  {
    version: '1.1.0',
    date: 'December 10, 2025',
    entries: [
      { type: 'new', text: 'Driver management — add drivers, track loads and revenue per driver, and record payment history with method (check, cash, Zelle, ACH).' },
      { type: 'new', text: 'Ticket status workflow — tickets move through Pending → Approved → Invoiced → Paid with one-click approve/reject from the office.' },
      { type: 'improved', text: 'Dispatch board redesigned with job cards showing active, on-hold, and completed jobs in separate columns.' },
    ],
  },
  {
    version: '1.0.0',
    date: 'November 18, 2025',
    entries: [
      { type: 'new', text: 'DumpTruckBoss launches! Core dispatch and load ticketing system for dump truck and hauling companies.' },
      { type: 'new', text: 'Create jobs, dispatch drivers, submit load tickets with photos, and track loads from dispatch to invoice.' },
      { type: 'new', text: '14-day free trial, no credit card required.' },
    ],
  },
]

const badgeStyles = {
  new:      'bg-[#dcfce7] text-[#15803d]',
  improved: 'bg-[#dbeafe] text-[#1d4ed8]',
  fix:      'bg-[#fef9c3] text-[#854d0e]',
}

const badgeLabels = {
  new: 'New',
  improved: 'Improved',
  fix: 'Fix',
}

export default function ChangelogPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">What's New</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Changelog</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Every update, improvement, and fix — newest first.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="space-y-12">
            {releases.map((release) => (
              <div key={release.version} className="relative">
                {/* Version header */}
                <div className="flex items-baseline gap-4 mb-5">
                  <h2 className="text-xl font-bold text-gray-900">v{release.version}</h2>
                  <span className="text-sm text-gray-400">{release.date}</span>
                </div>

                {/* Entries */}
                <ul className="space-y-3">
                  {release.entries.map((entry, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeStyles[entry.type]}`}>
                        {badgeLabels[entry.type]}
                      </span>
                      <p className="text-gray-700 text-sm leading-relaxed">{entry.text}</p>
                    </li>
                  ))}
                </ul>

                {/* Divider */}
                <div className="mt-10 border-b border-gray-100" />
              </div>
            ))}
          </div>

          <div className="mt-12 bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-1">Have a feature request?</p>
            <p className="text-gray-500 text-sm">
              Email us at{' '}
              <a href="mailto:hello@dumptruckboss.com" className="text-[#2d7a4f] font-medium hover:underline">
                hello@dumptruckboss.com
              </a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
