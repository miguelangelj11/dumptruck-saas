const companies = [
  'Atlanta Dirt Works',
  'Southeastern Hauling LLC',
  'Piedmont Fill & Grade',
  'Metro Excavation Services',
  'Blue Ridge Trucking Co',
]

export default function SocialProof() {
  return (
    <section className="bg-[#0f1923] border-y border-white/10 py-6 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="h-4 w-4 text-[#FFB800] fill-[#FFB800]" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-white/60 text-sm font-medium">4.9/5 from 200+ operators</span>
          <span className="text-white/20">·</span>
          <span className="text-white/40 text-sm">Trusted by dump truck companies across the US</span>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex animate-[marquee_20s_linear_infinite] whitespace-nowrap"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        >
          {[...companies, ...companies].map((name, i) => (
            <span key={i} className="inline-flex items-center gap-2 mx-8 text-white/30 text-sm font-medium">
              <span className="h-1 w-1 rounded-full bg-white/20" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
