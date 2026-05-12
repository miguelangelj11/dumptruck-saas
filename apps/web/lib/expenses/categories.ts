export type ExpenseCategory = {
  id: string
  label: string
  emoji: string
  color: string
}

// IDs match stored DB values (backward-compatible with existing data)
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'Fuel',                 label: 'Fuel',                      emoji: '⛽', color: 'bg-orange-100 text-orange-700' },
  { id: 'DEF',                  label: 'DEF',                       emoji: '🔵', color: 'bg-blue-100 text-blue-700' },
  { id: 'Tires',                label: 'Tires',                     emoji: '🔄', color: 'bg-gray-100 text-gray-700' },
  { id: 'Maintenance',          label: 'Maintenance',               emoji: '🔧', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'Repairs',              label: 'Repairs',                   emoji: '🛠️', color: 'bg-red-100 text-red-700' },
  { id: 'Insurance',            label: 'Insurance',                 emoji: '🛡️', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'Labor',                label: 'Labor',                     emoji: '👷', color: 'bg-purple-100 text-purple-700' },
  { id: 'Equipment',            label: 'Equipment',                 emoji: '🚜', color: 'bg-green-100 text-green-700' },
  { id: 'Tolls',                label: 'Tolls',                     emoji: '🛣️', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'Permits',              label: 'Permits / Registration',    emoji: '📋', color: 'bg-teal-100 text-teal-700' },
  { id: 'IFTA',                 label: 'IFTA',                      emoji: '🗺️', color: 'bg-slate-100 text-slate-700' },
  { id: 'Licenses',             label: 'Licenses',                  emoji: '🪪', color: 'bg-violet-100 text-violet-700' },
  { id: 'Office',               label: 'Office',                    emoji: '🖥️', color: 'bg-pink-100 text-pink-700' },
  { id: 'Software',             label: 'Software',                  emoji: '💻', color: 'bg-sky-100 text-sky-700' },
  { id: 'Professional',         label: 'Professional Services',     emoji: '💼', color: 'bg-amber-100 text-amber-700' },
  { id: 'Meals',                label: 'Meals (50% deductible)',    emoji: '🍔', color: 'bg-rose-100 text-rose-700' },
  { id: 'Other',                label: 'Other',                     emoji: '📦', color: 'bg-gray-100 text-gray-600' },
]

export function getCategoryConfig(id: string): ExpenseCategory {
  return EXPENSE_CATEGORIES.find(c => c.id === id) ?? { id, label: id, emoji: '📦', color: 'bg-gray-100 text-gray-600' }
}
