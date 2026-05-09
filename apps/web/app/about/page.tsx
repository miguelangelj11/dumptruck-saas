import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'About — DumpTruckBoss',
  description: 'Built by dump truck operators for dump truck operators. The real story behind DumpTruckBoss.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ─── SECTION A — HERO ─── */}
      <section className="bg-[#1a1a1a] pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* Copy side */}
            <div>
              <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block">
                About DumpTruckBoss
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
                Built by dump truck operators.{' '}
                <span className="text-[#F5B731]">
                  For dump truck operators.
                </span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                I&apos;m Miguel Jimenez. I drive dump trucks for a living,
                run a fleet with my father in Atlanta, and built
                DumpTruckBoss because nothing else was made for the
                way we actually work.
              </p>
            </div>

            <div className="flex justify-center md:justify-end">
              <div className="relative">
                <div className="w-80 h-96 rounded-2xl overflow-hidden border-4 border-[#F5B731]/30 bg-gray-800 flex items-center justify-center">
                  <span className="text-8xl">🚛</span>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-[#F5B731] text-black px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                  🚛 Active Operator Since 2020
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── SECTION B — THE REAL STORY ─── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-3xl mx-auto">

          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block">
            The Origin
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-10">
            How DumpTruckBoss got built
            <span className="block text-gray-500 font-normal text-xl mt-2">
              The real story
            </span>
          </h2>

          <div className="space-y-6 text-lg text-gray-700 leading-relaxed">

            <p>
              I grew up around dump trucks. My father has been hauling
              for years, and the business runs in our family the way
              some families have a restaurant or a farm. I started
              driving full-time at 22. Four years later, I&apos;m a partner
              in our company, and we still do what we&apos;ve always done —
              hauling and transporting aggregates. Asphalt, dirt,
              milling, rock, anything construction sites need moved.
            </p>

            <p>
              Over the past few years we&apos;ve worked some of the biggest
              highway projects on the East Coast — pieces of I-85,
              I-285, and right now we&apos;re on a contract for I-20.
              The work is good.
            </p>

            {/* Pullquote — problem */}
            <blockquote className="border-l-4 border-[#F5B731] pl-6 py-2 my-8 bg-amber-50 rounded-r-xl pr-6">
              <p className="text-xl font-semibold text-gray-800 italic">
                &ldquo;The business of running the business?
                That part was killing us.&rdquo;
              </p>
            </blockquote>

            <p>
              Driving the trucks was only half my job. The other half
              was the back end — dispatching our drivers, dispatching
              the subcontractors who run trucks under us, chasing
              tickets, building invoices, trying to figure out which
              jobs actually made money. Every single one of those tasks
              lived in its own system: a notebook, a text thread, a
              spreadsheet, a stack of paper tickets in the cab.
            </p>

            <p>
              As we grew, the duct tape stopped holding. Tickets went
              missing. Invoices went out late or never went out at all.
              I&apos;d spend Sunday nights in front of a stack of paper
              trying to reconcile the week. Family dinners got
              interrupted by phone calls about a load that didn&apos;t get
              logged or a truck that didn&apos;t get paid.
            </p>

            <p>
              I started realizing I&apos;d built a business that owned me,
              not the other way around.
            </p>

            {/* Turning point callout */}
            <div className="bg-[#1a1a1a] text-white p-8 rounded-2xl my-8">
              <p className="text-lg leading-relaxed">
                So my brother and I started building DumpTruckBoss.
                He&apos;s a software guy. I&apos;m the one who knew exactly what
                was broken. We built it for our company first — every
                feature solves a problem I&apos;d hit personally that
                morning, that week, that month.
              </p>
            </div>

            <p>
              Dispatching from one screen. Drivers submitting tickets
              from their phones with photos. Invoices generating
              themselves. Knowing in real time which trucks and which
              drivers were actually making us money.
            </p>

            <p>
              Once it was running, something I didn&apos;t expect happened:
              I got my time back. Sundays stopped being paperwork days.
              Dinners stopped getting interrupted. I could see exactly
              what was happening across the whole operation without
              driving to the yard.
            </p>

            {/* Pullquote — resolution */}
            <blockquote className="border-l-4 border-green-400 pl-6 py-2 my-8 bg-green-50 rounded-r-xl pr-6">
              <p className="text-xl font-semibold text-gray-800 italic">
                &ldquo;That was the moment I realized this needed to exist
                for every dump truck operator who&apos;s been duct-taping
                their business together the way we were.&rdquo;
              </p>
            </blockquote>

          </div>
        </div>
      </section>

      {/* ─── SECTION C — WHY IT MATTERS ─── */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block">
            The Mission
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-8">
            Why DumpTruckBoss exists
          </h2>
          <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
            <p>
              DumpTruckBoss isn&apos;t software built by people who studied
              trucking from a distance. It&apos;s software built by an
              operator, in an operator&apos;s voice, for the way operators
              actually run.
            </p>
            <p>
              Every screen, every workflow, every alert is something I
              personally needed and now use every day in our own fleet.
            </p>
            <p>
              If you&apos;re a one-truck owner-operator trying to keep paper
              tickets straight, or you&apos;re running a small fleet and
              your dispatcher is your wife&apos;s iPhone — this was built
              for you. The whole point of it is to give you back the
              thing you actually went into business for: the freedom to
              run your shop your way, and the time to actually live
              your life when the trucks are parked.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION D — TEAM ─── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block text-center">
            The Team
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-12 text-center">
            Who&apos;s behind it
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Miguel */}
            <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-[#F5B731]/20 hover:border-[#F5B731] transition-colors">
              <div className="w-24 h-24 rounded-full bg-[#1a1a1a] mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black border-4 border-[#F5B731]">
                MJ
              </div>
              <h3 className="text-xl font-bold text-gray-900">Miguel Jimenez</h3>
              <p className="text-[#F5B731] font-semibold text-sm mb-3">Founder &amp; Operator</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Second-generation dump truck operator and partner in
                our family hauling business in Atlanta. Built
                DumpTruckBoss because I needed it.
              </p>
            </div>

            {/* Angelo */}
            <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-[#F5B731] transition-colors">
              <div className="w-24 h-24 rounded-full bg-[#1a1a1a] mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black border-4 border-gray-600">
                AJ
              </div>
              <h3 className="text-xl font-bold text-gray-900">Angelo Jimenez</h3>
              <p className="text-[#F5B731] font-semibold text-sm mb-3">Co-founder &amp; Engineer</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Software engineer. Built DumpTruckBoss with me from
                the ground up. The reason every screen actually works
                the way it should.
              </p>
            </div>

            {/* Angel */}
            <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-[#F5B731] transition-colors">
              <div className="w-24 h-24 rounded-full bg-[#1a1a1a] mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black border-4 border-gray-600">
                AJ
              </div>
              <h3 className="text-xl font-bold text-gray-900">Angel Jimenez</h3>
              <p className="text-[#F5B731] font-semibold text-sm mb-3">Operations Partner</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Decades in the hauling business. The reason I know
                what real operators need — and the first one to test
                every feature in the real world.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ─── SECTION E — REAL WORK REAL RESULTS ─── */}
      <section className="bg-[#1a1a1a] py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block text-center">
            Real Work
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-center">
            Real projects. Real results.
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            We don&apos;t just build software. We run trucks on these
            projects every week.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {['I-85 Resurfacing', 'I-285 Infrastructure', 'I-20 Active Contract', 'Atlanta Metro Projects'].map(p => (
              <span key={p} className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white text-sm font-medium">
                🛣️ {p}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { number: '4+',   label: 'Years Operating',  sub: 'active hauling'    },
              { number: '3',    label: 'Major Highways',   sub: 'I-85, I-285, I-20' },
              { number: '500+', label: 'Tickets Logged',   sub: 'in our own fleet'  },
              { number: '10+',  label: 'Hours/Week Saved', sub: 'on admin work'     },
            ].map(stat => (
              <div key={stat.label} className="text-center p-6 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-4xl font-black text-[#F5B731] mb-1">{stat.number}</p>
                <p className="text-white font-semibold text-sm">{stat.label}</p>
                <p className="text-gray-500 text-xs mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION F — THE PROMISE ─── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <span className="text-[#F5B731] text-sm font-bold uppercase tracking-widest mb-4 block text-center">
            What We Stand For
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-12 text-center">
            The promise
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔧',
                title: 'Built by operators.',
                body: "Every feature comes from a real problem we hit running our own fleet. If it doesn't solve something real, it doesn't ship.",
              },
              {
                icon: '🎯',
                title: 'No fluff.',
                body: "We don't add buttons because they look cool. We add them because they save you a phone call, a Sunday, or a missed invoice.",
              },
              {
                icon: '👨‍👩‍👧‍👦',
                title: 'Family-first.',
                body: 'We built this to take time back. To get off the phone at dinner. We hope it does the same for you.',
              },
            ].map(item => (
              <div key={item.title} className="p-8 bg-gray-50 rounded-2xl border-b-4 border-[#F5B731]">
                <span className="text-4xl block mb-4">{item.icon}</span>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION G — CLOSING CTA ─── */}
      <section className="bg-[#1a1a1a] py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Try DumpTruckBoss free.
          </h2>
          <p className="text-xl text-gray-400 mb-3">
            Set up in under 15 minutes.
            Send your first invoice today.
          </p>
          <p className="text-sm text-gray-500 mb-10">
            No credit card required to start.
          </p>
          <a
            href="/signup"
            className="inline-block px-12 py-5 bg-[#F5B731] text-black font-black text-xl rounded-2xl hover:bg-yellow-400 transition-colors shadow-2xl shadow-amber-900/30"
          >
            Start Free 7-Day Trial →
          </a>
          <p className="text-gray-600 text-sm mt-6">
            Join operators running real fleets on DumpTruckBoss today.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
