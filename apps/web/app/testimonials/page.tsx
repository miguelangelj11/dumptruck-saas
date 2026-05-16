'use client'

import Link from 'next/link'

// ─────────────────────────────────────────
// TESTIMONIAL DATA
// Replace with real testimonials as they come in
// Photos go in /public/images/testimonials/
// ─────────────────────────────────────────
const TESTIMONIALS = [
  {
    id: 1,
    name: 'Ivan Jimenez',
    company: 'Camila Grading LLC',
    location: 'Atlanta, GA',
    trucks: 1,
    photo: '/images/testimonials/placeholder-1.jpg',
    quote: 'Before DumpTruckBoss I was running everything out of a notebook and group texts. First week I used it I found two tickets I would have never invoiced. Already paid for itself.',
    isFoundingMember: true,
    rating: 5,
  },
  {
    id: 2,
    name: 'James Caldwell',
    company: 'Caldwell Transport Co.',
    location: 'Conyers, GA',
    trucks: 7,
    photo: '/images/testimonials/placeholder-2.jpg',
    quote: "The dispatch board is exactly what we needed. My drivers know where to go, I know what's happening, and my wife stopped getting calls at dinner asking where somebody is supposed to be.",
    isFoundingMember: true,
    rating: 5,
  },
  {
    id: 3,
    name: 'Darnell Brooks',
    company: 'Brooks Aggregate LLC',
    location: 'Macon, GA',
    trucks: 2,
    photo: '/images/testimonials/placeholder-3.jpg',
    quote: "I'm a one man show and this software made me look like I run a real operation. Invoices go out same day now. Clients actually pay faster.",
    isFoundingMember: true,
    rating: 5,
  },
  {
    id: 4,
    name: 'Tony Guerrero',
    company: 'Guerrero Dirt Works',
    location: 'Lawrenceville, GA',
    trucks: 5,
    photo: '/images/testimonials/placeholder-4.jpg',
    quote: 'The AI ticket import alone is worth it. I upload the broker pay sheet and it pulls everything out automatically. Used to take me Sunday night — now takes two minutes.',
    isFoundingMember: true,
    rating: 5,
  },
  {
    id: 5,
    name: 'Kevin Tate',
    company: 'Tate Trucking Inc.',
    location: 'McDonough, GA',
    trucks: 12,
    photo: '/images/testimonials/placeholder-5.jpg',
    quote: 'Managing subcontractors was a nightmare before this. Now I can see every ticket, every payment, and their COIs — all in one place. No more phone tag.',
    isFoundingMember: false,
    rating: 5,
  },
]

const STATS = [
  { value: '500+',  label: 'Tickets Tracked' },
  { value: '$2M+',  label: 'Revenue Managed' },
  { value: '4.9★',  label: 'Average Rating' },
  { value: '24',    label: 'Founding Members' },
]

