import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { Truck } from 'lucide-react'

export const metadata = {
  title: 'About — DumpTruckBoss',
  description: 'Learn about DumpTruckBoss and our mission to help hauling companies run smarter.',
}

export default function AboutPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Our Story</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">About DumpTruckBoss</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Built by operators, for operators. We're on a mission to modernize the hauling industry.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col items-center gap-6 text-center mb-16">
            <div className="h-16 w-16 rounded-2xl bg-[#2d7a4f] flex items-center justify-center">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon</h2>
              <p className="text-gray-500 text-lg leading-relaxed max-w-md">
                We're putting together our story. Check back soon for updates on who we are and where we're headed.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-gray-600 text-sm leading-relaxed">
              Have questions? Reach us at{' '}
              <a href="mailto:hello@dumptruckboss.com" className="text-[#2d7a4f] font-medium hover:underline">
                hello@dumptruckboss.com
              </a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
