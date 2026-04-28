const testimonials = [
  {
    quote: "I've been running 8 trucks for 11 years and I was still doing tickets on paper. Now my drivers enter loads on their phones, I generate invoices same-day, and I got paid $18k faster last month alone. Should have done this years ago.",
    name: 'Marcus T.',
    company: 'Webb Hauling Co, Georgia',
    initials: 'MT',
    color: 'bg-[#2d7a4f]',
  },
  {
    quote: "We manage 6 crews across 3 job sites. Keeping track of who hauled what used to be a full-time job. DumpTruckBoss gave me that time back. The dispatch board alone is worth every penny.",
    name: 'Roberto S.',
    company: 'Lone Star Aggregate, Texas',
    initials: 'RS',
    color: 'bg-[#1e3a2a]',
  },
  {
    quote: "I run 12 trucks and I was losing money on missed invoices and underbilling. With DumpTruckBoss I have a paper trail for every load. First month using it I invoiced $9,200 more than the month before.",
    name: 'Angela W.',
    company: 'Sunshine Fill & Grade, Florida',
    initials: 'AW',
    color: 'bg-blue-600',
  },
]

export default function Testimonials() {
  return (
    <section className="py-24 bg-[#0f1923]" id="testimonials">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-3">Testimonials</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Operators who made the switch
          </h2>
          <p className="text-white/50 text-lg">Real results from real dump truck companies.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 transition-colors"
            >
              <div className="flex mb-4 gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-[#FFB800] fill-[#FFB800]" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${t.color} flex items-center justify-center text-sm font-bold text-white`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
