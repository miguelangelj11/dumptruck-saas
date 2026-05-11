import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Terms of Service — DumpTruckBoss',
  description: 'DumpTruckBoss Terms of Service — your agreement with SALAO TRANSPORT INC.',
}

const EFFECTIVE_DATE = 'May 3, 2026'

export default function TermsPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-white/50 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="prose prose-gray max-w-none">

            <p className="text-gray-600 leading-relaxed mb-4">
              These Terms of Service ("Terms") govern your access to and use of the DumpTruckBoss platform
              and related services (collectively, the "Service") operated by <strong>SALAO TRANSPORT INC</strong>,
              doing business as DumpTruckBoss ("DumpTruckBoss," "we," "us," or "our"), a company registered
              in the State of Georgia, USA.
            </p>
            <p className="text-gray-600 leading-relaxed mb-12">
              By creating an account or using the Service, you agree to be bound by these Terms. Please read
              them carefully. If you do not agree to any part of these Terms, do not use the Service.
            </p>

            <Section title="1. Acceptance of Terms">
              <p className="text-gray-600 leading-relaxed">
                By accessing or using DumpTruckBoss, you represent that you are at least 18 years of age, have
                the legal capacity to enter into a binding agreement, and, if using the Service on behalf of a
                business, are authorized to bind that business. These Terms apply to both the individual user
                and the business entity the user represents.
              </p>
            </Section>

            <Section title="2. Description of Service">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss provides a cloud-based software platform designed for dump truck and hauling
                operations. Features include, but are not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Driver dispatch management and scheduling</li>
                <li>Load ticket creation, tracking, and photo upload</li>
                <li>Invoice generation, delivery, and payment tracking</li>
                <li>Revenue and expense reporting and dashboards</li>
                <li>Driver and subcontractor management</li>
                <li>Team role management (Admin, Dispatcher, Driver, Accountant)</li>
                <li>Client and job site management</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any feature or aspect of the Service
                at any time with reasonable notice to active subscribers.
              </p>
            </Section>

            <Section title="3. Subscription Plans and Billing">
              <Subsection title="Available Plans">
                DumpTruckBoss offers the following subscription tiers:
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>Owner Operator Solo Plan</strong> — 1 truck &amp; 1 driver, unlimited tickets, basic invoicing. $25/month.</li>
                  <li><strong>Owner Operator Pro Plan</strong> — Up to 5 trucks &amp; drivers, full dispatch board, revenue analytics. $80/month.</li>
                  <li><strong>Fleet Plan</strong> — Unlimited trucks &amp; drivers, all invoice types, subcontractor management, team access, AI document reader. $200/month.</li>
                  <li><strong>Enterprise Plan</strong> — Custom pricing. Everything in Fleet plus CRM Growth Pipeline, quote builder, advanced profitability, dedicated account manager, and custom integrations. Contact us for pricing.</li>
                </ul>
              </Subsection>
              <Subsection title="Billing Cycle">
                Subscriptions are billed in advance on a monthly or annual basis, depending on the plan you
                select. Your billing cycle begins on the date you subscribe and renews automatically on the same
                date each month or year unless you cancel.
              </Subsection>
              <Subsection title="Price Changes">
                We may change subscription prices with at least 30 days' advance notice by email. Continued use
                of the Service after a price change takes effect constitutes acceptance of the new pricing.
              </Subsection>
              <Subsection title="Payment Processing">
                All payments are processed by Stripe, Inc., a PCI-DSS-compliant third-party payment processor.
                By providing payment information, you authorize us to charge your payment method on a recurring
                basis for the fees applicable to your plan. You represent that you are authorized to use the
                payment method you provide. Failed payments may result in temporary or permanent suspension of
                your account.
              </Subsection>
            </Section>

            <Section title="4. Free Trial Policy">
              <p className="text-gray-600 leading-relaxed mb-4">
                We offer a <strong>7-day free trial</strong> for the Owner Operator Solo, Owner Operator Pro, and Fleet plans. During the
                trial period:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>No credit card is required to start</li>
                <li>You have full access to the features of your selected plan</li>
                <li>No charges are made during the 7-day period</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                At the end of the trial period, you must subscribe to a paid plan to continue using the Service.
                If you do not subscribe, your account will be suspended. Your data will remain available for
                export for 30 days following suspension before permanent deletion.
              </p>
            </Section>

            <Section title="5. Payment Terms and Refund Policy">
              <p className="text-gray-600 leading-relaxed mb-4">
                All subscription fees are due in advance and are <strong>non-refundable</strong>, except:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Where required by applicable law</li>
                <li>In the event of a verified billing error by DumpTruckBoss</li>
                <li>At our sole discretion for exceptional circumstances, upon written request</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                If you believe you have been charged in error, contact us within 30 days of the charge at{' '}
                <a href="mailto:miguelangel.j11@gmail.com" className="text-[#2d7a4f] hover:underline">miguelangel.j11@gmail.com</a>.
              </p>
            </Section>

            <Section title="6. Cancellation Policy">
              <p className="text-gray-600 leading-relaxed mb-4">
                You may cancel your subscription at any time through your account Settings page (Settings →
                Subscription → Manage Billing). Cancellation takes effect at the end of your current paid
                billing period. After cancellation:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>You retain access to the Service through the end of your paid period</li>
                <li>Your account is suspended at the end of the billing period</li>
                <li>Your data remains available for export for 30 days</li>
                <li>After 30 days, your data is permanently and irreversibly deleted</li>
                <li>No pro-rated refunds are issued for unused time</li>
              </ul>
            </Section>

            <Section title="7. User Accounts">
              <p className="text-gray-600 leading-relaxed mb-4">
                When you create an account, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information as needed</li>
                <li>Keep your login credentials confidential and not share your password</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Take responsibility for all activity that occurs under your account</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                Each account is associated with one business entity. Team members (up to the limit of your
                plan) may be added with designated roles. You are responsible for ensuring team members comply
                with these Terms. Account credentials may not be shared with or transferred to third parties
                outside your organization.
              </p>
            </Section>

            <Section title="8. Acceptable Use">
              <p className="text-gray-600 leading-relaxed mb-4">You agree not to use DumpTruckBoss to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Violate any applicable federal, state, or local laws or regulations</li>
                <li>Infringe the intellectual property rights, privacy, or other rights of any third party</li>
                <li>Upload or transmit malicious code, viruses, or any harmful software</li>
                <li>Attempt to gain unauthorized access to other accounts or our systems</li>
                <li>Reverse engineer, decompile, or attempt to extract our source code</li>
                <li>Systematically scrape, crawl, or extract data from the platform</li>
                <li>Use the Service to develop a competing product or service</li>
                <li>Falsify, misrepresent, or submit fraudulent information</li>
                <li>Harass, threaten, or harm any individual through the platform</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to suspend or permanently terminate accounts that violate these terms,
                without notice or refund.
              </p>
            </Section>

            <Section title="9. Data and Privacy">
              <p className="text-gray-600 leading-relaxed mb-4">
                Our collection and use of personal information is governed by our{' '}
                <a href="/privacy" className="text-[#2d7a4f] hover:underline">Privacy Policy</a>, which is
                incorporated into these Terms by reference. By using DumpTruckBoss, you consent to our data
                practices as described in the Privacy Policy.
              </p>
              <p className="text-gray-600 leading-relaxed">
                You retain full ownership of all business data you input into the Service (tickets, invoices,
                driver records, etc.). You grant DumpTruckBoss a limited, non-exclusive license to store,
                process, and display your data solely as necessary to operate and improve the Service. We do
                not sell your data to third parties.
              </p>
            </Section>

            <Section title="10. Intellectual Property">
              <p className="text-gray-600 leading-relaxed mb-4">
                The DumpTruckBoss platform, including its design, software, source code, branding, logos,
                text, graphics, and all other content created by us, is owned by SALAO TRANSPORT INC and
                protected by U.S. and international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-gray-600 leading-relaxed">
                You may not copy, reproduce, modify, distribute, create derivative works of, publicly display,
                or exploit any part of our platform without express written permission from us. Nothing in
                these Terms grants you any license to our intellectual property beyond the right to use the
                Service as described herein.
              </p>
            </Section>

            <Section title="11. Limitation of Liability">
              <p className="text-gray-600 leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SALAO TRANSPORT INC, ITS OFFICERS,
                DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, BUSINESS, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING
                OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE
                POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Our total cumulative liability to you for any claims arising under or related to these Terms
                shall not exceed the total amount you paid us in the twelve (12) months immediately preceding
                the claim. This limitation applies regardless of the form of action, whether in contract, tort,
                negligence, strict liability, or otherwise.
              </p>
            </Section>

            <Section title="12. Indemnification">
              <p className="text-gray-600 leading-relaxed">
                You agree to indemnify, defend, and hold harmless SALAO TRANSPORT INC and its affiliates,
                officers, directors, employees, and agents from and against any claims, liabilities, damages,
                judgments, awards, losses, costs, and expenses (including reasonable attorneys' fees) arising
                out of or relating to: (a) your use of the Service; (b) your violation of these Terms;
                (c) your violation of any third-party rights, including intellectual property or privacy rights;
                or (d) any content or data you submit to the Service.
              </p>
            </Section>

            <Section title="13. Termination">
              <p className="text-gray-600 leading-relaxed mb-4">
                Either party may terminate this agreement at any time. We may suspend or terminate your access
                immediately, without notice or refund, if you materially breach these Terms, engage in
                fraudulent activity, or if required to do so by law. Upon termination for any reason:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Your right to access the Service ceases immediately</li>
                <li>Your data remains available for export for 30 days (unless terminated for fraud)</li>
                <li>After 30 days, your data is permanently deleted from our systems</li>
                <li>Sections that by their nature should survive termination will remain in effect</li>
              </ul>
            </Section>

            <Section title="14. Governing Law and Dispute Resolution">
              <p className="text-gray-600 leading-relaxed mb-4">
                These Terms are governed by and construed in accordance with the laws of the{' '}
                <strong>State of Georgia, USA</strong>, without regard to its conflict of law principles.
                Any legal action or proceeding arising out of or relating to these Terms or the Service shall
                be brought exclusively in the state or federal courts located in Georgia, and you hereby
                consent to the personal jurisdiction of such courts.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Before initiating formal legal proceedings, both parties agree to attempt to resolve disputes
                through good-faith negotiation for at least 30 days. This requirement does not prevent either
                party from seeking emergency injunctive or equitable relief from a court of competent
                jurisdiction.
              </p>
            </Section>

            <Section title="15. Disclaimers">
              <p className="text-gray-600 leading-relaxed mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
                EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, DUMTRUCKBOSS DISCLAIMS ALL
                IMPLIED WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>The Service will be uninterrupted, error-free, or completely secure</li>
                <li>All defects or errors will be corrected</li>
                <li>Results obtained from the Service will be accurate or reliable</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                Your use of the Service is at your sole risk.
              </p>
            </Section>

            <Section title="16. Changes to These Terms">
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes
                by email and by updating the effective date at the top of this page. If you continue using
                DumpTruckBoss after changes take effect, you accept the revised Terms. If you do not agree to
                the revised Terms, you must stop using the Service and cancel your account.
              </p>
            </Section>

            <Section title="17. Contact Information">
              <p className="text-gray-600 leading-relaxed mb-4">
                For questions, concerns, or legal notices regarding these Terms of Service, contact us:
              </p>
              <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-2">
                <p className="font-bold text-gray-900 text-base">SALAO TRANSPORT INC</p>
                <p className="text-gray-500 italic">Operating as DumpTruckBoss</p>
                <p>State of Incorporation: Georgia, USA</p>
                <p>
                  Email:{' '}
                  <a href="mailto:miguelangel.j11@gmail.com" className="text-[#2d7a4f] hover:underline font-medium">
                    miguelangel.j11@gmail.com
                  </a>
                </p>
                <p>Website: <span className="text-[#2d7a4f]">dumptruckboss.com</span></p>
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
      <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-[#2d7a4f]/20">{title}</h2>
      {children}
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 pl-4 border-l-2 border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 mb-1.5">{title}</h3>
      <p className="text-gray-600 leading-relaxed text-sm">{children}</p>
    </div>
  )
}
