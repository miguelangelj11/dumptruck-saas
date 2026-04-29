'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

const tabs = ['Dashboard', 'Dispatch', 'Tickets', 'Invoices'] as const
type Tab = typeof tabs[number]

function DashboardMockup() {
  return (
    <div className="flex-1 p-5 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total Loads', val: '1,284', color: 'bg-[#2d7a4f]/20' },
          { label: 'Revenue', val: '$84,320', color: 'bg-blue-500/20' },
          { label: 'Active Drivers', val: '12', color: 'bg-purple-500/20' },
          { label: 'Open Invoices', val: '34', color: 'bg-[#FFB800]/20' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
            <div className="h-1.5 w-12 rounded bg-white/20 mb-2" />
            <div className="text-sm font-bold text-white">{s.val}</div>
            <div className="text-[10px] text-white/40">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <div className="h-1.5 w-28 rounded bg-white/20 mb-3" />
        <div className="h-28 flex items-end gap-1">
          {[40, 65, 45, 80, 60, 90, 75, 55, 85, 70, 95, 80].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${h}%`, background: i === 11 ? '#2d7a4f' : 'rgba(45,122,79,0.3)' }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m) => (
            <div key={m} className="text-[8px] text-white/20">{m}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DispatchMockup() {
  const jobs = [
    { driver: 'Carlos M.', job: 'Riverside Fill', truck: 'TX-441', loads: 8, status: 'Active' },
    { driver: 'James D.', job: 'Highway 90 Base', truck: 'TX-229', loads: 5, status: 'En Route' },
    { driver: 'Tony R.', job: 'Stadium Demo', truck: 'TX-887', loads: 12, status: 'Complete' },
    { driver: 'Marcus W.', job: 'North Quarry', truck: 'TX-115', loads: 3, status: 'Active' },
  ]
  return (
    <div className="flex-1 p-5 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="h-2 w-24 rounded bg-white/20" />
        <div className="h-6 w-20 rounded-lg bg-[#2d7a4f]/30 text-[10px] text-green-400 flex items-center justify-center">+ Dispatch</div>
      </div>
      <div className="rounded-lg bg-white/5 overflow-hidden">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-white/5">
          {['Driver','Job','Truck','Loads','Status'].map((h) => (
            <div key={h} className="text-[9px] text-white/30 font-medium">{h}</div>
          ))}
        </div>
        {jobs.map((j, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 px-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5">
            <div className="text-[10px] text-white/70">{j.driver}</div>
            <div className="text-[10px] text-white/70 truncate">{j.job}</div>
            <div className="text-[10px] text-white/40">{j.truck}</div>
            <div className="text-[10px] text-white/70">{j.loads}</div>
            <div className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
              j.status === 'Active' ? 'bg-[#2d7a4f]/30 text-green-400' :
              j.status === 'En Route' ? 'bg-blue-500/20 text-blue-400' :
              'bg-white/10 text-white/40'
            }`}>{j.status}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TicketsMockup() {
  const tickets = [
    { id: '#1041', job: 'Riverside Fill', material: 'Topsoil', driver: 'Carlos M.', qty: '14T', status: 'Invoiced' },
    { id: '#1040', job: 'Highway 90', material: 'Gravel Base', driver: 'James D.', qty: '22T', status: 'Pending' },
    { id: '#1039', job: 'Stadium Demo', material: 'Concrete', driver: 'Tony R.', qty: '18T', status: 'Paid' },
    { id: '#1038', job: 'North Quarry', material: 'Fill Dirt', driver: 'Marcus W.', qty: '10T', status: 'Pending' },
  ]
  return (
    <div className="flex-1 p-5 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="h-2 w-20 rounded bg-white/20" />
        <div className="h-6 w-24 rounded-lg bg-[#2d7a4f]/30 text-[10px] text-green-400 flex items-center justify-center">+ New Ticket</div>
      </div>
      <div className="rounded-lg bg-white/5 overflow-hidden">
        <div className="grid grid-cols-6 gap-2 px-3 py-2 border-b border-white/5">
          {['Ticket','Job','Material','Driver','Qty','Status'].map((h) => (
            <div key={h} className="text-[9px] text-white/30 font-medium">{h}</div>
          ))}
        </div>
        {tickets.map((t, i) => (
          <div key={i} className="grid grid-cols-6 gap-2 px-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5">
            <div className="text-[10px] text-white/40">{t.id}</div>
            <div className="text-[10px] text-white/70 truncate">{t.job}</div>
            <div className="text-[10px] text-white/50 truncate">{t.material}</div>
            <div className="text-[10px] text-white/70">{t.driver}</div>
            <div className="text-[10px] text-white/70">{t.qty}</div>
            <div className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
              t.status === 'Paid' ? 'bg-[#2d7a4f]/30 text-green-400' :
              t.status === 'Invoiced' ? 'bg-blue-500/20 text-blue-400' :
              'bg-[#FFB800]/20 text-[#FFB800]'
            }`}>{t.status}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InvoicesMockup() {
  const invoices = [
    { id: 'INV-0089', client: 'City of Atlanta', amount: '$12,400', loads: 31, status: 'Paid' },
    { id: 'INV-0088', client: 'Hancock Bros.', amount: '$8,750', loads: 22, status: 'Sent' },
    { id: 'INV-0087', client: 'DuraCon LLC', amount: '$5,200', loads: 14, status: 'Draft' },
    { id: 'INV-0086', client: 'Metro Works', amount: '$19,600', loads: 48, status: 'Paid' },
  ]
  return (
    <div className="flex-1 p-5 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="h-2 w-20 rounded bg-white/20" />
        <div className="h-6 w-28 rounded-lg bg-[#2d7a4f]/30 text-[10px] text-green-400 flex items-center justify-center">+ New Invoice</div>
      </div>
      <div className="rounded-lg bg-white/5 overflow-hidden">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-white/5">
          {['Invoice','Client','Amount','Loads','Status'].map((h) => (
            <div key={h} className="text-[9px] text-white/30 font-medium">{h}</div>
          ))}
        </div>
        {invoices.map((inv, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 px-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5">
            <div className="text-[10px] text-white/40">{inv.id}</div>
            <div className="text-[10px] text-white/70 truncate">{inv.client}</div>
            <div className="text-[10px] text-white font-semibold">{inv.amount}</div>
            <div className="text-[10px] text-white/50">{inv.loads} loads</div>
            <div className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
              inv.status === 'Paid' ? 'bg-[#2d7a4f]/30 text-green-400' :
              inv.status === 'Sent' ? 'bg-blue-500/20 text-blue-400' :
              'bg-white/10 text-white/40'
            }`}>{inv.status}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const mockupMap: Record<Tab, ReactNode> = {
  Dashboard: <DashboardMockup />,
  Dispatch: <DispatchMockup />,
  Tickets: <TicketsMockup />,
  Invoices: <InvoicesMockup />,
}

export default function Screenshots() {
  const [active, setActive] = useState<Tab>('Dashboard')

  return (
    <section className="py-16 md:py-24 bg-gray-50" id="screenshots">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 md:mb-12">
          <p className="text-sm font-semibold text-[#2d7a4f] uppercase tracking-wider mb-3">Product</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            See it in action
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Every feature is built specifically for dump truck companies.
          </p>
        </div>

        <div className="overflow-x-auto mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex justify-center gap-1 bg-white rounded-xl border border-gray-200 p-1 w-max mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  active === tab
                    ? 'bg-[#0f1923] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-gray-200 bg-[#1a2535] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#141f2e]">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#FFB800]/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
              <div className="flex-1 mx-3 h-5 rounded-md bg-white/5 flex items-center px-2">
                <span className="text-[9px] text-white/20">app.dumptruckboss.com/{active.toLowerCase()}</span>
              </div>
            </div>
            <div className="flex min-h-[280px]">
              <div className="w-14 bg-[#1e3a2a] flex flex-col items-center py-4 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-8 w-8 rounded-lg ${i === tabs.indexOf(active) ? 'bg-[#2d7a4f]' : 'bg-white/10'}`} />
                ))}
              </div>
              <div className="flex-1 transition-opacity duration-200">
                {mockupMap[active]}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
