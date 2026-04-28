'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Is there really no credit card required for the free trial?',
    a: "Correct. You can start your 14-day free trial with just an email address. We won't ask for payment information until you decide to subscribe.",
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes, you can upgrade or downgrade your plan at any time from your account settings. Upgrades take effect immediately; downgrades apply at the next billing cycle.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: "Your data stays accessible for 30 days after cancellation so you can export anything you need. After that it's permanently deleted from our servers.",
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — annual billing saves you 20% compared to month-to-month. You can switch to annual billing from the Billing section of your account settings.',
  },
  {
    q: 'Is there a limit on how many tickets I can create?',
    a: "Starter plans include 100 tickets per month. Pro and Enterprise plans have unlimited ticket creation. If you're close to your limit we'll notify you before you hit it.",
  },
  {
    q: 'Can drivers use DumpTruckBoss on their phones?',
    a: 'Yes. Drivers have a dedicated mobile-optimized portal where they can view their assignments, submit load tickets, and see their earnings — no app download required.',
  },
  {
    q: "What's the difference between the Starter and Pro plans?",
    a: 'Starter is designed for owner-operators with up to 3 drivers and 100 tickets per month. Pro removes all those limits, adds full dispatch management, subcontractor support, expense tracking, and priority support.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-24 bg-white" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[#2d7a4f] uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Frequently asked questions
          </h2>
          <p className="text-gray-500 text-lg">
            Can't find what you're looking for?{' '}
            <a href="mailto:support@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">
              Reach out to our team.
            </a>
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
