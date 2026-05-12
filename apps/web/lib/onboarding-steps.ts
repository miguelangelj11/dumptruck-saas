// Tier-aware onboarding step definitions
// Each step filters by tier — the checklist only shows steps for the user's plan.
//
// Step counts by tier (approximate):
//   Solo:            15 steps
//   Owner Op:        20 steps
//   Fleet:           26 steps
//   Growth/Ent:      28 steps

import { normalizePlan } from '@/lib/plan-gate'

export type TierSlug = 'solo' | 'owner_operator' | 'fleet' | 'enterprise'
export type StepStatus = 'pending' | 'completed' | 'skipped'

export type OnboardingStep = {
  id: string
  title: string
  emoji: string
  section: string
  // Operator-voice "why this matters" — shown in amber card inside each step
  why: string
  proTip?: string
  tiers: TierSlug[]
  cta: string
  href: string
  estimatedMinutes: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate: (supabase: any, companyId: string) => Promise<boolean>
  // If true, validate() result is not used to block completion — user marks it manually
  manualComplete?: boolean
}

const ALL:        TierSlug[] = ['solo', 'owner_operator', 'fleet', 'enterprise']
const OPR_PLUS:   TierSlug[] = ['owner_operator', 'fleet', 'enterprise']
const FLEET_PLUS: TierSlug[] = ['fleet', 'enterprise']
const GROWTH:     TierSlug[] = ['enterprise']

