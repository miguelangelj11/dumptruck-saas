const steps = [
  {
    step: '01',
    title: 'Set Up Your Account',
    description: 'Add your company, invite your drivers, and configure your trucks in minutes. No training sessions, no IT help needed — if you can send a text, you can set up DumpTruckBoss.',
  },
  {
    step: '02',
    title: 'Dispatch & Track',
    description: 'Assign jobs from the dispatch board. Drivers submit load tickets from their phones as they haul. Every load is logged in real time — no chasing paperwork at the end of the day.',
  },
  {
    step: '03',
    title: 'Invoice & Get Paid',
    description: 'Select a client, pick the tickets, and generate a professional PDF invoice in under 30 seconds. Send it straight from the app and track when it gets paid.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-16 md:py-24 bg-white" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <p className="text-sm font-semibold text-[#F5B731] uppercase tracking-wider mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Up and running in minutes
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Three steps to replace the paper chaos for good.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gray-200 z-0" />

          {steps.map((s) => (
            <div key={s.step} className="relative text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f1923] text-white text-xl font-bold mb-6 relative z-10">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
