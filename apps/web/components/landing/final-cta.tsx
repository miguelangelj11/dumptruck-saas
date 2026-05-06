import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="py-16 md:py-24 bg-[#0f1923]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to stop the paper chaos?
          </h2>
          <p className="text-white/60 text-xl mb-10">
            Join hundreds of dump truck operators already using DumpTruckBoss to run tighter, faster, and more profitable operations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-base font-semibold transition-all hover:shadow-lg"
              style={{ background: '#F5B731', color: '#1a1a1a' }}
            >
              Start Free 14-Day Trial <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
            <Link
              href="mailto:sales@dumptruckboss.com"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/5 transition-colors"
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
