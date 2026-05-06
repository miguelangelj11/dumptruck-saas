'use client'

type Props = {
  title: string
  description: string
  plan?: string
  price?: number
}

export default function LockedFeature({ title, description, plan = 'Growth', price = 300 }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <span className="text-7xl mb-6">🔒</span>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
      <p className="text-gray-600 mb-2 max-w-md leading-relaxed">{description}</p>
      <p className="text-sm font-semibold text-gray-500 mb-8">
        Requires the {plan} plan (${price}/mo)
      </p>
      <a
        href="/dashboard/settings?tab=billing"
        className="px-8 py-4 font-bold rounded-xl text-lg transition-colors hover:opacity-90"
        style={{ background: '#F5B731', color: '#1a1a1a' }}
      >
        Upgrade to {plan} — ${price}/mo →
      </a>
    </div>
  )
}
