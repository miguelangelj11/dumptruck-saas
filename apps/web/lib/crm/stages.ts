export const PIPELINE_STAGES = [
  {
    id:          'new_lead',
    label:       'New Lead',
    color:       '#6B7280',
    bgColor:     '#F9FAFB',
    textClass:   'text-gray-600',
    bgClass:     'bg-gray-50',
    borderClass: 'border-gray-200',
    emoji:       '📥',
    description: 'Fresh lead, not yet contacted',
  },
  {
    id:          'contacted',
    label:       'Contacted',
    color:       '#3B82F6',
    bgColor:     '#EFF6FF',
    textClass:   'text-blue-700',
    bgClass:     'bg-blue-50',
    borderClass: 'border-blue-200',
    emoji:       '📞',
    description: 'Reached out, awaiting response',
  },
  {
    id:          'quoted',
    label:       'Quoted',
    color:       '#F59E0B',
    bgColor:     '#FFFBEB',
    textClass:   'text-amber-700',
    bgClass:     'bg-amber-50',
    borderClass: 'border-amber-200',
    emoji:       '📋',
    description: 'Quote sent, pending decision',
  },
  {
    id:          'negotiating',
    label:       'Negotiating',
    color:       '#8B5CF6',
    bgColor:     '#F5F3FF',
    textClass:   'text-purple-700',
    bgClass:     'bg-purple-50',
    borderClass: 'border-purple-200',
    emoji:       '🤝',
    description: 'In active negotiation',
  },
  {
    id:          'scheduled',
    label:       'Scheduled',
    color:       '#06B6D4',
    bgColor:     '#ECFEFF',
    textClass:   'text-cyan-700',
    bgClass:     'bg-cyan-50',
    borderClass: 'border-cyan-200',
    emoji:       '📅',
    description: 'Job confirmed, start date set',
  },
  {
    id:          'active_job',
    label:       'Active Job',
    color:       '#10B981',
    bgColor:     '#ECFDF5',
    textClass:   'text-emerald-700',
    bgClass:     'bg-emerald-50',
    borderClass: 'border-emerald-200',
    emoji:       '🚛',
    description: 'Currently hauling',
  },
  {
    id:          'won',
    label:       'Won',
    color:       '#059669',
    bgColor:     '#D1FAE5',
    textClass:   'text-green-700',
    bgClass:     'bg-green-100',
    borderClass: 'border-green-200',
    emoji:       '🏆',
    description: 'Job completed successfully',
  },
  {
    id:          'lost',
    label:       'Lost',
    color:       '#EF4444',
    bgColor:     '#FEF2F2',
    textClass:   'text-red-700',
    bgClass:     'bg-red-50',
    borderClass: 'border-red-200',
    emoji:       '❌',
    description: 'Lead lost or cancelled',
  },
] as const

export type StageId = typeof PIPELINE_STAGES[number]['id']

export const ACTIVE_STAGES = PIPELINE_STAGES.filter(s => s.id !== 'won' && s.id !== 'lost')
export const CLOSED_STAGES = PIPELINE_STAGES.filter(s => s.id === 'won' || s.id === 'lost')

export function getStage(id: string) {
  return PIPELINE_STAGES.find(s => s.id === id) ?? PIPELINE_STAGES[0]!
}

// Map legacy status values to new stage ids
export function normalizeStage(lead: { stage?: string | null; status?: string | null }): StageId {
  const s = lead.stage || lead.status
  if (!s) return 'new_lead'
  if (s === 'new') return 'new_lead'
  const match = PIPELINE_STAGES.find(p => p.id === s)
  return match ? match.id : 'new_lead'
}

export const JOB_TYPES = [
  { id: 'asphalt_hauling', label: 'Asphalt Hauling',  emoji: '🛣️' },
  { id: 'grading',         label: 'Grading / Site Work', emoji: '🏗️' },
  { id: 'driveway',        label: 'Driveway',          emoji: '🏠' },
  { id: 'demolition',      label: 'Demolition',        emoji: '💥' },
  { id: 'fill_dirt',       label: 'Fill Dirt',         emoji: '⛰️' },
  { id: 'stone',           label: 'Stone / Gravel',    emoji: '🪨' },
  { id: 'mulch',           label: 'Mulch / Topsoil',   emoji: '🌱' },
  { id: 'concrete',        label: 'Concrete',          emoji: '🏢' },
  { id: 'other',           label: 'Other',             emoji: '📦' },
] as const

export const LEAD_SOURCES = [
  { id: 'referral',         label: 'Referral',         emoji: '👥' },
  { id: 'repeat_customer',  label: 'Repeat Customer',  emoji: '⭐' },
  { id: 'broker',           label: 'Broker',           emoji: '🤝' },
  { id: 'google',           label: 'Google',           emoji: '🔍' },
  { id: 'facebook',         label: 'Facebook',         emoji: '📘' },
  { id: 'website',          label: 'Website',          emoji: '🌐' },
  { id: 'cold_call',        label: 'Cold Call',        emoji: '📞' },
  { id: 'other',            label: 'Other',            emoji: '📋' },
] as const

export const PRIORITY_CONFIG = {
  urgent: { label: '🚨 Urgent', bgClass: 'bg-red-100',    textClass: 'text-red-700'    },
  high:   { label: '⬆️ High',   bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  medium: { label: '➡️ Med',    bgClass: 'bg-gray-100',   textClass: 'text-gray-600'   },
  low:    { label: '⬇️ Low',    bgClass: 'bg-blue-50',    textClass: 'text-blue-500'   },
} as const

export function computeLeadScore(lead: {
  estimated_revenue?: number | null
  source?: string | null
  phone?: string | null
  email?: string | null
  last_contacted_at?: string | null
  next_follow_up_at?: string | null
  stage?: string | null
  status?: string | null
}): number {
  let score = 50

  // Revenue size
  const rev = lead.estimated_revenue ?? 0
  if (rev > 10000)     score += 15
  else if (rev > 5000) score += 10
  else if (rev > 1000) score += 5

  // Source quality
  if (lead.source === 'repeat_customer') score += 20
  else if (lead.source === 'referral')   score += 15
  else if (lead.source === 'broker')     score += 10

  // Contact info
  if (lead.phone) score += 5
  if (lead.email) score += 5

  // Recency
  if (lead.last_contacted_at) {
    const days = Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000)
    if (days < 2)       score += 10
    else if (days > 14) score -= 20
    else if (days > 7)  score -= 10
  }

  if (lead.next_follow_up_at) score += 5

  // Stage progression
  const stageBonus: Record<string, number> = {
    new_lead: 0, contacted: 5, quoted: 10, negotiating: 15, scheduled: 20, active_job: 25,
  }
  const stage = normalizeStage(lead)
  score += stageBonus[stage] ?? 0

  return Math.min(100, Math.max(0, score))
}

export function scoreColor(score: number) {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-400'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-500'
}

export function scoreBadgeClass(score: number) {
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 60) return 'bg-yellow-100 text-yellow-700'
  if (score >= 40) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}
