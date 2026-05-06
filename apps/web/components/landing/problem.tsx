const painPoints = [
  {
    emoji: '📄',
    title: 'Drowning in Paper Tickets',
    description: 'Stacks of handwritten tickets piling up in your cab, office, and truck bed. Trying to match them to jobs weeks later when a client calls asking where their invoice is.',
  },
  {
    emoji: '😤',
    title: 'Invoice Nightmare',
    description: "Manually adding up loads in Excel, copy-pasting driver names, getting the math wrong at midnight. Clients wait weeks for invoices and you're leaving cash on the table.",
  },
  {
    emoji: '🤷',
    title: 'No Visibility',
    description: "You have no idea which driver is your most profitable, which jobs are costing you money, or where your revenue went last month. Flying blind isn't a strategy.",
  },
]

export default function Problem() {
  return (
    <section className="py-16 md:py-24 bg-white" id="problem">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Sound familiar?
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Every dump truck operator knows these pains. Most just accept them as part of the job.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {painPoints.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-gray-200 p-5 md:p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
            >
              <div className="text-4xl mb-4">{p.emoji}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{p.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            If this sounds like your business,{' '}
            <span className="text-[#F5B731]">DumpTruckBoss was built for you.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
