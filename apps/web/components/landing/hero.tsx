'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const TABS = [
  { id: 'dispatch', label: '🚛 Dispatch Drivers' },
  { id: 'tickets',  label: '🎫 Submit Tickets' },
  { id: 'invoice',  label: '📄 Generate Invoice' },
  { id: 'revenue',  label: '💰 Track Revenue' },
  { id: 'drivers',  label: '📋 Manage Drivers' },
]

function DispatchMockup() {
  return (
    <div style={{ padding: '16px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Dispatch Board</span>
        <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(74,222,128,0.15)', padding: '2px 8px', borderRadius: '99px' }}>● Live</span>
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 1fr 60px', gap: '6px', padding: '0 8px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {['Driver', 'Truck', 'Status', 'Job Site', 'Loads'].map(h => (
          <span key={h} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
        ))}
      </div>
      {/* Rows */}
      {[
        { name: 'Miguel Rivera',  truck: 'SA07', statusColor: '#4ade80', status: 'On Site',    job: 'ER Snell Job',     loads: 4 },
        { name: 'Carlos Santos',  truck: 'F03',  statusColor: '#60a5fa', status: 'Dispatched', job: 'Watson Fill',      loads: 2 },
        { name: 'James Okafor',   truck: 'B12',  statusColor: '#4ade80', status: 'On Site',    job: 'Riverside Grade',  loads: 6 },
        { name: 'Derek Williams', truck: 'T05',  statusColor: '#FFB800', status: 'En Route',   job: 'Piedmont Dirt Co', loads: 1 },
        { name: 'Luis Herrera',   truck: 'SA11', statusColor: '#a78bfa', status: 'Idle',       job: '—',                loads: 0 },
      ].map((row) => (
        <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 1fr 60px', gap: '6px', alignItems: 'center', padding: '9px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(45,122,79,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
              {row.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>{row.name}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{row.truck}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: row.statusColor, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: row.statusColor }}>{row.status}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.job}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>{row.loads > 0 ? row.loads : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function TicketsMockup() {
  return (
    <div style={{ padding: '16px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Tickets</span>
        <span style={{ fontSize: '11px', background: 'rgba(45,122,79,0.3)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>+ New Ticket</span>
      </div>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {['All', 'Today', 'This Week', 'Pending'].map((f, i) => (
          <span key={f} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: i === 0 ? '#2d7a4f' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>{f}</span>
        ))}
      </div>
      {[
        { id: '#1042', driver: 'Miguel Rivera', job: 'ER Snell Job',    material: 'Dirt',    loads: 4, status: 'Verified',   statusColor: '#4ade80' },
        { id: '#1041', driver: 'James Okafor',  job: 'Riverside Grade', material: 'Gravel',  loads: 6, status: 'Verified',   statusColor: '#4ade80' },
        { id: '#1040', driver: 'Carlos Santos', job: 'Watson Fill',     material: 'Fill',    loads: 2, status: 'Pending',    statusColor: '#FFB800' },
        { id: '#1039', driver: 'Derek Williams',job: 'Piedmont Dirt',   material: 'Sand',    loads: 1, status: 'Pending',    statusColor: '#FFB800' },
        { id: '#1038', driver: 'Luis Herrera',  job: 'City Road Work',  material: 'Asphalt', loads: 5, status: 'Invoiced',   statusColor: '#60a5fa' },
      ].map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', flexShrink: 0 }}>{t.id}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.driver}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{t.job} · {t.material}</div>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{t.loads} loads</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: `${t.statusColor}20`, color: t.statusColor, flexShrink: 0 }}>{t.status}</span>
        </div>
      ))}
    </div>
  )
}

function InvoiceMockup() {
  return (
    <div style={{ padding: '16px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Invoice #INV-2024-089</span>
        <span style={{ fontSize: '11px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>Draft</span>
      </div>
      {/* Client info */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bill To</div>
          <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>ER Snell Construction</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Atlanta, GA</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Due Date</div>
          <div style={{ fontSize: '12px', color: '#fff' }}>May 10, 2024</div>
        </div>
      </div>
      {/* Line items */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 60px 70px', gap: '4px', padding: '0 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Description', 'Qty', 'Rate', 'Total'].map(h => (
            <span key={h} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>
        {[
          { desc: 'Dirt Hauling — SA07', qty: '4', rate: '$85', total: '$340' },
          { desc: 'Dirt Hauling — F03',  qty: '2', rate: '$85', total: '$170' },
          { desc: 'Gravel Delivery',     qty: '3', rate: '$95', total: '$285' },
        ].map((row) => (
          <div key={row.desc} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 60px 70px', gap: '4px', padding: '7px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>{row.desc}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{row.qty}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{row.rate}</span>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{row.total}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', padding: '4px 4px 0' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Total</span>
        <span style={{ fontSize: '16px', color: '#4ade80', fontWeight: 700 }}>$795.00</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <div style={{ flex: 1, background: '#2d7a4f', borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '12px', color: '#fff', fontWeight: 600 }}>Send Invoice</div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Download PDF</div>
      </div>
    </div>
  )
}

function RevenueMockup() {
  const bars = [38, 55, 42, 70, 58, 85, 65, 50, 78, 60, 90, 72]
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div style={{ padding: '16px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Revenue Dashboard</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>2024</span>
      </div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'This Month', val: '$42,380', change: '+12%', up: true },
          { label: 'Invoiced',   val: '$18,900', change: '+5%',  up: true },
          { label: 'Outstanding',val: '$7,240',  change: '↓ from $9k', up: false },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginBottom: '2px' }}>{s.val}</div>
            <div style={{ fontSize: '10px', color: s.up ? '#4ade80' : '#FFB800' }}>{s.change}</div>
          </div>
        ))}
      </div>
      {/* Bar chart */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>Monthly Revenue</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${h}%`, background: i === 11 ? '#2d7a4f' : 'rgba(45,122,79,0.3)' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          {months.map((m, i) => (
            <div key={m} style={{ flex: 1, fontSize: '8px', color: i === 11 ? '#4ade80' : 'rgba(255,255,255,0.25)', textAlign: 'center' }}>{m}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DriversMockup() {
  return (
    <div style={{ padding: '16px', animation: 'fadeInMockup 0.35s ease both', willChange: 'transform, opacity' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Drivers</span>
        <span style={{ fontSize: '11px', background: 'rgba(45,122,79,0.3)', color: '#4ade80', padding: '2px 8px', borderRadius: '99px' }}>+ Add Driver</span>
      </div>
      {[
        { name: 'Miguel Rivera',  truck: 'SA07', loads: 142, earned: '$12,070', status: 'Active' },
        { name: 'Carlos Santos',  truck: 'F03',  loads: 98,  earned: '$8,330',  status: 'Active' },
        { name: 'James Okafor',   truck: 'B12',  loads: 211, earned: '$17,935', status: 'Active' },
        { name: 'Derek Williams', truck: 'T05',  loads: 64,  earned: '$5,440',  status: 'Active' },
        { name: 'Luis Herrera',   truck: 'SA11', loads: 77,  earned: '$6,545',  status: 'On Leave' },
      ].map((d) => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(45,122,79,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
            {d.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{d.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Truck {d.truck} · {d.loads} loads this month</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 600 }}>{d.earned}</div>
            <div style={{ fontSize: '10px', color: d.status === 'Active' ? 'rgba(255,255,255,0.35)' : '#FFB800' }}>{d.status}</div>
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
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
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
    // Pause auto-rotation when the hero scrolls off-screen
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

  const handleTabClick = (id: string) => {
    setActiveTab(id)
    startTimer()
  }

  return (
    <section
      ref={sectionRef}
      style={{
        background: '#0f1923',
        paddingTop: '96px',
        paddingBottom: '80px',
        backgroundImage: 'radial-gradient(#ffffff08 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(45,122,79,0.2)', border: '1px solid rgba(45,122,79,0.4)', borderRadius: '99px', padding: '6px 16px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d7a4f', animation: 'pulse 2s infinite', willChange: 'transform, opacity' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#4ade80' }}>Built for dirt &amp; aggregate haulers</span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ textAlign: 'center', fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '20px' }}>
          Run Your Dump Truck Business{' '}
          <span style={{ color: '#FFB800' }}>Like a Boss.</span>
        </h1>

        {/* Subheadline */}
        <p style={{ textAlign: 'center', fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 36px' }}>
          Replace the paper tickets, missed invoices, and Excel guesswork with one platform built specifically for hauling operations.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
          <Link
            href="/signup"
            className="hero-cta"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}
          >
            Start Free 14-Day Trial <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Link>
          <Link
            href="#screenshots"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', padding: '14px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}
          >
            Watch Demo →
          </Link>
        </div>

        {/* Trust line */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.28)', marginBottom: '56px' }}>
          No credit card required · Set up in 10 minutes · Cancel anytime
        </p>

        {/* Interactive demo */}
        <div style={{ background: '#141f2e', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

          {/* Browser chrome */}
          <div style={{ background: '#0d1825', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(239,68,68,0.7)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(234,179,8,0.7)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(34,197,94,0.7)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '6px', padding: '3px 16px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                app.dumptruckboss.com
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '4px', padding: '10px 12px', background: '#111c2a', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
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

          {/* Mockup content */}
          <div style={{ minHeight: '340px' }} key={activeTab}>
            {MOCKUPS[activeTab]}
          </div>

          {/* Progress bar */}
          <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)' }}>
            <div
              key={`bar-${activeTab}`}
              style={{
                height: '100%',
                background: '#2d7a4f',
                animation: 'progress 4s linear',
                width: '100%',
              }}
            />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .hero-cta { background: #FFB800; color: #000000; transition: background 0.15s; }
        .hero-cta:hover { background: #E6A600; }
      `}</style>
    </section>
  )
}
