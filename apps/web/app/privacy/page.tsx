import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Privacy Policy — DumpTruckBoss',
  description: 'How DumpTruckBoss (operated by SALAO TRANSPORT INC) collects, uses, and protects your data.',
}

const EFFECTIVE_DATE = 'May 3, 2026'

export default function PrivacyPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-white/50 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="prose prose-gray max-w-none">

            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>SALAO TRANSPORT INC</strong>, doing business as DumpTruckBoss ("DumpTruckBoss," "we,"
              "us," or "our"), operates the DumpTruckBoss platform — a cloud-based SaaS product for dispatch,
              ticketing, invoicing, and fleet management for dump truck and hauling companies.
            </p>
            <p className="text-gray-600 leading-relaxed mb-12">
              This Privacy Policy explains what information we collect, how we use it, who we share it with,
              and your rights regarding your data. By using our platform, you agree to the practices described
              in this policy. If you disagree, please discontinue use of the Service.
            </p>

            <Section title="1. Information We Collect">
              <Subsection title="Account and Identity Information">
                When you create an account, we collect your name, email address, company name, company address,
                and phone number. This information is required to operate your account and communicate with you
                about the Service.
              </Subsection>
              <Subsection title="Business Data You Enter">
                DumpTruckBoss stores all operational data you input into the platform, including: driver names
                and contact information, load tickets, job assignments, dispatch records, client company
                records, invoices and invoice line items, revenue and payment data, expense records, and
                subcontractor information. This data belongs entirely to you and is processed solely to
                provide the Service.
              </Subsection>
              <Subsection title="Payment and Billing Information">
                Payments are processed by Stripe, Inc., a PCI-DSS-compliant third-party processor. We do
                not store your full credit card number, CVV, or raw payment credentials. We do retain billing
                records including transaction amounts, dates, subscription plan details, and Stripe customer
                and subscription IDs for accounting, support, and subscription management purposes.
              </Subsection>
              <Subsection title="Usage and Technical Data">
                We automatically collect certain technical data when you interact with the platform: IP
                address, browser type and version, device type, operating system, pages and features visited,
                time spent, and session timestamps. This data is used to monitor platform performance, debug
                issues, and detect abuse.
              </Subsection>
              <Subsection title="Communications and Support">
                If you contact our support team via email, we retain a record of that correspondence. If you
                opt into email notifications (invoice alerts, ticket approvals, missing ticket alerts), we
                retain your email address for that purpose and send transactional emails via Resend.
              </Subsection>
              <Subsection title="Photos and File Uploads">
                When you upload ticket photos or company logo images, those files are stored in secure cloud
                storage. File uploads are associated with your company account and used solely to display
                information within the platform.
              </Subsection>
            </Section>

            <Section title="2. How We Use Your Information">
              <p className="text-gray-600 leading-relaxed mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Provide, operate, and maintain the DumpTruckBoss platform</li>
                <li>Process transactions, manage subscriptions, and send billing-related communications</li>
                <li>Send transactional emails (account confirmations, invoices, ticket alerts, team invitations)</li>
                <li>Respond to support requests and troubleshoot problems</li>
                <li>Monitor and analyze usage patterns to improve features and performance</li>
                <li>Detect, prevent, and investigate fraudulent or unauthorized activity</li>
                <li>Enforce our Terms of Service and other legal agreements</li>
                <li>Comply with applicable legal obligations</li>
                <li>Send product updates and marketing communications (you may opt out at any time)</li>
              </ul>
              <p className="text-gray-600 leading-relaxed font-medium text-[#1e3a2a]">
                We do not sell, rent, or trade your personal information or business data to any third party.
              </p>
            </Section>

            <Section title="3. Data Storage and Security">
              <p className="text-gray-600 leading-relaxed mb-4">
                Your data is stored in the <strong>United States</strong> on servers operated by our
                infrastructure providers. We implement appropriate technical and organizational safeguards,
                including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>TLS/HTTPS encryption for all data in transit</li>
                <li>AES-256 encryption for data at rest</li>
                <li>Row-level security policies that strictly isolate each company's data</li>
                <li>Multi-factor authentication (MFA) available for all accounts</li>
                <li>Regular automated database backups with point-in-time recovery</li>
                <li>Access controls limiting internal employee access to customer data</li>
                <li>Periodic security reviews and monitoring for unauthorized access</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                No system is completely secure. If you believe your account has been compromised, contact
                us immediately at{' '}
                <a href="mailto:miguelangel.j11@gmail.com" className="text-[#2d7a4f] hover:underline">
                  miguelangel.j11@gmail.com
                </a>.
              </p>
            </Section>

            <Section title="4. Third-Party Services">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss integrates with the following third-party services to operate the platform.
                Each provider is subject to their own privacy policies:
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Provider</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { name: 'Stripe', purpose: 'Payment processing and subscription billing' },
                      { name: 'Supabase', purpose: 'Database hosting, authentication, and file storage (servers in USA/AWS)' },
                      { name: 'Vercel', purpose: 'Web application hosting and deployment' },
                      { name: 'Resend', purpose: 'Transactional email delivery (invoices, alerts, invites)' },
                    ].map((row) => (
                      <tr key={row.name} className="even:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                        <td className="px-4 py-3 text-gray-600">{row.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                These providers access your data only as necessary to perform their services and are bound
                by data processing agreements and/or confidentiality obligations.
              </p>
            </Section>

            <Section title="5. Sharing and Disclosure">
              <p className="text-gray-600 leading-relaxed mb-4">
                We do not sell, rent, or share your personal data except in the following limited circumstances:
              </p>
              <Subsection title="Service Providers">
                We share data with the third-party vendors listed above solely to operate and improve the
                platform. These vendors may not use your data for their own purposes.
              </Subsection>
              <Subsection title="Legal Requirements">
                We may disclose information if required by law, court order, subpoena, government request,
                or regulatory requirement, or if we reasonably believe disclosure is necessary to protect
                the rights, property, or safety of DumpTruckBoss, our users, or the public.
              </Subsection>
              <Subsection title="Business Transfers">
                If SALAO TRANSPORT INC is acquired by or merges with another company, your information may
                be transferred as part of that transaction. We will provide notice by email and/or a prominent
                platform notice before your data is transferred or becomes subject to a different privacy
                policy.
              </Subsection>
              <Subsection title="With Your Consent">
                We may share information with other parties if you explicitly consent to such sharing.
              </Subsection>
            </Section>

            <Section title="6. User Rights">
              <p className="text-gray-600 leading-relaxed mb-4">
                You have the following rights with respect to your personal data:
              </p>
              <ul className="list-none space-y-3 text-gray-600">
                {[
                  { right: 'Access', desc: 'Request a copy of the personal data we hold about you.' },
                  { right: 'Correction', desc: 'Update or correct inaccurate account information through your Settings page.' },
                  { right: 'Deletion', desc: 'Request deletion of your account and personal data. Business records may be retained for legal compliance.' },
                  { right: 'Data Portability', desc: 'Export all your business data (tickets, invoices, drivers) in CSV format at any time via Settings → Data Export.' },
                  { right: 'Marketing Opt-Out', desc: 'Unsubscribe from marketing emails using the unsubscribe link in any email, or by contacting us directly.' },
                  { right: 'Restriction', desc: 'Request that we restrict processing of your data in certain circumstances.' },
                ].map(({ right, desc }) => (
                  <li key={right} className="flex gap-3">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2d7a4f]/10 px-2.5 py-0.5 text-xs font-semibold text-[#2d7a4f] mt-0.5 h-fit">{right}</span>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
              <p className="text-gray-600 leading-relaxed mt-4">
                To exercise any of these rights, email us at{' '}
                <a href="mailto:miguelangel.j11@gmail.com" className="text-[#2d7a4f] hover:underline">
                  miguelangel.j11@gmail.com
                </a>. We will respond within 30 days.
              </p>
            </Section>

            <Section title="7. Cookie Policy">
              <p className="text-gray-600 leading-relaxed mb-4">
                We use cookies and similar browser-based storage technologies to operate the platform:
              </p>
              <ul className="list-none space-y-3 text-gray-600 mb-4">
                {[
                  { type: 'Essential', desc: 'Required for authentication, session management, and security. Cannot be disabled without breaking the platform.' },
                  { type: 'Functional', desc: 'Remember your preferences such as language selection and UI settings.' },
                  { type: 'Analytics', desc: 'Collect anonymized data about how the platform is used to improve performance and identify issues.' },
                ].map(({ type, desc }) => (
                  <li key={type} className="flex gap-3">
                    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 mt-0.5 h-fit">{type}</span>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
              <p className="text-gray-600 leading-relaxed">
                You can manage cookies through your browser settings. Note that disabling essential cookies
                will prevent you from logging into the platform.
              </p>
            </Section>

            <Section title="8. Data Retention">
              <p className="text-gray-600 leading-relaxed mb-4">
                We retain your data for as long as your account is active. Upon account cancellation or
                termination:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Your data remains accessible and exportable for 30 days</li>
                <li>After 30 days, your data is permanently and irreversibly deleted from production systems</li>
                <li>Aggregated, anonymized usage statistics may be retained indefinitely</li>
                <li>We may retain certain records (billing history, legal correspondence) as required by law</li>
              </ul>
            </Section>

            <Section title="9. Children's Privacy">
              <p className="text-gray-600 leading-relaxed">
                DumpTruckBoss is a business-to-business platform and is not directed at children under the
                age of 16. We do not knowingly collect personal information from anyone under 16. If you
                believe we have inadvertently collected such information, contact us immediately and we will
                delete it promptly.
              </p>
            </Section>

            <Section title="10. Changes to This Policy">
              <p className="text-gray-600 leading-relaxed">
                We may update this Privacy Policy from time to time. When we make material changes, we will
                notify you by email and update the effective date at the top of this page. Your continued
                use of the platform after changes take effect constitutes your acceptance of the revised
                policy. We encourage you to review this policy periodically.
              </p>
            </Section>

            <Section title="11. Governing Law">
              <p className="text-gray-600 leading-relaxed">
                This Privacy Policy is governed by the laws of the <strong>State of Georgia, USA</strong>.
                Any disputes relating to this policy shall be subject to the exclusive jurisdiction of the
                courts located in Georgia.
              </p>
            </Section>

            <Section title="12. Contact Us">
              <p className="text-gray-600 leading-relaxed mb-4">
                For privacy-related questions, requests, complaints, or to exercise your data rights:
              </p>
              <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-700 space-y-2">
                <p className="font-bold text-gray-900 text-base">SALAO TRANSPORT INC</p>
                <p className="text-gray-500 italic">Operating as DumpTruckBoss</p>
                <p>State: Georgia, USA</p>
                <p>
                  Email:{' '}
                  <a href="mailto:miguelangel.j11@gmail.com" className="text-[#2d7a4f] hover:underline font-medium">
                    miguelangel.j11@gmail.com
                  </a>
                </p>
                <p>Website: <span className="text-[#2d7a4f]">dumptruckboss.com</span></p>
              </div>
              <p className="text-gray-500 text-sm mt-3">We aim to respond to all privacy inquiries within 30 days.</p>
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
