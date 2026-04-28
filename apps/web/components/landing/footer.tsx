import Link from 'next/link'
import { Truck } from 'lucide-react'

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Changelog', href: '#' },
]

export default function Footer() {
  return (
    <footer className="bg-[#0f1923] border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-[#2d7a4f] flex items-center justify-center">
                <Truck className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-white">DumpTruckBoss</span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed">DumpTruckBoss — Run Your Business Smarter.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/40 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              {['About', 'Blog', 'Careers'].map((l) => (
                <li key={l}><Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              {['Privacy', 'Terms', 'Security'].map((l) => (
                <li key={l}><Link href="#" className="text-sm text-white/40 hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/30">© {new Date().getFullYear()} DumpTruckBoss, Inc. All rights reserved.</p>
          <p className="text-sm text-white/30">Built for the operators who get it done.</p>
        </div>
      </div>
    </footer>
  )
}
