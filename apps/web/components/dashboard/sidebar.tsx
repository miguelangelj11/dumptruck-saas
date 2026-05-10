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
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Clipboard,
  Lock,
  Kanban,
  FolderOpen,
  GripVertical,
  LucideIcon,
  HelpCircle,
} from 'lucide-react'
import { OPEN_CHECKLIST_EVENT } from '@/components/onboarding-checklist'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import CompanyAvatar from '@/components/dashboard/company-avatar'
import { clearCompanyIdCache } from '@/lib/get-company-id'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LanguageSelector from '@/components/language-selector'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = {
  user: { email?: string; user_metadata?: { company_name?: string; full_name?: string; name?: string } }
  logoUrl?: string | null
  companyName?: string | null
  profileName?: string | null
  plan?: string | null
  isSuperAdmin?: boolean
  navOrder?: string[] | null
  pendingReceivedCount?: number
}

type NavItem = {
  id: string
  href: string
  icon: LucideIcon
  label: string
  locked: boolean
  badge?: number
}

const DEFAULT_NAV_ORDER = [
  'dashboard',
  'dispatch',
  'tickets',
  'contractors',
  'drivers',
  'invoices',
  'revenue',
  'expenses',
  'crm',
  'documents',
]

// Individual draggable nav item
function SortableNavItem({
  item,
  active,
  onClose,
  draggingId,
}: {
  item: NavItem
  active: boolean
  onClose: () => void
  draggingId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const Icon = item.icon

  if (item.locked) {
    return (
      <div ref={setNodeRef} style={style} className="relative group flex items-center">
        <span
          {...attributes}
          {...listeners}
          className="absolute left-0 flex items-center justify-center w-6 h-full opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
        </span>
        <Link
          href="/dashboard/settings#billing"
          onClick={onClose}
          className="flex flex-1 items-center gap-3 rounded-lg pl-7 pr-3 py-2.5 text-sm font-medium text-white/30 hover:text-white/50 transition-all"
          title="Upgrade to unlock"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          <Lock className="h-3 w-3 shrink-0 text-[#F5B731]/60" />
        </Link>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group flex items-center">
      <span
        {...attributes}
        {...listeners}
        className="absolute left-0 flex items-center justify-center w-6 h-full opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing touch-none z-10"
      >
        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
      </span>
      <Link
        href={item.href}
        onClick={onClose}
        className={`flex flex-1 items-center gap-3 rounded-lg pl-7 pr-3 py-2.5 text-sm font-medium transition-all ${
          active
            ? 'bg-[#F5B731]/15 text-[#F5B731]'
            : 'text-white/60 hover:text-white hover:bg-white/8'
        } ${draggingId ? 'pointer-events-none' : ''}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#F5B731]' : ''}`} />
        <span className="flex-1">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold bg-[#F5B731] text-[#1e3a2a] rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    </div>
  )
}

// Ghost overlay shown while dragging
function DragGhostItem({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <div className="flex items-center gap-3 rounded-lg pl-7 pr-3 py-2.5 text-sm font-medium bg-[#F5B731]/20 text-[#F5B731] shadow-xl ring-1 ring-[#F5B731]/30 cursor-grabbing">
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </div>
  )
}

export default function Sidebar({ user, logoUrl, companyName: companyNameProp, profileName, plan, isSuperAdmin, navOrder, pendingReceivedCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const t = useTranslations('nav')

  // Build the full nav item definitions (locked state depends on plan/role)
  const buildNavDefs = useCallback((): NavItem[] => {
    const solo = !isSuperAdmin && plan === 'solo'
    return [
      { id: 'dashboard',    href: '/dashboard',             icon: LayoutDashboard, label: t('dashboard'),     locked: false },
      { id: 'dispatch',     href: '/dashboard/dispatch',    icon: Clipboard,       label: t('dispatch'),      locked: solo, badge: pendingReceivedCount && pendingReceivedCount > 0 ? pendingReceivedCount : undefined },
      { id: 'tickets',      href: '/dashboard/tickets',     icon: FileText,        label: t('tickets'),       locked: false },
      { id: 'contractors',  href: '/dashboard/contractors', icon: Truck,           label: t('subcontractors'),locked: !isSuperAdmin && (plan === 'owner_operator' || plan === 'solo') },
      { id: 'drivers',      href: '/dashboard/drivers',     icon: Users,           label: t('drivers'),       locked: false },
      { id: 'invoices',     href: '/dashboard/invoices',    icon: Receipt,         label: t('invoices'),      locked: false },
      { id: 'revenue',      href: '/dashboard/revenue',     icon: TrendingUp,      label: t('revenue'),       locked: !isSuperAdmin && (plan === 'solo' || plan === 'owner_operator') },
      { id: 'expenses',     href: '/dashboard/expenses',    icon: Wallet,          label: t('expenses'),      locked: solo },
      { id: 'crm',          href: '/dashboard/crm',         icon: Kanban,          label: t('crm'),           locked: !isSuperAdmin && plan !== 'growth' && plan !== 'enterprise' },
      { id: 'documents',    href: '/dashboard/documents',   icon: FolderOpen,      label: 'Documents',        locked: !isSuperAdmin && (plan === 'solo' || plan === 'owner_operator') },
    ]
  }, [t, plan, isSuperAdmin])

  const [navDefs, setNavDefs] = useState<NavItem[]>(() => buildNavDefs())
  const [itemOrder, setItemOrder] = useState<string[]>(() => {
    if (navOrder && Array.isArray(navOrder) && navOrder.length > 0) {
      return [
        ...navOrder.filter(id => DEFAULT_NAV_ORDER.includes(id)),
        ...DEFAULT_NAV_ORDER.filter(id => !navOrder.includes(id)),
      ]
    }
    return DEFAULT_NAV_ORDER
  })

  // Rebuild nav defs when plan/role changes
  useEffect(() => { setNavDefs(buildNavDefs()) }, [buildNavDefs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggingId(null)
    if (!over || active.id === over.id) return

    const oldIndex = itemOrder.indexOf(active.id as string)
    const newIndex = itemOrder.indexOf(over.id as string)
    const newOrder = arrayMove(itemOrder, oldIndex, newIndex)
    setItemOrder(newOrder)

    try {
      await fetch('/api/company/nav-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nav_order: newOrder }),
      })
    } catch {
      // silent — order still updated locally
    }
  }

  const companyName = companyNameProp || user.user_metadata?.company_name || ''

  async function handleLogout() {
    setLoggingOut(true)
    clearCompanyIdCache()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const orderedItems = itemOrder
    .map(id => navDefs.find(d => d.id === id))
    .filter(Boolean) as NavItem[]

  const draggingItem = draggingId ? navDefs.find(d => d.id === draggingId) : null

  const settingsActive = pathname.startsWith('/dashboard/settings')

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-white/10">
        <Image src="/dtb-logo.png" alt="DumpTruckBoss" width={150} height={50} className="object-contain" />
      </div>

      {/* Draggable nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {orderedItems.map(item => (
                <SortableNavItem
                  key={item.id}
                  item={item}
                  active={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  onClose={() => setMobileOpen(false)}
                  draggingId={draggingId}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {draggingItem ? <DragGhostItem item={draggingItem} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Settings — always pinned, never draggable */}
        <div className="mt-1 border-t border-white/8 pt-1">
          <Link
            href="/dashboard/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              settingsActive
                ? 'bg-[#F5B731]/15 text-[#F5B731]'
                : 'text-white/60 hover:text-white hover:bg-white/8'
            }`}
          >
            <Settings className={`h-4 w-4 shrink-0 ${settingsActive ? 'text-[#F5B731]' : ''}`} />
            {t('settings')}
          </Link>
        </div>
      </nav>

      {/* User / logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-2">
          <CompanyAvatar logoUrl={logoUrl} name={companyName} size={32} bg="var(--hf-sidebar-accent)" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white truncate">{profileName || companyName}</p>
              {isSuperAdmin && (
                <span className="shrink-0 text-[9px] font-bold bg-yellow-400/20 text-yellow-300 px-1.5 py-0.5 rounded-full">👑 Owner</span>
              )}
            </div>
            <p className="text-[10px] text-white/50 truncate">{user.email}</p>
          </div>
        </div>
        <LanguageSelector />
        <button
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CHECKLIST_EVENT))}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all mb-0.5"
        >
          <HelpCircle className="h-4 w-4" />
          Setup guide
        </button>
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
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
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
