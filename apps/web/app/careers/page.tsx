import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { Briefcase } from 'lucide-react'

export const metadata = {
  title: 'Careers — DumpTruckBoss',
  description: 'Join the team building the future of dump truck and hauling software.',
}

export default function CareersPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Join Us</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Careers</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Help us build the software that keeps the hauling industry moving.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col items-center gap-6 text-center mb-16">
            <div className="h-16 w-16 rounded-2xl bg-[#2d7a4f] flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">No Open Roles Right Now</h2>
              <p className="text-gray-500 text-lg leading-relaxed max-w-md">
                We're a small team moving fast. We don't have open positions at the moment, but we're always
                interested in hearing from talented people who love building great products.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-1">Interested in working with us?</p>
            <p className="text-gray-500 text-sm">
              Send your resume and a short note to{' '}
              <a href="mailto:jobs@dumptruckboss.com" className="text-[#2d7a4f] font-medium hover:underline">
                jobs@dumptruckboss.com
              </a>{' '}
              — we read everything.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
