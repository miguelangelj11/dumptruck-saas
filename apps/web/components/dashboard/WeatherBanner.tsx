'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function WeatherBanner() {
  const [alert, setAlert] = useState<string | null>(null)

  useEffect(() => {
    // Atlanta default coords
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=33.749&longitude=-84.388&daily=precipitation_sum,weathercode&forecast_days=3&timezone=America/New_York'
    )
      .then(r => r.json())
      .then(data => {
        const codes: number[] = data.daily?.weathercode ?? []
        const precip: number[] = data.daily?.precipitation_sum ?? []
        const hasStorm = codes.some(c => c >= 61)
        const hasRain  = precip.some(p => p > 3)
        if (hasStorm) {
          setAlert('⛈️ Storms expected in the next 3 days — may affect haul schedules.')
        } else if (hasRain) {
          setAlert('🌧️ Rain expected in the next 3 days — check job site conditions.')
        }
      })
      .catch(() => {})
  }, [])

  if (!alert) return null

  return (
    <div className="mb-4 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
      <p className="text-sm text-blue-800 font-medium">{alert}</p>
      <Link
        href="/dashboard/dispatch"
        className="text-xs text-blue-600 font-bold hover:underline flex-shrink-0 ml-4"
      >
        Review dispatches →
      </Link>
    </div>
  )
}
