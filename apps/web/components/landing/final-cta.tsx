import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="py-24 bg-[#0f1923]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to stop the paper chaos?
          </h2>
          <p className="text-white/60 text-xl mb-10">
            Join hundreds of dump truck operators already using DumpTruckBoss to run tighter, faster, and more profitable operations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2d7a4f] px-8 py-4 text-base font-semibold text-white hover:bg-[#245f3e] transition-all hover:shadow-lg hover:shadow-[#2d7a4f]/25"
            >
              Start Free 14-Day Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="mailto:sales@dumptruckboss.com"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/5 transition-colors"
            >
              Talk to Sales
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            {['No credit card required', '14-day free trial', 'Cancel anytime'].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#4ade80]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
