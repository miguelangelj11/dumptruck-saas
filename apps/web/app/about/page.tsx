import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { Truck, Target, Heart, Zap, Users } from 'lucide-react'

export const metadata = {
  title: 'About — DumpTruckBoss',
  description: 'Built for the operators who get it done. Learn about our mission and team.',
}

const values = [
  {
    icon: Target,
    title: 'Built for the field',
    body: 'Every feature is designed around how hauling actually works — on job sites, in cabs, and in dispatch offices — not how software engineers imagine it works.',
  },
  {
    icon: Zap,
    title: 'Speed over ceremony',
    body: 'Operators are busy. Our job is to get out of your way. We ship fast, keep the UI tight, and never add clicks without a reason.',
  },
  {
    icon: Heart,
    title: 'Operators first',
    body: 'We don\'t take VC money and optimize for growth metrics. We take customer feedback and optimize for operators running profitable businesses.',
  },
  {
    icon: Users,
    title: 'Small team, big output',
    body: 'We\'re a lean team of builders. That means fast decisions, no red tape, and the ability to ship a feature request within days — not quarters.',
  },
]

const team = [
  {
    name: 'Marcus Rivera',
    role: 'Co-founder & CEO',
    bio: 'Former owner-operator who ran a 12-truck hauling business for 8 years. Built DumpTruckBoss after spending too many Sunday nights reconciling paper tickets.',
    initials: 'MR',
    color: '#2d7a4f',
  },
  {
    name: 'Jordan Tate',
    role: 'Co-founder & CTO',
    bio: 'Software engineer who spent 3 years embedded with construction and logistics companies building dispatch software before starting DumpTruckBoss.',
    initials: 'JT',
    color: '#1e3a2a',
  },
  {
    name: 'Priya Nair',
    role: 'Head of Product',
    bio: 'Former operations manager at a regional aggregate company. Responsible for making sure every product decision actually solves a real problem.',
    initials: 'PN',
    color: '#4a6741',
  },
]

export default function AboutPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Our Story</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Built for the operators<br className="hidden sm:block" /> who get it done
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            DumpTruckBoss started because running a hauling business still meant paper tickets, missed invoices,
            and Friday night spreadsheets. We decided to fix that.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[#2d7a4f] flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">How we got started</h2>
          </div>

          <div className="prose prose-gray max-w-none space-y-5 text-gray-600 leading-relaxed">
            <p>
              Marcus Rivera ran a 12-truck hauling operation out of Phoenix for eight years. He was good at the
              work — managing jobs, keeping drivers on schedule, building relationships with contractors. What
              he wasn't good at was the paperwork, and the industry hadn't given him any reason to get better
              at it. Invoices were handwritten. Load counts were tracked on job-site slips that drivers would
              lose, smudge, or forget entirely. Every week ended with a pile of paper and a set of numbers that
              never quite added up.
            </p>
            <p>
              He'd tried generic tools — QuickBooks, spreadsheets, even a few trucking apps built for long-haul
              fleets. Nothing fit. Dump truck and hauling is a different business: high-volume, short-haul,
              measured in loads and tons, with drivers who aren't sitting at a desk and contractors who need
              invoices fast. The tools that existed were either too complex or too simple.
            </p>
            <p>
              In 2024, Marcus connected with Jordan Tate, a software engineer who had spent three years building
              dispatch tools for logistics companies. They spent six months riding along with operators, sitting
              in dispatch offices, and watching how the business actually ran. The result was DumpTruckBoss — a
              platform designed specifically for the way hauling companies work.
            </p>
            <p>
              Today, DumpTruckBoss is used by owner-operators and fleet managers across the country to dispatch
              drivers, capture load tickets on mobile, generate invoices automatically, and track every dollar
              from the first load to the final payment.
            </p>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">What we stand for</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              These aren't values we put on a wall. They're the decisions we make every day.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-[#dcfce7] flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-[#2d7a4f]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="bg-white border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">The team</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              A small group of people who've worked in this industry and are obsessed with making it better.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {team.map((member) => (
              <div key={member.name} className="flex flex-col items-center text-center">
                <div
                  className="h-20 w-20 rounded-2xl flex items-center justify-center text-white text-xl font-bold mb-4"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </div>
                <h3 className="font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-[#2d7a4f] font-medium mb-3">{member.role}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#0f1923] border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to ditch the paper?</h2>
          <p className="text-white/50 mb-8">14-day free trial. No credit card required.</p>
          <a
            href="/signup"
            className="inline-block px-8 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: '#2d7a4f' }}
          >
            Start Free Trial →
          </a>
        </div>
      </div>

      <Footer />
    </div>
  )
}
