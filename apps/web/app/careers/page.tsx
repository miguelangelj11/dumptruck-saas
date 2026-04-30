import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { MapPin, Clock, ArrowRight, Coffee, Laptop, Heart, TrendingUp } from 'lucide-react'

export const metadata = {
  title: 'Careers — DumpTruckBoss',
  description: 'Join the team building the future of dump truck and hauling software.',
}

const roles = [
  {
    title: 'Full Stack Engineer',
    team: 'Engineering',
    location: 'Remote (US)',
    type: 'Full-time',
    description:
      'We\'re looking for an engineer who loves building products end-to-end. You\'ll work across the Next.js frontend, Supabase/Postgres backend, and everything in between. We ship fast, iterate on customer feedback, and keep the codebase clean.',
    requirements: [
      '3+ years with TypeScript, React, and Node.js',
      'Experience with PostgreSQL and row-level security',
      'Comfortable owning a feature from design to deploy',
      'Bonus: experience with Supabase, Next.js App Router, or logistics/trucking industry',
    ],
  },
  {
    title: 'Customer Success Manager',
    team: 'Customer Success',
    location: 'Remote (US)',
    type: 'Full-time',
    description:
      'You\'ll be the first point of contact for our customers — helping new accounts get set up, answering support questions, and working directly with operators to make sure the platform fits their workflow. This role shapes how customers experience DumpTruckBoss.',
    requirements: [
      '2+ years in SaaS customer success or support',
      'Strong written and verbal communication',
      'Ability to learn technical products quickly',
      'Bonus: background in trucking, construction, or field operations',
    ],
  },
  {
    title: 'Sales Representative',
    team: 'Sales',
    location: 'Remote (US)',
    type: 'Full-time',
    description:
      'We\'re growing by word of mouth, but we\'re ready to be intentional about it. You\'ll work inbound leads, run product demos, and help operators understand why DumpTruckBoss will save them time and money. No enterprise sales cycles — our deals close fast.',
    requirements: [
      '2+ years in B2B SaaS sales or a related field',
      'Experience running product demos',
      'Self-starter who can manage a pipeline independently',
      'Bonus: existing network in trucking, hauling, or construction',
    ],
  },
]

const benefits = [
  { icon: Laptop,      label: 'Remote-first', detail: 'Work from anywhere in the US' },
  { icon: TrendingUp,  label: 'Equity',       detail: 'Meaningful early-stage options' },
  { icon: Heart,       label: 'Health',        detail: 'Medical, dental, and vision' },
  { icon: Coffee,      label: 'Async culture', detail: 'No pointless meetings' },
]

export default function CareersPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">We're hiring</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Help us modernize<br className="hidden sm:block" /> the hauling industry
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            We're a small team building software that dump truck and hauling operators actually want to use.
            If you want your work to matter quickly, this is the place.
          </p>
        </div>
      </div>

      {/* Culture */}
      <div className="bg-white border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How we work</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  We're a small, distributed team. That means no office politics, no endless meetings, and no
                  layers of approval to ship something. If you see something that needs fixing, you fix it.
                </p>
                <p>
                  We talk to customers constantly — not through NPS surveys, but through real conversations
                  with operators who use the product every day. Everyone on the team knows what customers need
                  and why.
                </p>
                <p>
                  We're early-stage, which means your work has an outsized impact. The features you ship
                  will be used by thousands of operators running their real businesses.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {benefits.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="h-9 w-9 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-[#2d7a4f]" />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Open roles */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Open roles</h2>
          <p className="text-gray-500 mb-10">We're a small team, so every hire matters.</p>

          <div className="space-y-5">
            {roles.map((role) => (
              <div key={role.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{role.title}</h3>
                      <p className="text-sm text-[#2d7a4f] font-medium mt-0.5">{role.team}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                        <MapPin className="h-3 w-3" /> {role.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                        <Clock className="h-3 w-3" /> {role.type}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-600 leading-relaxed mb-5">{role.description}</p>

                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-700 mb-2">What we're looking for</p>
                    <ul className="space-y-1.5">
                      {role.requirements.map((req) => (
                        <li key={req} className="flex items-start gap-2 text-sm text-gray-500">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2d7a4f] shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={`mailto:jobs@dumptruckboss.com?subject=Application: ${role.title}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-colors"
                    style={{ backgroundColor: '#2d7a4f' }}
                  >
                    Apply for this role <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 text-center">
            <p className="font-semibold text-gray-800 mb-1">Don't see your role?</p>
            <p className="text-gray-500 text-sm mb-4">
              We're always interested in people who are great at what they do. Send a note and tell us how you'd fit in.
            </p>
            <a
              href="mailto:jobs@dumptruckboss.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[#2d7a4f] text-sm border border-[#2d7a4f] hover:bg-[#2d7a4f] hover:text-white transition-colors"
            >
              Send a note <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
