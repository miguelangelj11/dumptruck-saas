'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'

const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`
const fmtFull = (v: number) => `$${Number(v).toLocaleString()}`

function useAccentColor() {
  const [color, setColor] = useState('#2d7a4f')
  useEffect(() => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--hf-sidebar-accent').trim()
    if (c) setColor(c)
  }, [])
  return color
}

export function RevenueByDriverChart({ data }: { data: { name: string; revenue: number }[] }) {
  const accent = useAccentColor()
  if (!data.length) return <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmt} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [fmtFull(Number(v)), 'Revenue']} />
        <Bar dataKey="revenue" fill={accent} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RevenueByMonthChart({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  const accent = useAccentColor()
  if (!data.length) return <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmt} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [fmtFull(Number(v))]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2} dot={false} name="Revenue" />
        <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function LoadsPerDayChart({ data }: { data: { day: string; loads: number }[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [v, 'Loads']} />
        <Line type="monotone" dataKey="loads" stroke="#3b82f6" strokeWidth={2} dot={false} name="Loads" />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function RevenueByJobChart({ data }: { data: { name: string; revenue: number }[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmt} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v) => [fmtFull(Number(v)), 'Revenue']} />
        <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
