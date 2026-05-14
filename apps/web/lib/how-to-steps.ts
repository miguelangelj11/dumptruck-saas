export interface HowToStep {
  id: string
  emoji: string
  title: string
  section: string
  description: string   // what this section does
  howTo: string         // exactly what to click / how to use it
  cta: string
  href: string
}

export const HOW_TO_STEPS: HowToStep[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: 'dashboard_overview',
    emoji: '🏠',
    section: 'Dashboard',
    title: 'Your daily command center',
    description: 'The dashboard shows everything happening in your business right now — active dispatches, loads completed today, revenue for the week, and anything that needs your attention.',
    howTo: 'Scan "NEEDS ATTENTION" first every morning. It flags missing tickets, overdue invoices, and drivers who haven\'t responded. Everything else is a live snapshot of today\'s operations.',
    cta: 'Open Dashboard',
    href: '/dashboard',
  },

  // ── Dispatch ────────────────────────────────────────────────────────────────
  {
    id: 'dispatch_create',
    emoji: '📡',
    section: 'Dispatch',
    title: 'How to dispatch a driver',
    description: 'Dispatch is how you assign jobs to drivers. Each dispatch ties a driver to a job site and tracks their status in real time.',
    howTo: 'Click Dispatch in the sidebar → tap "+ New Dispatch" → pick a driver, select the job/client, and set the date. Hit Save. Your driver instantly sees the job on their phone. You\'ll see their status update as they move from "Dispatched" → "On Site" → "Done".',
    cta: 'Open Dispatch',
    href: '/dashboard/dispatch',
  },
  {
    id: 'dispatch_board',
    emoji: '📋',
    section: 'Dispatch',
    title: 'Reading the dispatch board',
    description: 'The board shows all active dispatches for the day with live status badges.',
    howTo: 'Each row = one driver on one job. The colored badge tells you where they are: Dispatched (sent), On Site (working), Done (finished), No Response (hasn\'t acknowledged). Tap any row to see full details or update the status manually.',
    cta: 'View Dispatch Board',
    href: '/dashboard/dispatch',
  },

  // ── Tickets ─────────────────────────────────────────────────────────────────
  {
    id: 'tickets_add',
    emoji: '🎫',
    section: 'Tickets',
    title: 'Adding a haul ticket',
    description: 'Tickets are the record of every load hauled. They track the driver, truck, material, tonnage, and job — and feed directly into invoices.',
    howTo: 'Click Tickets → tap "+ New Ticket" → fill in the driver, truck, job/client, material, and tonnage (or load count). Save it. That ticket is now attached to the job and will show up when you generate an invoice. Drivers can also submit tickets themselves from their phone.',
    cta: 'Add a Ticket',
    href: '/dashboard/tickets',
  },
  {
    id: 'tickets_review',
    emoji: '✅',
    section: 'Tickets',
    title: 'Reviewing & approving tickets',
    description: 'When drivers submit tickets from the field, they land here for your review before they\'re used on invoices.',
    howTo: 'Open Tickets and look for any tickets marked "Pending Review". Click the ticket to see the details and any photo of the slip they uploaded. Hit Approve to lock it in, or Edit if something looks off. Only approved tickets go onto invoices.',
    cta: 'View All Tickets',
    href: '/dashboard/tickets',
  },
  {
    id: 'tickets_mobile',
    emoji: '📱',
    section: 'Tickets',
    title: 'Quick ticket from your phone',
    description: 'The fastest way to log a ticket is the Quick Ticket form on mobile — designed for the cab of a truck.',
    howTo: 'Open the app on your phone → go to Tickets → tap the big "+ Quick Ticket" button at the top. Pick /job /hr or /ton rate type, fill in the details, and hit Save. Done in under 30 seconds. Great for owner-operators logging their own loads.',
    cta: 'Open Tickets',
    href: '/dashboard/tickets',
  },

  // ── Drivers ─────────────────────────────────────────────────────────────────
  {
    id: 'drivers_add',
    emoji: '👤',
    section: 'Drivers',
    title: 'Adding & managing drivers',
    description: 'Every driver in your system gets their own profile with pay rate, truck assignment, and activity history.',
    howTo: 'Click Drivers → "+ Add Driver" → enter their name, phone, and pay rate (per load, per hour, or per ton). Assign them a truck. Save. They\'ll get a text invite to set up their driver portal login so they can receive dispatches and submit tickets from their phone.',
    cta: 'Open Drivers',
    href: '/dashboard/drivers',
  },
  {
    id: 'driver_portal',
    emoji: '🔐',
    section: 'Drivers',
    title: 'The driver portal',
    description: 'Each driver gets their own login — a simplified mobile view showing only their dispatches, tickets, and pay.',
    howTo: 'Once a driver is added, they log in at dumptruckboss.com/login with their email. They\'ll see their active dispatch, tap to update their status (On Site, Done), and can submit tickets directly. You see all of this in real time on your dispatch board. Drivers never see other drivers\' data or your financials.',
    cta: 'Manage Drivers',
    href: '/dashboard/drivers',
  },

  // ── Invoices ─────────────────────────────────────────────────────────────────
  {
    id: 'invoices_create',
    emoji: '🧾',
    section: 'Invoices',
    title: 'Creating an invoice',
    description: 'Invoices are built from your approved tickets. Select the tickets for a client, generate the invoice, and send — takes under a minute.',
    howTo: 'Click Invoices → "+ New Invoice" → pick the client → the system pulls all uninvoiced tickets for that client automatically. Review the line items, adjust anything if needed, then hit "Generate Invoice". You can email it directly from the app or download the PDF to send yourself.',
    cta: 'Open Invoices',
    href: '/dashboard/invoices',
  },
  {
    id: 'invoices_track',
    emoji: '💰',
    section: 'Invoices',
    title: 'Tracking payments',
    description: 'See at a glance which invoices are paid, outstanding, or overdue — and get alerted when things are late.',
    howTo: 'Each invoice shows a status badge: Draft, Sent, Paid, or Overdue. When a client pays, mark it Paid. The Revenue section updates instantly. Overdue invoices automatically show in the "NEEDS ATTENTION" section on your dashboard so nothing slips through the cracks.',
    cta: 'View Invoices',
    href: '/dashboard/invoices',
  },

  // ── Revenue ──────────────────────────────────────────────────────────────────
  {
    id: 'revenue_overview',
    emoji: '📈',
    section: 'Revenue',
    title: 'Revenue & earnings tracking',
    description: 'Revenue shows you exactly how much you\'ve earned, what\'s been collected, and what\'s still outstanding — broken down by week, month, or job.',
    howTo: 'Click Revenue in the sidebar. The top cards show Total Billed, Collected, and Outstanding for the current period. Scroll down to see a breakdown by client or job. Use this before billing cycles to know exactly who owes you money.',
    cta: 'View Revenue',
    href: '/dashboard/revenue',
  },

  // ── Settings / Clients ───────────────────────────────────────────────────────
  {
    id: 'settings_clients',
    emoji: '🏢',
    section: 'Settings',
    title: 'Adding clients & job sites',
    description: 'Clients are the companies you haul for. Each client can have multiple job sites. You need clients set up before you can create dispatches or invoices.',
    howTo: 'Go to Settings → scroll to "Clients / Job Sites" → click "+ Add Client" → enter the company name and contact info. Then add job sites under that client (each site can have its own address and material type). These show up in the dropdown when you create dispatches or tickets.',
    cta: 'Open Settings',
    href: '/dashboard/settings',
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  {
    id: 'documents_store',
    emoji: '📁',
    section: 'Documents',
    title: 'Storing important documents',
    description: 'Documents is your digital filing cabinet — insurance certs, contracts, driver licenses, permits, anything your business needs to keep on file.',
    howTo: 'Click Documents → pick a folder (or create one) → tap "+ Upload" → drag in the file or pick from your phone. Files are organized by folder and searchable by name. Great for keeping insurance certs accessible when a job site asks for them on the spot.',
    cta: 'Open Documents',
    href: '/dashboard/documents',
  },
]

export const HOW_TO_SECTIONS = [...new Set(HOW_TO_STEPS.map(s => s.section))]