export const MASTER_STEPS: OnboardingStep[] = [

  // ═══════════════════════════════
  // SECTION — GET STARTED
  // ═══════════════════════════════

  {
    id: 'welcome',
    title: 'Hey — welcome to DumpTruckBoss',
    emoji: '👋',
    section: 'Get Started',
    why: 'This checklist gets you from zero to a working operation. Not a demo — real setup. Real first invoice. Takes about 15 minutes for solo operators.',
    tiers: ALL,
    cta: "Alright, let's go",
    href: '/dashboard',
    estimatedMinutes: 1,
    validate: async () => true,
    manualComplete: true,
  },

  {
    id: 'company_info',
    title: 'Add your company info',
    emoji: '🏢',
    section: 'Get Started',
    why: 'Your name, address, and phone show up on every invoice you send. Customers pay faster when it looks like a real business — not a cell number on a sticky note.',
    proTip: 'Use your company name exactly as it appears on your EIN — makes things cleaner when customers cut checks or do a 1099.',
    tiers: ALL,
    cta: 'Open Settings',
    href: '/dashboard/settings',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { data } = await supabase
        .from('companies')
        .select('name, phone')
        .eq('id', companyId)
        .maybeSingle()
      return !!data?.name?.trim()
    },
  },

  {
    id: 'upload_logo',
    title: 'Upload your company logo',
    emoji: '🖼️',
    section: 'Get Started',
    why: "A logo on the invoice is the difference between a customer thinking 'real company' and thinking 'guy with a truck.' Takes 30 seconds. Worth it every time.",
    proTip: "Don't have a logo? Even a plain text logo image works. Your company name in a good font > no logo at all.",
    tiers: ALL,
    cta: 'Upload Logo',
    href: '/dashboard/settings',
    estimatedMinutes: 1,
    validate: async (supabase, companyId) => {
      const { data } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', companyId)
        .maybeSingle()
      return !!data?.logo_url
    },
  },

  {
    id: 'revenue_goal',
    title: 'Set your monthly revenue goal',
    emoji: '🎯',
    section: 'Get Started',
    why: 'The dashboard shows a live progress bar toward your goal. When you can see the gap closing, you push harder. When you can see you missed, you fix it next month.',
    proTip: 'Be honest — not optimistic. Set the goal you need to cover expenses and pay yourself. You can always raise it.',
    tiers: ALL,
    cta: 'Open Settings',
    href: '/dashboard/settings',
    estimatedMinutes: 1,
    validate: async (supabase, companyId) => {
      const { data } = await supabase
        .from('companies')
        .select('monthly_revenue_goal')
        .eq('id', companyId)
        .maybeSingle()
      return (data?.monthly_revenue_goal ?? 0) > 0
    },
  },

  {
    id: 'mobile_app',
    title: 'Save DumpTruckBoss to your phone',
    emoji: '📱',
    section: 'Get Started',
    why: "Most of this system runs from the field. Drivers submit tickets from their phone. You dispatch from your phone. If it's not on your home screen, you'll forget to use it.",
    proTip: "On iPhone: tap the Share button in Safari, then 'Add to Home Screen.' On Android: tap the three dots, then 'Add to Home Screen.' Takes 15 seconds.",
    tiers: ALL,
    cta: "Got it — it's on my phone",
    href: '/dashboard',
    estimatedMinutes: 1,
    validate: async () => false,
    manualComplete: true,
  },

  // ═══════════════════════════════
  // SECTION — TRUCKS & DRIVERS
  // ═══════════════════════════════

  {
    id: 'add_truck',
    title: 'Add your first truck',
    emoji: '🚛',
    section: 'Trucks & Drivers',
    why: "Trucks are how the system tracks who hauled what. One truck, one truck number. Tickets get assigned to trucks — that's how you know which asset is making you money.",
    proTip: "Give each truck a number you actually use — T1, T2, or your own system. Drivers will see that number when they submit tickets.",
    tiers: ALL,
    cta: 'Add a Truck',
    href: '/dashboard/settings',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('trucks')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'add_driver',
    title: 'Add your first driver',
    emoji: '👷',
    section: 'Trucks & Drivers',
    why: "Drivers are who submits tickets from the field. If they're not in the system, no tickets land in your dashboard. Five minutes here saves you Sunday paperwork forever.",
    proTip: "Even if it's just you driving — add yourself as a driver. That way you can submit tickets from the driver app and everything flows into the same system.",
    tiers: ALL,
    cta: 'Add a Driver',
    href: '/dashboard/drivers',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'driver_pay_rate',
    title: 'Set a driver pay rate',
    emoji: '💰',
    section: 'Trucks & Drivers',
    why: "Per load, hourly, or % of revenue — once it's in, the system calculates exactly what you owe each driver every week. No more mental math at 6pm on a Friday.",
    proTip: "Use per-load rate if you're paying truckers per ticket. Use hourly if they're on the clock all day. The pay calculation shows up on the driver's screen automatically.",
    tiers: ALL,
    cta: 'Set Pay Rate',
    href: '/dashboard/drivers',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('pay_rate_value', 'is', null)
        .gt('pay_rate_value', 0)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'driver_compliance',
    title: 'Add CDL & medical card info for a driver',
    emoji: '🪪',
    section: 'Trucks & Drivers',
    why: "DOT compliance isn't optional. Track CDL expiry and medical card dates here — the dashboard alerts you before they expire so you're not scrambling the morning of an inspection.",
    proTip: "Add CDL expiry + medical card expiry for every driver. The dashboard Needs Attention panel will surface them before they become a DOT problem.",
    tiers: OPR_PLUS,
    cta: 'Open Drivers',
    href: '/dashboard/drivers',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('cdl_number', 'is', null)
      return (count ?? 0) >= 1
    },
  },

  // ═══════════════════════════════
  // SECTION — CLIENTS & WORK
  // ═══════════════════════════════

  {
    id: 'add_client',
    title: 'Add your first client company',
    emoji: '🤝',
    section: 'Clients & Work',
    why: "This is who you bill. Once they're in here, every invoice auto-fills their name and email. No more retyping the same GC's address from memory at 10pm.",
    proTip: "Add the person who actually approves invoices as the contact — not the site super. That's who needs to see the invoice fast.",
    tiers: ALL,
    cta: 'Add a Client',
    href: '/dashboard/settings',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('client_companies')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'first_job',
    title: 'Set up your first job',
    emoji: '📋',
    section: 'Clients & Work',
    why: "A job is the contract. Tickets get attached to a job. Invoices get built from those tickets. Everything starts here — rate, material, client, location. Get this right and the rest builds itself.",
    proTip: "Set the rate you actually quoted — don't estimate. If you quoted per ton, put per ton. The system calculates total from tickets automatically.",
    tiers: OPR_PLUS,
    cta: 'Create a Job',
    href: '/dashboard/dispatch',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'dispatch_driver',
    title: 'Dispatch a driver to a job',
    emoji: '📡',
    section: 'Clients & Work',
    why: "One tap. Your driver gets a notification on their phone, taps accept, and you see status live. No more 'did he see the message' texts at 5am.",
    proTip: "I dispatch from the truck while I'm already on a job. Yard manager doesn't even need to be involved — driver gets it direct.",
    tiers: OPR_PLUS,
    cta: 'Go to Dispatch',
    href: '/dashboard/dispatch',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'first_ticket',
    title: 'Submit your first real ticket',
    emoji: '🎫',
    section: 'Clients & Work',
    why: "Every ticket is a paycheck waiting to happen. The faster the ticket is in the system, the faster the invoice goes out. Don't leave money sitting in someone's pocket.",
    proTip: "Have your driver submit the ticket from the field as soon as the load is dropped — not at the end of the day. End-of-day tickets get forgotten.",
    tiers: ALL,
    cta: 'Go to Tickets',
    href: '/dashboard/tickets',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('loads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'first_invoice',
    title: 'Send your first real invoice',
    emoji: '💰',
    section: 'Clients & Work',
    why: "Watch how it pulls the ticket photo into the PDF. That's why customers pay this faster than anything you've sent before — they can see the work. No disputes, no 'I didn't get it.'",
    proTip: "Send it the same day the last load drops. I used to wait until Friday. Big mistake — the longer you wait, the longer they wait to pay.",
    tiers: ALL,
    cta: 'Create Invoice',
    href: '/dashboard/invoices',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status', 'draft')
      return (count ?? 0) >= 1
    },
  },

  // ═══════════════════════════════
  // SECTION — SUBCONTRACTORS
  // ═══════════════════════════════

  {
    id: 'add_sub',
    title: 'Add your first subcontractor',
    emoji: '🔧',
    section: 'Subcontractors',
    why: "Subs get tracked separately from your own drivers — their own ticket queue, their own payment vouchers. Keeps your books clean when it's time to pay them or prep for taxes.",
    proTip: "I assign each sub their own truck numbers in the system — even though they own the truck. Way easier to track who hauled what when invoices come in three weeks later.",
    tiers: FLEET_PLUS,
    cta: 'Add a Subcontractor',
    href: '/dashboard/contractors',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('contractors')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'sub_trucks',
    title: 'Add truck numbers to a subcontractor',
    emoji: '🚚',
    section: 'Subcontractors',
    why: "Truck numbers auto-fill when creating their tickets. One click instead of retyping every time. When subs run 3 trucks it pays off immediately.",
    proTip: "Use the same truck numbering system the sub uses — that way tickets from the field match what you see in the system without translation.",
    tiers: FLEET_PLUS,
    cta: 'Open Subcontractors',
    href: '/dashboard/contractors',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('contractor_trucks')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'sub_coi',
    title: 'Upload a COI for a subcontractor',
    emoji: '🛡️',
    section: 'Subcontractors',
    why: "GCs require proof of insurance before subs step foot on site. Store the COI here with an expiry date — dashboard alerts you 30 days before it expires so you're never caught scrambling.",
    proTip: "Set the expiry date when you upload it. The dashboard Needs Attention panel will surface it automatically before it lapses.",
    tiers: FLEET_PLUS,
    cta: 'Upload to Documents',
    href: '/dashboard/documents',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('entity_type', 'subcontractor')
      return (count ?? 0) >= 1
    },
  },

  // ═══════════════════════════════
  // SECTION — EXPENSES & PROFIT
  // ═══════════════════════════════

  {
    id: 'first_expense',
    title: 'Track your first expense',
    emoji: '⛽',
    section: 'Expenses & Profit',
    why: "Revenue without expenses is fantasy. Add fuel, maintenance, insurance — the Revenue page shows your real margin. The first time you see your actual profit margin it'll change how you price jobs.",
    proTip: "Start with your biggest line items — fuel and insurance. Those two alone will shift your margin calculation significantly.",
    tiers: OPR_PLUS,
    cta: 'Add an Expense',
    href: '/dashboard/expenses',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'link_expense',
    title: 'Link an expense to a job or truck',
    emoji: '🔗',
    section: 'Expenses & Profit',
    why: "Per-job and per-truck profit calculations only work when expenses are linked. Link a fuel expense to a truck and you'll see exactly which truck is eating your margin.",
    proTip: "Link recurring costs like insurance to a truck, not a job. Link materials and disposal fees to a specific job. Keep them separate and the profit reports get useful fast.",
    tiers: FLEET_PLUS,
    cta: 'Open Expenses',
    href: '/dashboard/expenses',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('link_type', 'is', null)
      return (count ?? 0) >= 1
    },
  },

  // ═══════════════════════════════
  // SECTION — DOCUMENTS
  // ═══════════════════════════════

  {
    id: 'documents',
    title: 'Upload a document',
    emoji: '📁',
    section: 'Documents',
    why: "Every invoice, every ticket photo, every signed agreement — one place. The day an owner asks for a ticket from three months ago, you pull it up in 10 seconds instead of digging through a glovebox.",
    proTip: "Upload your insurance cert and DOT paperwork first. Those are the documents you get asked for most and never want to hunt for.",
    tiers: FLEET_PLUS,
    cta: 'Go to Documents',
    href: '/dashboard/documents',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'doc_with_expiry',
    title: 'Add an expiry date to a document',
    emoji: '📅',
    section: 'Documents',
    why: "COIs, permits, CDLs, insurance policies — they all expire. Set an expiry date when you upload and the dashboard alerts you 30 days out. No more lapsed insurance surprises.",
    proTip: "When uploading a COI or permit, pick the doc type and set the expiry date — you'll get a Needs Attention alert before it lapses automatically.",
    tiers: FLEET_PLUS,
    cta: 'Open Documents',
    href: '/dashboard/documents',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .not('expiry_date', 'is', null)
      return (count ?? 0) >= 1
    },
  },

  // ═══════════════════════════════
  // SECTION — GROWTH
  // ═══════════════════════════════

  {
    id: 'crm_pipeline',
    title: 'Add a lead to your CRM pipeline',
    emoji: '📊',
    section: 'Growth',
    why: "Most operators lose track of leads in text threads. The pipeline turns 'I gotta follow up with that GC' into a daily task list. One lead you convert pays for this software for a year.",
    proTip: "Start with the last 3 GCs you talked to but didn't close. Add them right now. That follow-up is money sitting on the table.",
    tiers: FLEET_PLUS,
    cta: 'Open CRM',
    href: '/dashboard/crm',
    estimatedMinutes: 5,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
  },

  {
    id: 'first_quote',
    title: 'Convert a lead to a job',
    emoji: '💼',
    section: 'Growth',
    why: "Leads turn into jobs, jobs turn into tickets, tickets turn into invoices. Track every dollar from the first conversation. Win rate goes up when you actually follow up.",
    proTip: "When a lead closes, hit Convert in the CRM — it creates the job automatically so nothing falls through the cracks.",
    tiers: GROWTH,
    cta: 'Go to CRM',
    href: '/dashboard/crm',
    estimatedMinutes: 3,
    validate: async () => false,
    manualComplete: true,
  },

  {
    id: 'ai_import',
    title: 'Import tickets from a broker pay sheet',
    emoji: '🤖',
    section: 'Growth',
    why: "Don't waste a Saturday entering old tickets by hand. Upload a PDF — AI extracts all ticket data automatically. The backlog is gone in minutes — not hours.",
    proTip: "Clean photos work best. If you have paper tickets, stack them on a white surface and shoot them in daylight. Way cleaner than crumpled cab photos.",
    tiers: FLEET_PLUS,
    cta: 'Import Tickets',
    href: '/dashboard/tickets',
    estimatedMinutes: 5,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('ticket_imports')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
    manualComplete: true,
  },

  // ═══════════════════════════════
  // SECTION — FINISH UP
  // ═══════════════════════════════

  {
    id: 'tour_dashboard',
    title: 'Check out your dashboard',
    emoji: '📈',
    section: 'Finish Up',
    why: "Money This Week, Outstanding, and Lost Revenue — these are the three numbers that matter. Check them every morning with your coffee. You stop guessing and start running the business.",
    proTip: "The 'Lost Revenue' number is the one that'll sting the first time you see it. That's the point — now you can fix it.",
    tiers: ALL,
    cta: 'Go to Dashboard',
    href: '/dashboard',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
    manualComplete: true,
  },

  {
    id: 'notifications',
    title: 'Set your notification preferences',
    emoji: '🔔',
    section: 'Finish Up',
    why: "The system tells you when a ticket goes missing, an invoice goes overdue, or a driver hasn't submitted in two days. You stop having to remember to check — it tells you.",
    proTip: "Turn on the weekly summary email. It's the one you actually want to read on Monday morning — what came in, what's outstanding, what to chase.",
    tiers: ALL,
    cta: 'Open Settings',
    href: '/dashboard/settings',
    estimatedMinutes: 2,
    validate: async () => false,
    manualComplete: true,
  },
]

/** Return the canonical step list filtered to the given plan slug */
export function getStepsForPlan(plan: string | null | undefined): OnboardingStep[] {
  const tier = normalizePlan(plan) as TierSlug
  return MASTER_STEPS.filter(s => s.tiers.includes(tier))
}

/** Unique ordered section names for a given plan */
export function getSectionsForPlan(plan: string | null | undefined): string[] {
  const steps = getStepsForPlan(plan)
  const seen = new Set<string>()
  const sections: string[] = []
  for (const step of steps) {
    if (!seen.has(step.section)) {
      seen.add(step.section)
      sections.push(step.section)
    }
  }
  return sections
}

/** Total estimated minutes for a tier's steps */
export function estimatedMinutes(plan: string | null | undefined): number {
  return getStepsForPlan(plan).reduce((sum, s) => sum + s.estimatedMinutes, 0)
}
