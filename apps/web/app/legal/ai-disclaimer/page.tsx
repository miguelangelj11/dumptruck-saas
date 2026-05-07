import Link from 'next/link'
import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'AI & OCR Disclaimer — DumpTruckBoss',
  description: 'How DumpTruckBoss uses AI for document reading, accuracy limitations, and user responsibilities.',
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

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-sm leading-relaxed">
      <div className="flex gap-2">
        <span className="text-lg shrink-0">⚠️</span>
        <div>{children}</div>
      </div>
    </div>
  )
}

export default function AiDisclaimerPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">AI & OCR Disclaimer</h1>
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

          <WarningBox>
            <strong>AI-generated data requires human review before use in invoices, payroll, or any financial transaction.</strong> DumpTruckBoss is not liable for losses resulting from unreviewed AI-extracted data.
          </WarningBox>

          <Section title="1. How AI Works in DumpTruckBoss">
            <p>DumpTruckBoss uses artificial intelligence (AI) and optical character recognition (OCR) to assist users with:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Ticket photo extraction:</strong> Reading paper load tickets photographed by drivers and extracting fields such as date, load count, material type, job name, and truck number</li>
              <li><strong>Document import:</strong> Parsing uploaded PDFs, invoices, and dispatch documents to auto-populate records</li>
              <li><strong>AI dispatch recommendations:</strong> Suggesting job assignments based on historical patterns</li>
              <li><strong>CRM insights:</strong> Scoring and prioritizing leads based on engagement signals</li>
            </ul>
            <p className="mt-3">The AI models used include Anthropic Claude (for document extraction and analysis). DumpTruckBoss sends document images and text to Anthropic's API for processing. See our <Link href="/privacy" className="text-[#2d7a4f] hover:underline">Privacy Policy</Link> for data handling details.</p>
          </Section>

          <Section title="2. Accuracy Limitations">
            <WarningBox>
              AI and OCR technology is not 100% accurate. DumpTruckBoss AI features may produce errors including incorrect numbers, misread text, wrong dates, or missing fields — particularly with:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Poor quality or blurry photos</li>
                <li>Handwritten text (especially cursive or unclear writing)</li>
                <li>Non-standard ticket formats</li>
                <li>Faded or damaged documents</li>
                <li>Multiple overlapping data fields</li>
              </ul>
            </WarningBox>
            <p>AI confidence scores (shown as percentages in the platform) indicate the model's self-assessed certainty — they are estimates, not guarantees of accuracy.</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 text-sm">
              <li><span className="font-semibold text-green-700">85%+ confidence:</span> High likelihood of accuracy, but still requires review</li>
              <li><span className="font-semibold text-amber-700">60–84% confidence:</span> Moderate uncertainty — careful review required</li>
              <li><span className="font-semibold text-red-700">Below 60% confidence:</span> Low confidence — treat as draft only, do not use without manual verification</li>
            </ul>
          </Section>

          <Section title="3. User Responsibility — Required Human Review">
            <p><strong>You are required to review and verify all AI-extracted data before:</strong></p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Generating or sending invoices to clients</li>
              <li>Calculating or issuing driver or subcontractor pay</li>
              <li>Submitting records for tax, audit, or regulatory purposes</li>
              <li>Making business decisions based on extracted data</li>
            </ul>
            <p className="mt-3">Using AI-extracted data without review is a violation of our <Link href="/legal/acceptable-use" className="text-[#2d7a4f] hover:underline">Acceptable Use Policy</Link>.</p>
          </Section>

          <Section title="4. Limitation of Liability">
            <p>DumpTruckBoss, its officers, employees, and affiliates are <strong>not liable</strong> for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Financial losses resulting from errors in AI-extracted ticket or document data</li>
              <li>Overpayment or underpayment of drivers or subcontractors due to misread ticket data</li>
              <li>Client disputes arising from invoices generated using unverified AI data</li>
              <li>Tax or regulatory penalties resulting from AI-extracted records that were not manually verified</li>
              <li>Any consequential, indirect, or punitive damages arising from use of AI features</li>
            </ul>
            <p className="mt-3">This limitation applies regardless of whether DumpTruckBoss was advised of the possibility of such losses.</p>
          </Section>

          <Section title="5. How to Report AI Errors">
            <p>If you believe the AI produced an incorrect result, please:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-2">
              <li>Correct the record manually in the platform — your correction is always authoritative</li>
              <li>If the error is reproducible or systematic, report it to <a href="mailto:support@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">support@dumptruckboss.com</a> with the original document (if possible)</li>
              <li>Include the ticket/document ID, the field that was wrong, and the correct value</li>
            </ol>
            <p className="mt-3">Reports help us improve accuracy for all users.</p>
          </Section>

          <Section title="6. Data Sent to AI Providers">
            <p>When you use AI features, document content (images and/or text) is transmitted to third-party AI providers (currently Anthropic). This data is processed to produce extracted text fields and is subject to Anthropic's data handling policies. DumpTruckBoss does not use your document data to train AI models.</p>
            <p className="mt-3">Do not upload documents containing Social Security Numbers, full payment card numbers, or other sensitive PII beyond what is ordinarily on a load ticket or dispatch document.</p>
          </Section>

          <Section title="7. Contact">
            <p>Questions about AI features or to report accuracy issues: <a href="mailto:support@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">support@dumptruckboss.com</a></p>
            <p className="mt-1">Legal questions: <a href="mailto:legal@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">legal@dumptruckboss.com</a></p>
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
