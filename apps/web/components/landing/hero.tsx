'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const TABS = [
  { id: 'dispatch', label: '🚛 Dispatch' },
  { id: 'tickets',  label: '🎫 Tickets' },
  { id: 'invoice',  label: '📄 Invoice' },
  { id: 'revenue',  label: '💰 Revenue' },
  { id: 'drivers',  label: '📋 Drivers' },
]

function DispatchMockup() {
  return (
    <div style={{ padding: '12px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Dispatch Board</span>
        <span style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(74,222,128,0.15)', padding: '2px 8px', borderRadius: '99px' }}>● Live</span>
      </div>
      {/* Scrollable table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: '420px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 1fr 50px', gap: '4px', padding: '0 6px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Driver', 'Truck', 'Status', 'Job Site', 'Loads'].map(h => (
              <span key={h} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>
          {[
            { name: 'Miguel Rivera',  truck: 'SA07', statusColor: '#4ade80', status: 'On Site',    job: 'ER Snell Job',     loads: 4 },
            { name: 'Carlos Santos',  truck: 'F03',  statusColor: '#60a5fa', status: 'Dispatched', job: 'Watson Fill',      loads: 2 },
            { name: 'James Okafor',   truck: 'B12',  statusColor: '#4ade80', status: 'On Site',    job: 'Riverside Grade',  loads: 6 },
            { name: 'Derek Williams', truck: 'T05',  statusColor: '#FFB800', status: 'En Route',   job: 'Piedmont Dirt Co', loads: 1 },
            { name: 'Luis Herrera',   truck: 'SA11', statusColor: '#a78bfa', status: 'Idle',       job: '—',                loads: 0 },
          ].map((row) => (
            <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 1fr 50px', gap: '4px', alignItems: 'center', padding: '7px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(45,122,79,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
                  {row.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{row.truck}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: row.statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: row.statusColor }}>{row.status}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.job}</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>{row.loads > 0 ? row.loads : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TicketsMockup() {
  return (
    <div style={{ padding: '12px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Tickets</span>
        <span style={{ fontSize: '10px', background: 'rgba(45,122,79,0.3)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>+ New Ticket</span>
      </div>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', overflowX: 'auto' }}>
        {['All', 'Today', 'This Week', 'Pending'].map((f, i) => (
          <span key={f} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '99px', background: i === 0 ? '#2d7a4f' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{f}</span>
        ))}
      </div>
      {[
        { id: '#1042', driver: 'Miguel Rivera', job: 'ER Snell Job',    material: 'Dirt',    loads: 4, status: 'Verified',   statusColor: '#4ade80' },
        { id: '#1041', driver: 'James Okafor',  job: 'Riverside Grade', material: 'Gravel',  loads: 6, status: 'Verified',   statusColor: '#4ade80' },
        { id: '#1040', driver: 'Carlos Santos', job: 'Watson Fill',     material: 'Fill',    loads: 2, status: 'Pending',    statusColor: '#FFB800' },
        { id: '#1039', driver: 'Derek Williams',job: 'Piedmont Dirt',   material: 'Sand',    loads: 1, status: 'Pending',    statusColor: '#FFB800' },
        { id: '#1038', driver: 'Luis Herrera',  job: 'City Road Work',  material: 'Asphalt', loads: 5, status: 'Invoiced',   statusColor: '#60a5fa' },
      ].map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', flexShrink: 0 }}>{t.id}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.driver}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.job} · {t.material}</div>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{t.loads}L</span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '99px', background: `${t.statusColor}20`, color: t.statusColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{t.status}</span>
        </div>
      ))}
    </div>
  )
}

function InvoiceMockup() {
  return (
    <div style={{ padding: '12px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Invoice #INV-2024-089</span>
        <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>Draft</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bill To</div>
          <div style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>ER Snell Construction</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>Atlanta, GA</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due</div>
          <div style={{ fontSize: '11px', color: '#fff' }}>May 10, 2024</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: '300px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px', gap: '4px', padding: '0 4px 5px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Description', 'Qty', 'Rate', 'Total'].map(h => (
              <span key={h} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {[
            { desc: 'Dirt Hauling — SA07', qty: '4', rate: '$85', total: '$340' },
            { desc: 'Dirt Hauling — F03',  qty: '2', rate: '$85', total: '$170' },
            { desc: 'Gravel Delivery',     qty: '3', rate: '$95', total: '$285' },
          ].map((row) => (
            <div key={row.desc} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px', gap: '4px', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.desc}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{row.qty}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{row.rate}</span>
              <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>{row.total}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', padding: '8px 4px 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Total</span>
        <span style={{ fontSize: '15px', color: '#4ade80', fontWeight: 700 }}>$795.00</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <div style={{ flex: 1, background: '#2d7a4f', borderRadius: '6px', padding: '7px', textAlign: 'center', fontSize: '11px', color: '#fff', fontWeight: 600 }}>Send Invoice</div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>PDF</div>
      </div>
    </div>
  )
}

function RevenueMockup() {
  const bars = [38, 55, 42, 70, 58, 85, 65, 50, 78, 60, 90, 72]
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div style={{ padding: '12px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Revenue Dashboard</span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>2024</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'This Month', val: '$42,380', change: '+12%', up: true },
          { label: 'Invoiced',   val: '$18,900', change: '+5%',  up: true },
          { label: 'Outstanding',val: '$7,240',  change: '↓ $9k', up: false },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, marginBottom: '2px' }}>{s.val}</div>
            <div style={{ fontSize: '9px', color: s.up ? '#4ade80' : '#FFB800' }}>{s.change}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>Monthly Revenue</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '50px' }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`, background: i === 11 ? '#2d7a4f' : 'rgba(45,122,79,0.3)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
          {months.map((m, i) => (
            <div key={m} style={{ flex: 1, fontSize: '7px', color: i === 11 ? '#4ade80' : 'rgba(255,255,255,0.2)', textAlign: 'center' }}>{m}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DriversMockup() {
  return (
    <div style={{ padding: '12px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Drivers</span>
        <span style={{ fontSize: '10px', background: 'rgba(45,122,79,0.3)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>+ Add Driver</span>
      </div>
      {[
        { name: 'Miguel Rivera',  truck: 'SA07', loads: 142, earned: '$12,070', status: 'Active' },
        { name: 'Carlos Santos',  truck: 'F03',  loads: 98,  earned: '$8,330',  status: 'Active' },
        { name: 'James Okafor',   truck: 'B12',  loads: 211, earned: '$17,935', status: 'Active' },
        { name: 'Derek Williams', truck: 'T05',  loads: 64,  earned: '$5,440',  status: 'Active' },
        { name: 'Luis Herrera',   truck: 'SA11', loads: 77,  earned: '$6,545',  status: 'On Leave' },
      ].map((d) => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(45,122,79,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
            {d.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Truck {d.truck} · {d.loads} loads</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>{d.earned}</div>
            <div style={{ fontSize: '9px', color: d.status === 'Active' ? 'rgba(255,255,255,0.35)' : '#FFB800' }}>{d.status}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const MOCKUPS: Record<string, React.ReactNode> = {
  dispatch: <DispatchMockup />,
  tickets:  <TicketsMockup />,
  invoice:  <InvoiceMockup />,
  revenue:  <RevenueMockup />,
  drivers:  <DriversMockup />,
}

export default function Hero() {
  const [activeTab, setActiveTab] = useState('dispatch')
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const visibleRef = useRef(true)

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (!visibleRef.current) return
      setActiveTab(prev => {
        const idx = TABS.findIndex(t => t.id === prev)
        return TABS[(idx + 1) % TABS.length]!.id
      })
    }, 4000)
  }

  useEffect(() => {
    startTimer()
    if (typeof IntersectionObserver !== 'undefined' && sectionRef.current) {
      const obs = new IntersectionObserver(
        ([entry]) => { visibleRef.current = entry!.isIntersecting },
        { threshold: 0.1 },
      )
      obs.observe(sectionRef.current)
      return () => { obs.disconnect(); if (timerRef.current) clearInterval(timerRef.current) }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleTabClick = (id: string) => { setActiveTab(id); startTimer() }

  return (
    <section
      ref={sectionRef}
      className="pt-20 pb-14 sm:pt-24 sm:pb-20"
      style={{
        background: '#0f1923',
        backgroundImage: 'radial-gradient(#ffffff08 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        {/* Badge */}
        <div className="flex justify-center mb-6 sm:mb-7">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(45,122,79,0.2)', border: '1px solid rgba(45,122,79,0.4)', borderRadius: '99px', padding: '6px 16px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d7a4f', animation: 'pulse 2s infinite', willChange: 'transform, opacity', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#4ade80' }}>Built for dirt &amp; aggregate haulers</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-extrabold text-white leading-[1.1] tracking-tight mb-4 sm:mb-5"
          style={{ fontSize: 'clamp(28px, 7vw, 60px)', letterSpacing: '-0.02em' }}>
          Run Your Dump Truck Business{' '}
          <span style={{ color: '#FFB800' }}>Like a Boss.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-center text-[15px] sm:text-[17px] leading-relaxed max-w-[580px] mx-auto mb-8 sm:mb-9"
          style={{ color: 'rgba(255,255,255,0.55)' }}>
          Replace the paper tickets, missed invoices, and Excel guesswork with one platform built specifically for hauling operations.
        </p>

        {/* CTAs — stack on mobile, row on sm+ */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mb-4 sm:mb-4">
          <Link
            href="/signup"
            className="hero-cta flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-4 sm:py-3.5 rounded-[10px] text-[15px] font-bold no-underline"
          >
            Start Free 14-Day Trial <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
          <Link
            href="#screenshots"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-4 sm:py-3.5 rounded-[10px] text-[15px] font-semibold no-underline text-white"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Watch Demo →
          </Link>
        </div>

        {/* Trust line */}
        <p className="text-center text-[12px] mb-10 sm:mb-14" style={{ color: 'rgba(255,255,255,0.28)' }}>
          No credit card required · Set up in 10 minutes · Cancel anytime
        </p>

        {/* Interactive demo — constrained so it never overflows the viewport */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#141f2e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

          {/* Browser chrome */}
          <div style={{ background: '#0d1825', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'rgba(239,68,68,0.7)' }} />
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'rgba(234,179,8,0.7)' }} />
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'rgba(34,197,94,0.7)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '5px', padding: '2px 12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                app.dumptruckboss.com
              </div>
            </div>
          </div>

          {/* Tab bar — horizontally scrollable on mobile */}
          <div style={{ background: '#111c2a', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '8px 10px', minWidth: 'max-content' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    color: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.45)',
                    background: activeTab === tab.id ? 'rgba(45,122,79,0.35)' : 'transparent',
                    border: activeTab === tab.id ? '1px solid rgba(45,122,79,0.5)' : '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mockup content */}
          <div style={{ minHeight: '300px' }} key={activeTab}>
            {MOCKUPS[activeTab]}
          </div>

          {/* Progress bar */}
          <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}>
            <div
              key={`bar-${activeTab}`}
              style={{ height: '100%', background: '#2d7a4f', animation: 'progress 4s linear', width: '100%' }}
            />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .hero-cta { background: #FFB800; color: #000000; transition: background 0.15s; }
        .hero-cta:hover { background: #E6A600; }
      `}</style>
    </section>
  )
}
