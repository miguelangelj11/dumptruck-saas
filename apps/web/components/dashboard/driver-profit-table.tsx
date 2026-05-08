'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { DriverProfitability } from '@/lib/types'

const MAX_ROWS = 8

function fmt(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`
}

export function DriverProfitTable({ companyId }: { companyId: string }) {
  const [drivers, setDrivers] = useState<DriverProfitability[] | null>(null)

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/driver-profitability')
      if (!res.ok) return
      const { drivers: data } = await res.json() as { drivers: DriverProfitability[] }
      setDrivers(data)
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchDrivers()
  }, [companyId, fetchDrivers])

  if (!drivers) return null
  if (drivers.length === 0) return null

  const shown = drivers.slice(0, MAX_ROWS)
  const remaining = drivers.length - MAX_ROWS

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">Top Drivers by Revenue</h2>
        <Link href="/dashboard/drivers" className="text-xs text-[var(--brand-primary)] font-medium hover:underline">
          View all
        </Link>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-5 py-2.5 font-medium">#</th>
              <th className="text-left px-5 py-2.5 font-medium">Driver</th>
              <th className="text-right px-5 py-2.5 font-medium">Revenue</th>
              <th className="text-right px-5 py-2.5 font-medium">Per Job</th>
              <th className="text-right px-5 py-2.5 font-medium">Jobs</th>
              <th className="text-right px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {shown.map((d, i) => (
              <tr
                key={d.driverId}
                className={`hover:bg-gray-50/50 transition-colors ${
                  d.isBelowAverage ? 'bg-red-50/30' : ''
                }`}
              >
                <td className="px-5 py-3">
                  <div className="h-6 w-6 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-[10px] font-bold text-white">
                    {i + 1}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900">{d.driverName}</span>
                    {d.isTopPerformer && <span className="text-sm" title="Top performer">⭐</span>}
                    {d.isBelowAverage && (
                      <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
                        ⚠️ Below avg
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-[var(--brand-primary)]">
                  {fmt(d.totalRevenue)}
                </td>
                <td className="px-5 py-3 text-right text-gray-600">
                  {fmt(d.profitPerLoad)}
                </td>
                <td className="px-5 py-3 text-right text-gray-500">
                  {d.loadsCount}
                </td>
                <td className="px-5 py-3 text-right" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden divide-y divide-gray-50">
        {shown.map((d, i) => (
          <div
            key={d.driverId}
            className={`flex items-center gap-3 px-4 py-3 ${d.isBelowAverage ? 'bg-red-50/30' : ''}`}
          >
            <div className="h-8 w-8 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-sm font-medium text-gray-900 truncate">{d.driverName}</p>
                {d.isTopPerformer && <span className="text-xs">⭐</span>}
                {d.isBelowAverage && (
                  <span className="text-[10px] text-red-600 font-medium">⚠️ Below avg</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{d.loadsCount} jobs · {fmt(d.profitPerLoad)}/job</p>
            </div>
            <span className="text-sm font-semibold text-[var(--brand-primary)] shrink-0">{fmt(d.totalRevenue)}</span>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="px-5 py-3 border-t border-gray-50">
          <Link href="/dashboard/drivers" className="text-xs text-[var(--brand-primary)] hover:underline">
            +{remaining} more driver{remaining !== 1 ? 's' : ''} → View all
          </Link>
        </div>
      )}
    </div>
  )
}