export default function TestimonialsPage() {
  const foundingMembers = TESTIMONIALS.filter(t => t.isFoundingMember)
  const otherOperators  = TESTIMONIALS.filter(t => !t.isFoundingMember)

  return (
    <div className="min-h-screen bg-[#1a1a1a]">

      {/* ─────────────────────────────────── */}
      {/* HERO */}
      {/* ─────────────────────────────────── */}
      <section className="pt-28 pb-14 px-6 text-center relative overflow-hidden">
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle, #F5B731 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest block mb-4">
            Real Operators. Real Results.
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6">
            What Operators Are{' '}
            <span className="text-[#F5B731]">Saying</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Dump truck companies across the Southeast replaced their spreadsheets,
            paper tickets, and Sunday-night paperwork with DumpTruckBoss.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────── */}
      {/* STATS BAND */}
      {/* ─────────────────────────────────── */}
      <section className="border-y border-white/10 py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-black text-[#F5B731]">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────── */}
      {/* FOUNDING MEMBERS */}
      {/* ─────────────────────────────────── */}
      {foundingMembers.length > 0 && (
        <section className="pt-16 pb-8 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="text-[#F5B731] text-lg">⭐</span>
                <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest">
                  Founding Members
                </span>
                <span className="text-[#F5B731] text-lg">⭐</span>
              </div>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="space-y-4">
              {foundingMembers.map(t => (
                <TestimonialCard key={t.id} testimonial={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────── */}
      {/* OTHER OPERATORS */}
      {/* ─────────────────────────────────── */}
      {otherOperators.length > 0 && (
        <section className="pt-8 pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-500 text-sm uppercase tracking-widest">
                More Operators
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="space-y-4">
              {otherOperators.map(t => (
                <TestimonialCard key={t.id} testimonial={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────── */}
      {/* CLOSING CTA */}
      {/* ─────────────────────────────────── */}
      <section className="bg-[#F5B731] py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-black mb-4">
            Ready to join them?
          </h2>
          <p className="text-black/70 text-lg mb-8">
            Start your free trial today. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-black text-white font-black text-lg rounded-2xl hover:bg-gray-900 transition-colors shadow-2xl"
          >
            Start Free Trial →
          </Link>
          <p className="text-black/50 text-sm mt-4">
            Solo starts at $15/mo · Fleet Founding Member $99/mo
          </p>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────
// TESTIMONIAL CARD
// ─────────────────────────────────────────
type Testimonial = typeof TESTIMONIALS[number]

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const initials = testimonial.name
    .split(' ')
    .map(n => n[0])
    .join('')

  return (
    <div
      className={`relative bg-white/5 rounded-2xl p-6 transition-all duration-200 border ${
        testimonial.isFoundingMember
          ? 'border-[#F5B731]/30 hover:border-[#F5B731]/50 hover:bg-white/[0.07]'
          : 'border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      <div className="flex flex-col md:flex-row gap-5">

        {/* ── Photo + Identity ── */}
        <div className="flex items-start gap-4 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-2xl overflow-hidden border-2 relative ${
                testimonial.isFoundingMember ? 'border-[#F5B731]' : 'border-white/20'
              }`}
            >
              {/* Initials always rendered underneath; photo sits on top */}
              <div className="absolute inset-0 bg-[#F5B731]/20 flex items-center justify-center text-[#F5B731] font-black text-lg select-none">
                {initials}
              </div>
              {testimonial.photo && (
                <img
                  src={testimonial.photo}
                  alt={testimonial.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              )}
            </div>
          </div>

          <div className="min-w-[170px]">
            <p className="font-black text-white text-lg leading-tight">{testimonial.name}</p>
            <p className="text-[#F5B731] font-semibold text-sm mt-0.5">{testimonial.company}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              <span className="text-xs text-gray-400">📍 {testimonial.location}</span>
              <span className="text-xs text-gray-400">
                🚛 {testimonial.trucks} truck{testimonial.trucks !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-0.5 mt-2">
              {Array.from({ length: testimonial.rating }).map((_, i) => (
                <span key={i} className="text-[#F5B731] text-xs">★</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Quote ── */}
        <div className="flex-1 flex items-center">
          <div>
            <span className="text-[#F5B731] text-4xl font-black leading-none block mb-1 opacity-60">
              "
            </span>
            <p className="text-gray-200 text-base md:text-lg leading-relaxed -mt-3">
              {testimonial.quote}
            </p>
          </div>
        </div>

        {/* ── Founding Member Badge ── */}
        {testimonial.isFoundingMember && (
          <div className="flex-shrink-0 flex md:flex-col items-center justify-center md:justify-start gap-2 md:gap-1 md:border-l md:border-[#F5B731]/20 md:pl-5">
            <div className="flex flex-col items-center gap-1.5 bg-[#F5B731]/10 border border-[#F5B731]/30 rounded-2xl px-4 py-3 text-center min-w-[100px]">
              <span className="text-2xl">⭐</span>
              <p className="text-[#F5B731] text-xs font-black uppercase tracking-wide leading-tight">
                Founding<br />Member
              </p>
              <p className="text-[#F5B731]/60 text-xs">$99/mo locked</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
