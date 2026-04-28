'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type DataPoint = { month: string; current: number; previous: number }

export default function LoadsChart({ data }: { data: DataPoint[] }) {
  const [accentColor, setAccentColor] = useState('#2d7a4f')

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--hf-sidebar-accent').trim()
    if (color) setAccentColor(color)
  }, [])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[220px] text-gray-300 text-sm">
        No load data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(v) => [Number(v), '']}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="current"  stroke={accentColor} strokeWidth={2} dot={false} name="This year" />
        <Line type="monotone" dataKey="previous" stroke="#9ca3af" strokeWidth={2} dot={false} strokeDasharray="4 4" name="Last year" />
      </LineChart>
    </ResponsiveContainer>
  )
}
