import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import PricingSection from '@/components/landing/pricing-section'
import { CheckCircle } from 'lucide-react'

export const metadata = {
  title: 'Pricing — DumpTruckBoss',
}

const faq = [
  { q: 'Is there a free trial?', a: 'Yes — 14 days free, no credit card required. Try the full Pro plan and decide after.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing cycle.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data stays in the system for 30 days after cancellation. Export everything before then.' },
  { q: 'Do you offer discounts for annual billing?', a: 'Yes — pay annually and get 2 months free on any plan. Contact us to switch.' },
  { q: 'Is there a limit on load tickets?', a: 'No. All plans include unlimited load ticket creation.' },
]

export default function PricingPage() {
  return (
    <div className="bg-white">
      <Nav />
      <div className="pt-24 bg-[#0f1923]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Pay for what you need
          </h1>
          <p className="text-white/60 text-lg">Simple pricing. No hidden fees. Cancel anytime.</p>
        </div>
      </div>

      <PricingSection />

      {/* FAQ */}
      <div className="py-24 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Frequently asked questions</h2>
          <div className="space-y-6">
            {faq.map((item) => (
              <div key={item.q} className="border-b border-gray-100 pb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
