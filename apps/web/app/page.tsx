'use client'

import Link from 'next/link'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

// ─── SECTION 1 — HERO ────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative bg-[#1a1a1a] sm:min-h-screen flex items-center overflow-hidden px-6 py-16 pt-28 sm:py-24 sm:pt-32">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F5B731 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

        {/* Copy */}
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5B731]/10 border border-[#F5B731]/30 rounded-full mb-8">
            <span className="text-[#F5B731] text-sm font-bold">🚛 Built for dump truck companies</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6">
            Run Your Entire{' '}
            <span className="text-[#F5B731]">Dump Truck</span>{' '}
            Operation From One Dashboard
          </h1>

          <p className="text-xl text-gray-300 leading-relaxed mb-4 max-w-xl">
            Dispatch drivers. Track haul tickets. Send invoices.
            Manage subcontractors. Store documents. Handle your CRM.
            All in one place — built for how dump truck companies actually work.
          </p>

          <p className="text-sm text-gray-500 mb-10">
            ✅ No credit card required &nbsp;·&nbsp; ✅ 7-day free trial &nbsp;·&nbsp; ✅ Set up in 15 minutes
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-[#F5B731] text-black font-black text-lg rounded-xl hover:bg-yellow-400 transition-all shadow-2xl shadow-amber-900/40 text-center"
            >
              Start Free Trial →
            </Link>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white/10 text-white font-bold text-lg rounded-xl hover:bg-white/20 transition-all border border-white/20 text-center flex items-center justify-center gap-2"
            >
              <span className="text-xl">▶</span> Watch Demo
            </button>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#F5B731]/10 rounded-3xl blur-3xl scale-110" />
          <div className="relative bg-[#111] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 mx-4 bg-white/10 rounded-md px-3 py-1 text-xs text-gray-400">
                app.dumptruckboss.com
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Dispatched',  value: '8',      color: 'text-[#F5B731]'  },
                  { label: 'Loads Today', value: '24',     color: 'text-green-400'  },
                  { label: 'Revenue',     value: '$4,280', color: 'text-green-400'  },
                  { label: 'No Response', value: '0',      color: 'text-gray-400'   },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 rounded-xl p-3">
                    <p className={`text-base font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold text-xs">Dispatch Board</span>
                  <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">● Live</span>
                </div>
                {[
                  { driver: 'Jake Morrison', truck: 'SA07', status: 'On Site',    job: 'Atlas Haul Site',  loads: 4 },
                  { driver: 'Carlos Rivera', truck: 'F03',  status: 'Dispatched', job: 'Summit Fill',      loads: 2 },
                  { driver: 'Tyler Brooks',  truck: 'B12',  status: 'On Site',    job: 'Ironclad Grade',   loads: 6 },
                ].map(row => (
                  <div key={row.driver} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#F5B731]/20 flex items-center justify-center text-[10px] font-bold text-[#F5B731]">
                        {row.driver.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{row.driver}</p>
                        <p className="text-gray-500 text-[10px]">{row.job}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[10px]">{row.truck}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${row.status === 'On Site' ? 'bg-green-400/10 text-green-400' : 'bg-blue-400/10 text-blue-400'}`}>
                        ● {row.status}
                      </span>
                      <span className="text-gray-400 text-[10px]">{row.loads} loads</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

// ─── SECTION 2 — PAIN POINTS ─────────────────────────────────────────────────

function PainPoints() {
  const pains = [
    { icon: '📋', title: 'Paper tickets get lost',         body: "Drivers lose tickets. Tickets get rained on. You lose $400 because you can't find the slip."                                           },
    { icon: '📱', title: 'Dispatching through group texts', body: "Three drivers, five texts, nobody knows who's going where. Someone double-books a truck."                                              },
    { icon: '📊', title: 'Invoices go out late',           body: "You're sitting at the kitchen table Sunday night trying to reconstruct a week from memory."                                            },
    { icon: '🤷', title: 'No idea which jobs make money',  body: "You're busy all month. But after fuel, drivers, and subs — where did it all go?"                                                       },
    { icon: '📂', title: 'Documents everywhere',           body: 'Insurance certificates, permits, inspection reports — scattered across emails, folders, and gloveboxes.'                               },
    { icon: '😤', title: 'Subcontractors are a headache',  body: "Tracking what you owe subs, what they hauled, and generating their pay stubs takes all day."                                           },
  ]

  return (
    <section className="bg-gray-50 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-red-500 text-sm font-bold uppercase tracking-widest block mb-3">Sound familiar?</span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900">
            Running a dump truck company is{' '}
            <span className="text-red-500">hard enough</span> already.
          </h2>
          <p className="text-xl text-gray-500 mt-4 max-w-2xl mx-auto">
            Most dump truck companies are still running on spreadsheets, paper tickets, and group texts.
            Here's what that looks like every day:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pains.map(pain => (
            <div key={pain.title} className="p-6 bg-white rounded-2xl border border-red-100 hover:border-red-200 transition-colors shadow-sm">
              <span className="text-4xl block mb-4">{pain.icon}</span>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{pain.title}</h3>
              <p className="text-gray-500 leading-relaxed">{pain.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <p className="text-2xl font-bold text-gray-700">There's a better way. ↓</p>
        </div>
      </div>
    </section>
  )
}

// ─── SECTION 3 — SOLUTION ────────────────────────────────────────────────────

function Solution() {
  const features = [
    { icon: '🚛', feature: 'Dispatch Board',            outcome: 'Know exactly where every truck is and what every driver is doing — in real time.',                 color: 'border-blue-500/30 hover:border-blue-500/60'      },
    { icon: '🎫', feature: 'Digital Haul Tickets',      outcome: 'Drivers submit tickets from their phones with photos. No more lost paper slips.',                  color: 'border-green-500/30 hover:border-green-500/60'    },
    { icon: '🧾', feature: 'Invoicing',                 outcome: 'Turn a week of tickets into a professional invoice in under 60 seconds.',                          color: 'border-[#F5B731]/30 hover:border-[#F5B731]/60'    },
    { icon: '🤝', feature: 'Subcontractor Management',  outcome: 'Track what every sub hauled, generate their pay stubs, and send payment in one click.',           color: 'border-purple-500/30 hover:border-purple-500/60'  },
    { icon: '📊', feature: 'CRM & Job Pipeline',        outcome: 'Keep every customer, lead, and job organized. Never lose track of a follow-up.',                  color: 'border-pink-500/30 hover:border-pink-500/60'      },
    { icon: '📁', feature: 'Document Storage',          outcome: 'Insurance certs, permits, inspection reports — all in one place, searchable in seconds.',         color: 'border-orange-500/30 hover:border-orange-500/60'  },
    { icon: '💰', feature: 'Revenue & Profit Tracking', outcome: "See exactly which trucks, drivers, and jobs are making you money — and which aren't.",            color: 'border-emerald-500/30 hover:border-emerald-500/60'},
    { icon: '🤖', feature: 'AI Document Reader',        outcome: 'Upload a broker pay sheet or shift report. We extract every ticket automatically.',               color: 'border-cyan-500/30 hover:border-cyan-500/60'      },
    { icon: '👷', feature: 'Driver Portal',             outcome: 'Drivers see their jobs, submit tickets, and sign off — from their phone in seconds.',             color: 'border-indigo-500/30 hover:border-indigo-500/60'  },
  ]

  return (
    <section id="features" className="bg-[#1a1a1a] py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest block mb-3">The Solution</span>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Everything your operation needs.{' '}
            <span className="text-[#F5B731]">One dashboard.</span>
          </h2>
          <p className="text-xl text-gray-400 mt-4 max-w-2xl mx-auto">
            DumpTruckBoss connects every part of your operation so nothing falls through the cracks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(item => (
            <div key={item.feature} className={`p-6 bg-white/5 rounded-2xl border-2 transition-all ${item.color}`}>
              <span className="text-4xl block mb-4">{item.icon}</span>
              <h3 className="text-white font-bold text-lg mb-2">{item.feature}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">{item.outcome}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── SECTION 4 — DEMO VIDEO ──────────────────────────────────────────────────

function DemoVideo() {
  return (
    <section id="demo" className="bg-white py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <span className="text-[#2d6a4f] text-sm font-bold uppercase tracking-widest block mb-4">
          See It In Action
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
          See how it works in <span className="text-[#F5B731]">one minute</span>
        </h2>
        <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto">
          Watch a real walkthrough of a dispatch getting created, a ticket submitted,
          and an invoice sent — start to finish.
        </p>

        <div className="relative bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl max-w-3xl mx-auto border-2 border-[#F5B731]/30">
          <video
            src="/demo.mov"
            controls
            playsInline
            className="w-full h-full block"
            style={{ maxHeight: '520px' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-6 mt-12 max-w-2xl mx-auto">
          {[
            { icon: '🚛', text: 'Create a dispatch in 30 seconds' },
            { icon: '📱', text: 'Driver submits ticket from phone'  },
            { icon: '🧾', text: 'Invoice sent in under a minute'    },
          ].map(item => (
            <div key={item.text} className="text-center">
              <span className="text-3xl block mb-2">{item.icon}</span>
              <p className="text-sm text-gray-600 font-medium">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-[#1a1a1a] text-white font-bold text-lg rounded-xl hover:bg-gray-800 transition-colors"
          >
            Start Free — No Credit Card →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── SECTION 5 — WHY DIFFERENT ───────────────────────────────────────────────

function WhyDifferent() {
  const reasons = [
    { icon: '🔧', title: 'Built by an active operator',   body: "The founder drives dump trucks in Atlanta on real highway projects. Every feature was built because he needed it himself.", highlight: true  },
    { icon: '📱', title: 'Works on any phone',             body: "Drivers submit tickets from the cab. No special hardware. No training. If they can text, they can use it.",               highlight: false },
    { icon: '⚡', title: 'Set up in 15 minutes',           body: "Add your company info, add your trucks, invite your first driver. First dispatch in under 15 minutes.",                   highlight: false },
    { icon: '🎯', title: 'Only what you actually need',    body: "No bloat. No features nobody uses. Built specifically for 1–25 truck operations, nothing more.",                          highlight: false },
    { icon: '💬', title: 'Plain English. No tech speak.',  body: 'Every screen uses the same language you use in the yard. Tickets, dispatches, loads — not "work orders" or "entities."', highlight: false },
    { icon: '💰', title: 'Priced for real operators',      body: "Starting at $25/month. Less than one lost ticket. No long-term contracts.",                                               highlight: false },
  ]

  return (
    <section className="bg-gray-50 py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest block mb-3">Why DumpTruckBoss</span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900">Built different. On purpose.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {reasons.map(item => (
            <div
              key={item.title}
              className={`p-8 rounded-2xl ${item.highlight ? 'bg-[#1a1a1a] border-2 border-[#F5B731]' : 'bg-white border border-gray-200'}`}
            >
              <span className="text-4xl block mb-4">{item.icon}</span>
              <h3 className={`text-xl font-bold mb-3 ${item.highlight ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
              <p className={item.highlight ? 'text-gray-300' : 'text-gray-500'}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── SECTION 6 — OBJECTIONS ──────────────────────────────────────────────────

function Objections() {
  const items = [
    {
      q: '"Software is too complicated. We\'re not tech people."',
      a: "Fair. Most software isn't built for people who drive trucks for a living. This one is. If you can send a text message, you can use DumpTruckBoss. The whole thing was designed for people who don't have time to read a manual.",
    },
    {
      q: '"My drivers won\'t use it."',
      a: "Drivers use it because it makes their life easier — not harder. They open an app, take a photo of the ticket, and tap submit. That's it. No typing. No logging in. Most drivers are fully onboarded in under 5 minutes.",
    },
    {
      q: '"Setup takes forever. We don\'t have time."',
      a: "Setup takes 15 minutes. Add your company info, add your trucks, invite your first driver. We walk you through it step by step. You'll have your first dispatch running the same day you sign up.",
    },
    {
      q: '"We already use spreadsheets. It\'s working."',
      a: "Spreadsheets work — until they don't. Until a driver doesn't update the sheet. Until the wrong version gets saved. Until you're trying to invoice from last week's data at 10pm on Sunday. DumpTruckBoss replaces all of that — and you get your Sundays back.",
    },
    {
      q: '"What if I sign up and it doesn\'t work for us?"',
      a: "You have 7 days free, no credit card required. If it's not the right fit, you don't pay anything. We'd rather you try it and decide than wonder.",
    },
  ]

  return (
    <section id="faq" className="bg-[#1a1a1a] py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-white">"We've heard it before."</h2>
          <p className="text-gray-400 mt-4 text-lg">Here's the honest answer to what most operators ask.</p>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <p className="text-[#F5B731] font-bold text-lg mb-3">{item.q}</p>
              <p className="text-gray-300 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── SECTION 7 — FINAL CTA ───────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-[#F5B731] py-28 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="text-black/60 text-sm font-bold uppercase tracking-widest block mb-6">
          Ready to get organized?
        </span>

        <h2 className="text-5xl md:text-6xl font-black text-black leading-tight mb-6">
          Stop running your business on paper.
          Start running it on DumpTruckBoss.
        </h2>

        <p className="text-black/70 text-xl mb-10">
          Join dump truck operators who have replaced their spreadsheets, paper tickets, and chaos —
          with one simple dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/signup"
            className="px-12 py-5 bg-black text-white font-black text-xl rounded-2xl hover:bg-gray-900 transition-colors shadow-2xl"
          >
            Start Free 7-Day Trial →
          </Link>
          <button
            onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-5 bg-black/10 text-black font-bold text-xl rounded-2xl hover:bg-black/20 transition-colors border-2 border-black/20"
          >
            Watch Demo First
          </button>
        </div>

        <p className="text-black/50 text-sm mt-6">
          No credit card required · Cancel anytime · Set up in 15 minutes
        </p>
      </div>
    </section>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

// ─── Founding Member banner ───────────────────────────────────────────────────
function FoundingMemberBanner() {
  return (
    <div style={{
      background: '#F5B731',
      color: '#1a1a1a',
      textAlign: 'center',
      padding: '10px 16px',
      fontSize: '14px',
      fontWeight: 700,
      lineHeight: 1.4,
    }}>
      🚛 Founding Member offer: First 25 fleets get $99/mo locked in for life.{' '}
      <Link href="/pricing#founding-member" style={{ color: '#1a1a1a', textDecoration: 'underline', fontWeight: 900 }}>
        Claim your spot →
      </Link>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="bg-[#1a1a1a]">
      <FoundingMemberBanner />
      <Nav />
      <Hero />
      <PainPoints />
      <Solution />
      <DemoVideo />
      <WhyDifferent />
      <Objections />
      <FinalCTA />
      <Footer />
    </div>
  )
}
