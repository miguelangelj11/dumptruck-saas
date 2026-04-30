import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { BookOpen } from 'lucide-react'

export const metadata = {
  title: 'Blog — DumpTruckBoss',
  description: 'Tips, guides, and industry insights for dump truck and hauling companies.',
}

export default function BlogPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Insights</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Blog</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Tips, guides, and industry insights to help you run a smarter hauling operation.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col items-center gap-6 text-center mb-16">
            <div className="h-16 w-16 rounded-2xl bg-[#2d7a4f] flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon</h2>
              <p className="text-gray-500 text-lg leading-relaxed max-w-md">
                We're working on articles to help you grow your business. Check back soon for our first posts.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-1">Want to be notified when we publish?</p>
            <p className="text-gray-500 text-sm">
              Email us at{' '}
              <a href="mailto:hello@dumptruckboss.com" className="text-[#2d7a4f] font-medium hover:underline">
                hello@dumptruckboss.com
              </a>{' '}
              and we'll add you to the list.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
