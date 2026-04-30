import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Blog — DumpTruckBoss',
  description: 'Tips, guides, and industry insights for dump truck and hauling companies.',
}

const posts = [
  {
    slug: '#',
    category: 'Operations',
    title: 'How to Stop Losing Money on Paper Tickets',
    excerpt:
      'Paper tickets get wet, torn, lost, and misread. For a hauling company running 10+ loads a day, even one missing ticket per week is thousands of dollars a year left on the table. Here\'s a practical system to close the gap.',
    author: 'Marcus Rivera',
    date: 'April 22, 2026',
    readTime: '6 min read',
    featured: true,
  },
  {
    slug: '#',
    category: 'Invoicing',
    title: '5 Ways Dump Truck Operators Can Invoice Faster',
    excerpt:
      'Most hauling companies are sitting on 2–3 weeks of unbilled work at any given time. These five changes to your invoicing workflow can cut that down to 48 hours — without hiring anyone new.',
    author: 'Priya Nair',
    date: 'April 10, 2026',
    readTime: '5 min read',
    featured: false,
  },
  {
    slug: '#',
    category: 'Business',
    title: 'Why Spreadsheets Are Costing Your Hauling Business',
    excerpt:
      'Spreadsheets feel free because you don\'t write a check for them. But between the hours spent updating them, the mistakes that slip through, and the invoices that never get sent, the real cost is significant.',
    author: 'Jordan Tate',
    date: 'March 28, 2026',
    readTime: '7 min read',
    featured: false,
  },
  {
    slug: '#',
    category: 'Dispatch',
    title: 'Driver Accountability Without the Micromanagement',
    excerpt:
      'The best operators know exactly what their drivers loaded, where, and when — without texting them every hour. This is how they set up their dispatch process to get visibility without the friction.',
    author: 'Marcus Rivera',
    date: 'March 14, 2026',
    readTime: '4 min read',
    featured: false,
  },
]

const categoryColors: Record<string, string> = {
  Operations: 'bg-[#dcfce7] text-[#15803d]',
  Invoicing:  'bg-[#dbeafe] text-[#1d4ed8]',
  Business:   'bg-[#fef9c3] text-[#854d0e]',
  Dispatch:   'bg-[#f3e8ff] text-[#7e22ce]',
}

export default function BlogPage() {
  const featured = posts[0]!
  const rest = posts.slice(1)

  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Insights</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Blog</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Practical advice for running a smarter hauling operation.
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">

          {/* Featured post */}
          <div className="mb-12">
            <Link
              href={featured.slug}
              className="group block bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl overflow-hidden border border-gray-100"
            >
              <div className="grid lg:grid-cols-2">
                <div className="bg-[#0f1923] min-h-[220px] flex items-center justify-center p-10">
                  <div className="text-center">
                    <div className="h-16 w-16 rounded-2xl bg-[#2d7a4f] flex items-center justify-center mx-auto mb-4">
                      <span className="text-white text-2xl font-bold">📋</span>
                    </div>
                    <p className="text-white/40 text-sm uppercase tracking-wider">Featured</p>
                  </div>
                </div>
                <div className="p-8 flex flex-col justify-center">
                  <span className={`self-start text-xs font-bold px-2.5 py-1 rounded-full mb-4 ${categoryColors[featured.category]}`}>
                    {featured.category}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-[#2d7a4f] transition-colors leading-snug">
                    {featured.title}
                  </h2>
                  <p className="text-gray-500 leading-relaxed mb-6">{featured.excerpt}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="font-medium text-gray-600">{featured.author}</span>
                    <span>·</span>
                    <span>{featured.date}</span>
                    <span>·</span>
                    <span>{featured.readTime}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Post grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => (
              <Link
                key={post.title}
                href={post.slug}
                className="group flex flex-col bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl overflow-hidden border border-gray-100"
              >
                <div className="bg-[#0f1923] h-36 flex items-center justify-center">
                  <span className="text-white/20 text-4xl">📝</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <span className={`self-start text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${categoryColors[post.category]}`}>
                    {post.category}
                  </span>
                  <h3 className="font-bold text-gray-900 mb-2 leading-snug group-hover:text-[#2d7a4f] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-4 border-t border-gray-100">
                    <span>{post.date}</span>
                    <span>{post.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}

            {/* Coming soon card */}
            <div className="flex flex-col bg-gray-50 rounded-2xl overflow-hidden border border-dashed border-gray-200">
              <div className="bg-gray-100 h-36 flex items-center justify-center">
                <span className="text-gray-300 text-4xl">✍️</span>
              </div>
              <div className="p-6 flex flex-col flex-1 items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-500 mb-1">More coming soon</p>
                <p className="text-xs text-gray-400">
                  We publish weekly. Email{' '}
                  <a href="mailto:hello@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">
                    hello@dumptruckboss.com
                  </a>{' '}
                  to get notified.
                </p>
              </div>
            </div>
          </div>

          {/* Newsletter CTA */}
          <div className="mt-16 bg-[#0f1923] rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Get the next one in your inbox</h2>
            <p className="text-white/50 mb-6 text-sm">Practical hauling business tips, no fluff.</p>
            <a
              href="mailto:hello@dumptruckboss.com?subject=Subscribe to DumpTruckBoss Blog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors text-sm"
              style={{ backgroundColor: '#2d7a4f' }}
            >
              Subscribe via email <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
