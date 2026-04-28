'use client'

import { useState, useEffect } from 'react'
import { Bell, Truck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DriverNotification } from '@/lib/types'

type Props = {
  children: React.ReactNode
  driverName: string
}

export default function DriverLayoutClient({ children, driverName }: Props) {
  const [notifications, setNotifications] = useState<DriverNotification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    async function fetchNotifs() {
      const supabase = createClient()
      const { data } = await supabase
        .from('driver_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data ?? [])
    }
    fetchNotifs()
  }, [])

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    const supabase = createClient()
    await supabase.from('driver_notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-[#1e3a2a] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#2d7a4f] flex items-center justify-center">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm">DumpTruckBoss</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-sm">{driverName}</span>
          <button
            onClick={() => { setShowNotifs(true); markAllRead() }}
            className="relative h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notification slide-over */}
      {showNotifs && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotifs(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              <button onClick={() => setShowNotifs(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No notifications yet</p>
              ) : notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-green-50' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                      n.type === 'approval' ? 'bg-green-500' :
                      n.type === 'modification' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm text-gray-800">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
