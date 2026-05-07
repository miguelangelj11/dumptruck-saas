'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Truck,
  Users,
  Receipt,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Clipboard,
  Lock,
  Kanban,
  FolderOpen,
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import CompanyAvatar from '@/components/dashboard/company-avatar'
import { clearCompanyIdCache } from '@/lib/get-company-id'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LanguageSelector from '@/components/language-selector'

type Props = {
  user: { email?: string; user_metadata?: { company_name?: string; full_name?: string; name?: string } }
  logoUrl?: string | null
  companyName?: string | null
  profileName?: string | null
  plan?: string | null
}

export default function Sidebar({ user, logoUrl, companyName: companyNameProp, profileName, plan }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const t = useTranslations('nav')

  const nav = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), locked: false },
    { href: '/dashboard/dispatch', icon: Clipboard, label: t('dispatch'), locked: false },
    { href: '/dashboard/tickets', icon: FileText, label: t('tickets'), locked: false },
    { href: '/dashboard/contractors', icon: Truck, label: t('subcontractors'), locked: plan === 'owner_operator' },
    { href: '/dashboard/drivers', icon: Users, label: t('drivers'), locked: false },
    { href: '/dashboard/invoices', icon: Receipt, label: t('invoices'), locked: false },
    { href: '/dashboard/revenue', icon: TrendingUp, label: t('revenue'), locked: false },
    { href: '/dashboard/crm', icon: Kanban, label: t('crm'), locked: plan !== 'growth' && plan !== 'enterprise' },
    { href: '/dashboard/documents', icon: FolderOpen, label: 'Documents', locked: false },
    { href: '/dashboard/settings', icon: Settings, label: t('settings'), locked: false },
  ]

  const companyName = companyNameProp || user.user_metadata?.company_name || ''

  async function handleLogout() {
    setLoggingOut(true)
    clearCompanyIdCache()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* App brand */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-white/10">
        <Image
          src="/dtb-logo.png"
          alt="DumpTruckBoss"
          width={150}
          height={50}
          className="object-contain"
        />
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label, locked }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          if (locked) {
            return (
              <Link
                key={href}
                href="/dashboard/settings#billing"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/30 hover:text-white/50 transition-all cursor-pointer"
                title="Upgrade to Fleet to unlock"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <Lock className="h-3 w-3 shrink-0 text-[#F5B731]/60" />
              </Link>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-[#F5B731]/15 text-[#F5B731]'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#F5B731]' : ''}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User / logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-2">
          <CompanyAvatar logoUrl={logoUrl} name={companyName} size={32} bg="var(--hf-sidebar-accent)" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{profileName || companyName}</p>
            <p className="text-[10px] text-white/50 truncate">{user.email}</p>
          </div>
        </div>
        <LanguageSelector />
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? t('signingOut') : t('signOut')}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 h-9 w-9 rounded-lg bg-[var(--hf-sidebar-bg)] flex items-center justify-center text-white shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-40 h-full w-64 bg-[var(--hf-sidebar-bg)] transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-[var(--hf-sidebar-bg)] h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  )
}
