import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Terms of Service — DumpTruckBoss',
  description: 'DumpTruckBoss Terms of Service — your agreement with us.',
}

const LAST_UPDATED = 'April 30, 2026'

export default function TermsPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="prose prose-gray max-w-none">

            <p className="text-gray-600 leading-relaxed mb-8">
              These Terms of Service ("Terms") govern your access to and use of the DumpTruckBoss platform and
              services provided by DumpTruckBoss, Inc. ("DumpTruckBoss," "we," "us," or "our"). By creating an
              account or using our services, you agree to be bound by these Terms.
            </p>
            <p className="text-gray-600 leading-relaxed mb-12">
              Please read these Terms carefully. If you do not agree to any part of these Terms, you must not
              use our services.
            </p>

            <Section title="1. Acceptance of Terms">
              <p className="text-gray-600 leading-relaxed">
                By accessing or using DumpTruckBoss, you confirm that you are at least 18 years old, have the
                legal capacity to enter into this agreement, and are authorized to bind the business entity on
                whose behalf you are using the service (if applicable). If you are using DumpTruckBoss on behalf
                of a company, these Terms bind both you and that company.
              </p>
            </Section>

            <Section title="2. Description of Service">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss provides a cloud-based platform for dump truck and hauling companies, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Driver dispatch management</li>
                <li>Load ticket creation and approval</li>
                <li>Invoice generation and tracking</li>
                <li>Revenue and expense reporting</li>
                <li>Driver and subcontractor management</li>
                <li>Team and role management</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any feature of the service at any time
                with reasonable notice.
              </p>
            </Section>

            <Section title="3. Account Registration">
              <p className="text-gray-600 leading-relaxed mb-4">
                To use DumpTruckBoss, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Keep your password secure and not share it with others</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Be responsible for all activity that occurs under your account</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                You may not create accounts for others without authorization. Each account is associated with
                one company. Team members may be added with designated roles under your company account.
              </p>
            </Section>

            <Section title="4. Billing and Payment">
              <Subsection title="Free Trial">
                We offer a 14-day free trial on paid plans, with no credit card required. At the end of the
                trial, you must subscribe to continue using the service.
              </Subsection>
              <Subsection title="Subscriptions">
                Paid subscriptions are billed in advance on a monthly or annual basis. Prices are listed on
                our pricing page and may change with 30 days' notice. All fees are non-refundable except as
                required by law or as described in our refund policy.
              </Subsection>
              <Subsection title="Payment Processing">
                Payments are processed by Stripe. By providing payment information, you authorize us to charge
                your payment method on a recurring basis. Failed payments may result in service suspension.
              </Subsection>
              <Subsection title="Cancellation">
                You may cancel your subscription at any time through your account settings. Cancellation takes
                effect at the end of your current billing period. You retain access to your data for 30 days
                after cancellation.
              </Subsection>
            </Section>

            <Section title="5. Acceptable Use">
              <p className="text-gray-600 leading-relaxed mb-4">You agree not to use DumpTruckBoss to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe the intellectual property rights of others</li>
                <li>Upload malicious code, viruses, or any harmful software</li>
                <li>Attempt to gain unauthorized access to other accounts or our systems</li>
                <li>Reverse engineer, decompile, or attempt to extract the source code</li>
                <li>Scrape, crawl, or systematically extract data from the platform</li>
                <li>Use the service to build a competing product</li>
                <li>Submit false or misleading information</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to suspend or terminate accounts that violate these terms.
              </p>
            </Section>

            <Section title="6. Intellectual Property">
              <p className="text-gray-600 leading-relaxed mb-4">
                <strong>Our IP:</strong> DumpTruckBoss and its original content, features, and functionality are
                owned by DumpTruckBoss, Inc. and protected by copyright, trademark, and other intellectual
                property laws. You may not copy, modify, distribute, or create derivative works based on our
                platform without written permission.
              </p>
              <p className="text-gray-600 leading-relaxed">
                <strong>Your Data:</strong> You retain full ownership of all data you upload or create in
                DumpTruckBoss. You grant us a limited license to store, process, and display your data
                solely for the purpose of providing the service.
              </p>
            </Section>

            <Section title="7. Privacy">
              <p className="text-gray-600 leading-relaxed">
                Our collection and use of personal information is governed by our{' '}
                <a href="/privacy" className="text-[#2d7a4f] hover:underline">Privacy Policy</a>, which is
                incorporated into these Terms. By using DumpTruckBoss, you agree to our data practices as
                described there.
              </p>
            </Section>

            <Section title="8. Confidentiality">
              <p className="text-gray-600 leading-relaxed">
                Both parties agree to keep confidential any non-public information received from the other
                that is designated as confidential or that reasonably should be understood to be confidential.
                This includes your business data, pricing, and any proprietary technology we share. This
                obligation survives termination of your account.
              </p>
            </Section>

            <Section title="9. Disclaimers">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss is provided "as is" and "as available" without warranties of any kind, express
                or implied. We do not warrant that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>The service will be uninterrupted or error-free</li>
                <li>All defects will be corrected</li>
                <li>The service is free of viruses or harmful components</li>
                <li>The results obtained from using the service will be accurate</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We disclaim all implied warranties, including merchantability, fitness for a particular purpose,
                and non-infringement, to the fullest extent permitted by law.
              </p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p className="text-gray-600 leading-relaxed mb-4">
                To the maximum extent permitted by law, DumpTruckBoss, Inc. and its officers, directors,
                employees, and agents shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages, including loss of profits, data, business, or goodwill, even if we have
                been advised of the possibility of such damages.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Our total cumulative liability for any claims under these Terms is limited to the amount you
                paid us in the 12 months preceding the claim.
              </p>
            </Section>

            <Section title="11. Indemnification">
              <p className="text-gray-600 leading-relaxed">
                You agree to indemnify, defend, and hold harmless DumpTruckBoss, Inc. and its affiliates from
                any claims, liabilities, damages, and expenses (including reasonable legal fees) arising out of
                your use of the service, your violation of these Terms, or your violation of any rights of
                a third party.
              </p>
            </Section>

            <Section title="12. Termination">
              <p className="text-gray-600 leading-relaxed mb-4">
                Either party may terminate this agreement at any time. We may suspend or terminate your access
                immediately if you materially breach these Terms. Upon termination:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Your right to access the service ceases immediately</li>
                <li>Your data remains available for 30 days for export</li>
                <li>After 30 days, your data is permanently deleted</li>
                <li>Provisions that by their nature should survive termination will do so</li>
              </ul>
            </Section>

            <Section title="13. Governing Law and Disputes">
              <p className="text-gray-600 leading-relaxed mb-4">
                These Terms are governed by and construed in accordance with the laws of the State of Delaware,
                without regard to its conflict of law principles.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Any disputes arising from these Terms or your use of the service shall first be addressed
                through good-faith negotiation. If that fails, disputes shall be resolved by binding
                arbitration in accordance with the AAA Commercial Arbitration Rules. You waive any right
                to a jury trial or to participate in a class action.
              </p>
            </Section>

            <Section title="14. Changes to These Terms">
              <p className="text-gray-600 leading-relaxed">
                We may revise these Terms from time to time. We will notify you of material changes by email
                and by updating the "Last updated" date above. If you continue using DumpTruckBoss after
                changes take effect, you accept the revised Terms. If you do not agree, you must stop using
                the service.
              </p>
            </Section>

            <Section title="15. Contact">
              <p className="text-gray-600 leading-relaxed">
                Questions about these Terms? Contact us:
              </p>
              <div className="mt-4 bg-gray-50 rounded-xl p-6 text-sm text-gray-600 space-y-1">
                <p className="font-semibold text-gray-800">DumpTruckBoss, Inc.</p>
                <p>Email: <a href="mailto:legal@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">legal@dumptruckboss.com</a></p>
              </div>
            </Section>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">{title}</h2>
      {children}
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{children}</p>
    </div>
  )
}
