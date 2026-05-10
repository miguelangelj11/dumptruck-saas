// Tier-aware onboarding step definitions
// Each step filters by tier — the checklist only shows steps for the user's plan.
//
// Step counts by tier:
//   Solo:       11 steps
//   Owner Op:   13 steps (+first_job, +dispatch_driver)
//   Fleet:      16 steps (+add_sub, +ai_import, +documents)
//   Growth/Ent: 18 steps (+crm_pipeline, +first_quote)

import { normalizePlan } from '@/lib/plan-gate'

export type TierSlug = 'solo' | 'owner_operator' | 'fleet' | 'enterprise'
export type StepStatus = 'pending' | 'completed' | 'skipped'

export type OnboardingStep = {
  id: string
  title: string
  emoji: string
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

const ALL:       TierSlug[] = ['solo', 'owner_operator', 'fleet', 'enterprise']
const OPR_PLUS:  TierSlug[] = ['owner_operator', 'fleet', 'enterprise']
const FLEET_PLUS: TierSlug[] = ['fleet', 'enterprise']
const GROWTH:    TierSlug[] = ['enterprise']

export const MASTER_STEPS: OnboardingStep[] = [
  // ── 1. Welcome ──────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    title: 'Hey — welcome to DumpTruckBoss',
    emoji: '👋',
    why: 'This checklist gets you from zero to a working operation. Not a demo — real setup. Real first invoice. Takes about 15 minutes for solo operators.',
    tiers: ALL,
    cta: "Alright, let's go",
    href: '/dashboard',
    estimatedMinutes: 1,
    validate: async () => true,
    manualComplete: true,
  },

  // ── 2. Company Info ──────────────────────────────────────────────────────────
  {
    id: 'company_info',
    title: 'Add your company info',
    emoji: '🏢',
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
      const name = String(data?.name ?? '').trim()
      return name.length > 0
    },
  },

  // ── 3. Upload Logo ───────────────────────────────────────────────────────────
  {
    id: 'upload_logo',
    title: 'Upload your company logo',
    emoji: '🖼️',
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

  // ── 4. Add First Truck ───────────────────────────────────────────────────────
  {
    id: 'add_truck',
    title: 'Add your first truck',
    emoji: '🚛',
    why: 'Trucks are how the system tracks who hauled what. One truck, one truck number. Tickets get assigned to trucks — that\'s how you know which asset is making you money.',
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

  // ── 5. Add Driver ────────────────────────────────────────────────────────────
  {
    id: 'add_driver',
    title: 'Add your first driver',
    emoji: '👷',
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

  // ── 6. Add Client ────────────────────────────────────────────────────────────
  {
    id: 'add_client',
    title: 'Add your first client company',
    emoji: '🤝',
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

  // ── 7. Mobile App ────────────────────────────────────────────────────────────
  {
    id: 'mobile_app',
    title: 'Save DumpTruckBoss to your phone',
    emoji: '📱',
    why: "Most of this system runs from the field. Drivers submit tickets from their phone. You dispatch from your phone. If it's not on your home screen, you'll forget to use it.",
    proTip: "On iPhone: tap the Share button in Safari, then 'Add to Home Screen.' On Android: tap the three dots, then 'Add to Home Screen.' Takes 15 seconds.",
    tiers: ALL,
    cta: 'Got it — it\'s on my phone',
    href: '/dashboard',
    estimatedMinutes: 1,
    validate: async () => false,
    manualComplete: true,
  },

  // ── 8. First Job (Owner Op+) ─────────────────────────────────────────────────
  {
    id: 'first_job',
    title: 'Set up your first job',
    emoji: '📋',
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

  // ── 9. Dispatch Driver (Owner Op+) ───────────────────────────────────────────
  {
    id: 'dispatch_driver',
    title: 'Dispatch a driver to the job',
    emoji: '📡',
    why: "One tap. Your driver gets a notification on their phone, taps accept, and you see status live. No more 'did he see the message' texts at 5am.",
    proTip: "I dispatch from the truck while I'm already on a job. Yard manager doesn't even need to be involved — driver gets it direct.",
    tiers: OPR_PLUS,
    cta: 'Go to Dispatch',
    href: '/dashboard/dispatch',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      // A dispatched job means at least one job exists with a non-draft status
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .neq('status', 'draft')
      return (count ?? 0) >= 1
    },
  },

  // ── 10. Add Subcontractor (Fleet+) ───────────────────────────────────────────
  {
    id: 'add_sub',
    title: 'Add your first subcontractor',
    emoji: '🔧',
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

  // ── 11. AI Bulk Import (Fleet+) ──────────────────────────────────────────────
  {
    id: 'ai_import',
    title: 'Bulk import your existing tickets',
    emoji: '🤖',
    why: "Don't waste a Saturday entering old tickets by hand. Upload a stack of photos or a PDF, AI pulls the data, you approve. The backlog is gone in minutes — not hours.",
    proTip: "Clean photos work best. If you have paper tickets, stack them on a white surface and shoot them in daylight. Way cleaner than crumpled cab photos.",
    tiers: FLEET_PLUS,
    cta: 'Import Tickets',
    href: '/dashboard/tickets',
    estimatedMinutes: 5,
    validate: async (supabase, companyId) => {
      // Generous validation: if they have any tickets, they've done this
      const { count } = await supabase
        .from('loads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
    manualComplete: true,
  },

  // ── 12. Documents (Fleet+) ───────────────────────────────────────────────────
  {
    id: 'documents',
    title: 'Set up document storage',
    emoji: '📁',
    why: "Every invoice, every ticket photo, every signed agreement — one place. The day an owner asks for a ticket from three months ago, you pull it up in 10 seconds instead of digging through a glovebox.",
    proTip: "Upload your insurance cert and DOT paperwork first. Those are the documents you get asked for most and never want to hunt for.",
    tiers: FLEET_PLUS,
    cta: 'Go to Documents',
    href: '/dashboard/documents',
    estimatedMinutes: 3,
    validate: async (supabase, companyId) => {
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
    manualComplete: true,
  },

  // ── 13. CRM Pipeline (Growth only) ──────────────────────────────────────────
  {
    id: 'crm_pipeline',
    title: 'Set up your CRM pipeline',
    emoji: '📊',
    why: "Most operators lose track of leads in text threads. The pipeline turns 'I gotta follow up with that GC' into a daily task list. One lead you convert pays for this software for a year.",
    proTip: "Start with the last 3 GCs you talked to but didn't close. Add them right now. That follow-up is money sitting on the table.",
    tiers: GROWTH,
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

  // ── 14. First Quote (Growth only) ────────────────────────────────────────────
  {
    id: 'first_quote',
    title: 'Create your first quote',
    emoji: '💼',
    why: "Quotes turn into jobs, jobs turn into tickets, tickets turn into invoices. Track every dollar from the first conversation. Win rate goes up when you actually follow up.",
    proTip: "Send quotes same day you talk to a client. Contractors move fast — if your quote isn't there in 24 hours, someone else's is.",
    tiers: GROWTH,
    cta: 'Go to CRM',
    href: '/dashboard/crm',
    estimatedMinutes: 3,
    validate: async () => false,
    manualComplete: true,
  },

  // ── 15. First Ticket ─────────────────────────────────────────────────────────
  {
    id: 'first_ticket',
    title: 'Submit your first real ticket',
    emoji: '🎫',
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

  // ── 16. First Invoice ────────────────────────────────────────────────────────
  {
    id: 'first_invoice',
    title: 'Send your first real invoice',
    emoji: '💰',
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

  // ── 17. Tour Dashboard ───────────────────────────────────────────────────────
  {
    id: 'tour_dashboard',
    title: 'Check out your dashboard',
    emoji: '📈',
    why: "Money This Week, Outstanding, and Lost Revenue — these are the three numbers that matter. Check them every morning with your coffee. You stop guessing and start running the business.",
    proTip: "The 'Lost Revenue' number is the one that'll sting the first time you see it. That's the point — now you can fix it.",
    tiers: ALL,
    cta: 'Go to Dashboard',
    href: '/dashboard',
    estimatedMinutes: 2,
    validate: async (supabase, companyId) => {
      // They've toured the dashboard if they've sent an invoice (they navigated to /dashboard/invoices)
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return (count ?? 0) >= 1
    },
    manualComplete: true,
  },

  // ── 18. Notifications ────────────────────────────────────────────────────────
  {
    id: 'notifications',
    title: 'Set your notification preferences',
    emoji: '🔔',
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

/** Total estimated minutes for a tier's steps */
export function estimatedMinutes(plan: string | null | undefined): number {
  return getStepsForPlan(plan).reduce((sum, s) => sum + s.estimatedMinutes, 0)
}
