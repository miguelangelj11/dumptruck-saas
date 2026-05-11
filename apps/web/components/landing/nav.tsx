'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing',  href: '/pricing' },
  { label: 'About',    href: '/about' },
  { label: 'FAQ',      href: '/#faq' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

  // Close on route-level hash navigation (tap a link)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [open])

  // Prevent body scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14 bg-[rgba(15,25,35,0.95)] backdrop-blur-[10px] border-b border-white/10">

        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
          <Image
            src="/dtb-logo.png"
            alt="DumpTruckBoss"
            width={150}
            height={50}
            className="object-contain"
            priority
          />
        </Link>

        {/* Desktop center links */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-gray-400 hover:text-white transition-colors no-underline"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop right buttons */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link href="/login" className="text-sm text-white no-underline hover:text-gray-300 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold no-underline px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
            style={{ backgroundColor: '#F5B731', color: '#1a1a1a' }}
          >
            Start Free Trial
          </Link>
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex items-center justify-center p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel */}
          <div className="fixed top-14 left-0 right-0 z-50 md:hidden bg-[#0f1923] border-b border-white/10 shadow-xl">
            <div className="flex flex-col px-4 py-4 gap-1">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-[15px] text-gray-300 hover:text-white py-3 border-b border-white/5 last:border-0 no-underline transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-center text-[15px] text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/10 transition-colors no-underline"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="text-center text-[15px] font-semibold text-white py-3 rounded-xl transition-colors no-underline"
                  style={{ backgroundColor: '#F5B731', color: '#1a1a1a' }}
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
