export const DOCUMENT_TYPES = [
  { id: 'coi',        label: 'Certificate of Insurance', emoji: '🛡️', color: 'bg-blue-100 text-blue-700',    hasExpiry: true  },
  { id: 'w9',         label: 'W-9 Form',                 emoji: '📋', color: 'bg-purple-100 text-purple-700', hasExpiry: false },
  { id: 'contract',   label: 'Contract / MSA',           emoji: '📄', color: 'bg-gray-100 text-gray-700',     hasExpiry: false },
  { id: 'lien_waiver',label: 'Lien Waiver',              emoji: '⚖️', color: 'bg-orange-100 text-orange-700', hasExpiry: false },
  { id: 'permit',     label: 'Permit / Registration',    emoji: '🪪', color: 'bg-teal-100 text-teal-700',     hasExpiry: true  },
  { id: 'dot_medical',label: 'DOT Medical Card',         emoji: '🏥', color: 'bg-red-100 text-red-700',       hasExpiry: true  },
  { id: 'cdl',        label: 'CDL Copy',                 emoji: '🚛', color: 'bg-yellow-100 text-yellow-700', hasExpiry: true  },
  { id: 'mvr',        label: 'Motor Vehicle Record',     emoji: '🚗', color: 'bg-amber-100 text-amber-700',   hasExpiry: false },
  { id: 'drug_test',  label: 'Drug Test Result',         emoji: '🧪', color: 'bg-green-100 text-green-700',   hasExpiry: false },
  { id: 'insurance',  label: 'Insurance Policy',         emoji: '📑', color: 'bg-indigo-100 text-indigo-700', hasExpiry: true  },
  { id: 'invoice',    label: 'Invoice',                  emoji: '🧾', color: 'bg-emerald-100 text-emerald-700',hasExpiry: false },
  { id: 'receipt',    label: 'Receipt',                  emoji: '🧾', color: 'bg-lime-100 text-lime-700',     hasExpiry: false },
  { id: 'bid',        label: 'Bid / Quote',              emoji: '💰', color: 'bg-cyan-100 text-cyan-700',     hasExpiry: true  },
  { id: 'ticket_photo',label: 'Ticket Photo',            emoji: '📸', color: 'bg-pink-100 text-pink-700',     hasExpiry: false },
  { id: 'uploaded',   label: 'Uploaded File',            emoji: '📁', color: 'bg-gray-100 text-gray-600',     hasExpiry: false },
  { id: 'other',      label: 'Other',                    emoji: '📦', color: 'bg-gray-50 text-gray-500',      hasExpiry: false },
] as const

export type DocumentTypeId = typeof DOCUMENT_TYPES[number]['id']

export const getDocType = (id: string | null | undefined) =>
  DOCUMENT_TYPES.find(t => t.id === id) ?? DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1]!

export const suggestDocType = (filename: string): DocumentTypeId => {
  const name = filename.toLowerCase()
  if (name.includes('coi') || name.includes('certificate') || (name.includes('insurance') && !name.includes('policy'))) return 'coi'
  if (name.includes('w9') || name.includes('w-9')) return 'w9'
  if (name.includes('contract') || name.includes('msa') || name.includes('agreement')) return 'contract'
  if (name.includes('lien') || name.includes('waiver')) return 'lien_waiver'
  if (name.includes('permit') || name.includes('registration')) return 'permit'
  if (name.includes('medical') || name.includes('dot')) return 'dot_medical'
  if (name.includes('cdl') || name.includes('license')) return 'cdl'
  if (name.includes('mvr') || name.includes('motor vehicle')) return 'mvr'
  if (name.includes('drug') || name.includes('test')) return 'drug_test'
  if (name.includes('insurance') || name.includes('policy')) return 'insurance'
  if (name.includes('invoice') || name.includes('inv-')) return 'invoice'
  if (name.includes('receipt')) return 'receipt'
  if (name.includes('bid') || name.includes('quote')) return 'bid'
  return 'other'
}

export function getExpiryStatus(expiryDate: string | null | undefined) {
  if (!expiryDate) return null
  const days = Math.floor((new Date(expiryDate + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (days < 0)   return { label: 'Expired',      color: 'bg-red-100 text-red-700',      urgent: true  }
  if (days <= 7)  return { label: `${days}d left`, color: 'bg-red-100 text-red-700',      urgent: true  }
  if (days <= 14) return { label: `${days}d left`, color: 'bg-orange-100 text-orange-700', urgent: true  }
  if (days <= 30) return { label: `${days}d left`, color: 'bg-amber-100 text-amber-700',  urgent: false }
  const d = new Date(expiryDate + 'T00:00:00')
  return { label: `Exp ${d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`, color: 'bg-gray-100 text-gray-500', urgent: false }
}
