import { FileText, Radio, Zap, Smartphone, BarChart3, FolderOpen } from 'lucide-react'

const features = [
  {
    icon: FileText,
    title: 'Digital Ticket Management',
    description: 'Capture load tickets from any device in seconds. Job name, material, driver, quantity, and rate — all logged and searchable. Never lose a ticket again.',
    color: 'bg-[#2d7a4f]/10 text-[#2d7a4f]',
  },
  {
    icon: Radio,
    title: 'Smart Dispatch Board',
    description: 'See every truck and driver in real time. Assign jobs, track loads completed per shift, and manage subcontractors — all from one screen.',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    icon: Zap,
    title: 'Automatic Invoice Generation',
    description: 'Select a client, pick the tickets, hit create. Professional PDF invoices ready to send in under 30 seconds. Get paid faster, every time.',
    color: 'bg-[#FFB800]/10 text-[#FFB800]',
  },
  {
    icon: Smartphone,
    title: 'Driver Mobile App',
    description: "Drivers submit their own load tickets from their phones — no app download needed. You get real-time updates without chasing anyone for paperwork.",
    color: 'bg-purple-500/10 text-purple-600',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Revenue Dashboard',
    description: 'Know exactly where your money is coming from. Revenue by driver, by job, by month — clear dashboards with zero confusion.',
    color: 'bg-pink-500/10 text-pink-600',
  },
  {
    icon: FolderOpen,
    title: 'Document Storage',
    description: 'Keep delivery tickets, contracts, and job photos attached to the right records. Everything organized and accessible when a client calls.',
    color: 'bg-orange-500/10 text-orange-600',
  },
]

export default function FeaturesSection() {
  return (
    <section className="py-16 md:py-24 bg-gray-50" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <p className="text-sm font-semibold text-[#2d7a4f] uppercase tracking-wider mb-3">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything you need to run your dump truck business
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            One platform. No spreadsheets. No paper. No chaos.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-200"
              >
                <div className={`inline-flex rounded-xl p-3 mb-4 ${f.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
