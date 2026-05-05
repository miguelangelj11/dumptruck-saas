'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ProfitAlert } from '@/lib/types'

const FIVE_MINUTES = 5 * 60 * 1000

export function ProfitAlerts({ companyId }: { companyId: string }) {
  const [alerts, setAlerts] = useState<ProfitAlert[] | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/profit-alerts')
      if (!res.ok) return
      const { alerts: data } = await res.json() as { alerts: ProfitAlert[] }
      setAlerts(data)
    } catch {
      // silently fail — this is a non-critical enhancement
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, FIVE_MINUTES)
    return () => clearInterval(id)
  }, [companyId, fetchAlerts])

  if (!alerts || alerts.length === 0) return null

  return (
    <div className="bg-white border border-red-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🚨</span>
        <h3 className="font-bold text-gray-900 text-sm">Profit Alerts</h3>
        <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>
      <div className="space-y-2">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              alert.severity === 'critical' ? 'bg-red-50' : 'bg-yellow-50'
            }`}
          >
            <span className="shrink-0 text-base">{alert.severity === 'critical' ? '🔴' : '⚠️'}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-snug">{alert.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{alert.description}</p>
              {alert.dollarImpact > 0 && (
                <p className="text-xs font-bold text-red-600 mt-0.5">
                  Impact: ${alert.dollarImpact.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
