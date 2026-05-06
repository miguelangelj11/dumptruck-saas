'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export type ChartPoint = { label: string; revenue: number }

type Props = {
  week:  ChartPoint[]
  month: ChartPoint[]
  year:  ChartPoint[]
}

const VIEWS = ['This Week', 'This Month', 'This Year'] as const
type View = typeof VIEWS[number]

function fmtAxis(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

function useBrandColor() {
  const [color, setColor] = useState('#2d7a4f')
  useEffect(() => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim()
    if (c) setColor(c)
  }, [])
  return color
}

export default function LoadsChart({ week, month, year }: Props) {
  const [view, setView] = useState<View>('This Week')
  const brandColor = useBrandColor()
  const data = view === 'This Week' ? week : view === 'This Month' ? month : year
  const hasData = data.some(d => d.revenue > 0)

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v
                ? 'bg-[var(--brand-dark)] text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-gray-300 text-sm">
          No revenue data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={fmtAxis}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
              cursor={{ fill: '#f0fdf4' }}
            />
            <Bar dataKey="revenue" fill={brandColor} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
