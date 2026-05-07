import Link from 'next/link'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Acceptable Use Policy — DumpTruckBoss',
  description: 'DumpTruckBoss Acceptable Use Policy — rules for using the platform.',
}

const VERSION = '2026-05-07'
const EFFECTIVE = 'May 7, 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default function AcceptableUsePage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Acceptable Use Policy</h1>
          <p className="text-white/50 text-sm">Last Updated: {EFFECTIVE} · Version: {VERSION}</p>
        </div>
      </div>

      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-10 pb-4 border-b border-gray-100">
            <Link href="/" className="text-sm text-[#2d7a4f] hover:underline">← Back to DumpTruckBoss</Link>
            <button
              onClick={() => window.print()}
              className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Print / Save PDF
            </button>
          </div>

          <Section title="1. Purpose">
            <p>This Acceptable Use Policy ("AUP") governs how you may use the DumpTruckBoss platform, APIs, and related services. By accessing or using DumpTruckBoss, you agree to comply with this policy. Violations may result in suspension or termination of your account.</p>
          </Section>

          <Section title="2. Permitted Uses">
            <p>DumpTruckBoss is designed exclusively for legitimate business operations in the transportation and construction industries. Permitted uses include:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Managing dispatch operations, load tickets, and job assignments</li>
              <li>Creating and sending invoices to clients and tracking payments</li>
              <li>Managing drivers, subcontractors, and equipment</li>
              <li>Uploading and processing ticket photos for record-keeping</li>
              <li>Generating revenue reports and performance metrics</li>
              <li>Managing customer relationships via the CRM Pipeline</li>
            </ul>
          </Section>

          <Section title="3. Prohibited Uses">
            <p>You may not use DumpTruckBoss to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Falsify records:</strong> Create, alter, or submit false ticket data, load counts, invoice amounts, or driver records with intent to defraud clients, drivers, or subcontractors</li>
              <li><strong>Wage theft:</strong> Use the platform to underpay or withhold earned compensation from drivers or subcontractors</li>
              <li><strong>Fraud:</strong> Invoice clients for work not performed, or submit fraudulent insurance or compliance documents</li>
              <li><strong>Unauthorized access:</strong> Access other companies' data, attempt to circumvent authentication, or share login credentials</li>
              <li><strong>Abuse AI features:</strong> Attempt to manipulate AI document extraction to produce false records</li>
              <li><strong>Circumvent billing:</strong> Attempt to use the service beyond your plan limits through technical means</li>
              <li><strong>Resell access:</strong> Provide access to DumpTruckBoss to third parties not covered by your subscription</li>
              <li><strong>Data harvesting:</strong> Scrape, export, or aggregate data for purposes unrelated to your own operations</li>
              <li><strong>Illegal purposes:</strong> Use the platform in connection with any unlawful activity including tax evasion, worker misclassification fraud, or regulatory violations</li>
            </ul>
          </Section>

          <Section title="4. Data Accuracy Obligations">
            <p>You are solely responsible for the accuracy of all data you enter into DumpTruckBoss, including:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Load counts, material quantities, and job measurements</li>
              <li>Driver hours, pay rates, and payment amounts</li>
              <li>Client invoice amounts and payment terms</li>
              <li>AI-extracted ticket data — you must verify all AI-generated records before use in payroll or invoicing</li>
            </ul>
            <p className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm"><strong>Important:</strong> DumpTruckBoss AI features assist with data extraction but are not infallible. Using unverified AI-extracted data in financial transactions is a violation of this policy and releases DumpTruckBoss from any resulting liability.</p>
          </Section>

          <Section title="5. Worker Classification">
            <p>DumpTruckBoss is a software tool only. We do not advise on worker classification (employee vs. independent contractor). You are solely responsible for complying with all applicable federal, state, and local labor laws regarding driver and subcontractor classification. Misclassification is a violation of this policy.</p>
          </Section>

          <Section title="6. Security Responsibilities">
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Keep your account credentials secure and not share them with unauthorized parties</li>
              <li>Immediately notify us of any suspected unauthorized access at <a href="mailto:security@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">security@dumptruckboss.com</a></li>
              <li>Not attempt to probe, scan, or test security vulnerabilities of the platform</li>
              <li>Not attempt to reverse engineer any part of the platform</li>
            </ul>
          </Section>

          <Section title="7. Enforcement">
            <p>DumpTruckBoss reserves the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Suspend or terminate accounts that violate this policy, with or without notice depending on severity</li>
              <li>Report suspected fraud or illegal activity to appropriate authorities</li>
              <li>Cooperate with law enforcement investigations involving platform data</li>
              <li>Preserve data relevant to legal proceedings even after account deletion</li>
            </ul>
            <p className="mt-3">Violations that constitute fraud or illegal activity may result in immediate termination without refund.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this policy at any time. We will notify account holders of material changes via email. Continued use of the platform after notification constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="9. Contact">
            <p>Questions about this policy: <a href="mailto:legal@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">legal@dumptruckboss.com</a></p>
          </Section>

          <div className="mt-12 pt-6 border-t border-gray-100 text-xs text-gray-400">
            Version {VERSION} · Effective {EFFECTIVE} · Governing law: State of Georgia, USA
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
