import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Privacy Policy — DumpTruckBoss',
  description: 'How DumpTruckBoss collects, uses, and protects your data.',
}

const LAST_UPDATED = 'April 30, 2026'

export default function PrivacyPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="prose prose-gray max-w-none">

            <p className="text-gray-600 leading-relaxed mb-8">
              DumpTruckBoss, Inc. ("DumpTruckBoss," "we," "us," or "our") operates the DumpTruckBoss platform
              — a SaaS product for dispatch, ticketing, invoicing, and fleet management for dump truck and hauling
              companies. This Privacy Policy explains how we collect, use, disclose, and protect information about
              you when you use our services.
            </p>
            <p className="text-gray-600 leading-relaxed mb-12">
              By using our platform, you agree to the practices described in this policy. If you do not agree,
              please discontinue use of the service.
            </p>

            <Section title="1. Information We Collect">
              <Subsection title="Account and Profile Information">
                When you create an account, we collect your name, email address, company name, company address,
                and phone number. This information is used to operate your account and communicate with you about
                the service.
              </Subsection>
              <Subsection title="Business Data You Enter">
                DumpTruckBoss stores operational data that you input into the platform, including: driver records,
                load tickets, job assignments, dispatch records, invoices, revenue data, expense records, and
                subcontractor information. This data belongs to you and is processed solely to provide the service.
              </Subsection>
              <Subsection title="Payment Information">
                Billing is handled by Stripe, a PCI-DSS-compliant payment processor. We do not store your full
                credit card numbers. We retain billing history (amounts, dates, plan details) for accounting
                and support purposes.
              </Subsection>
              <Subsection title="Usage and Technical Data">
                We automatically collect certain technical data when you use the platform: IP address, browser
                type and version, device type, operating system, pages visited, features used, and timestamps.
                This data helps us improve performance, debug issues, and detect abuse.
              </Subsection>
              <Subsection title="Communications">
                If you contact our support team, we retain records of that correspondence. If you subscribe to
                email notifications or updates, we retain your email for that purpose.
              </Subsection>
            </Section>

            <Section title="2. How We Use Your Information">
              <p className="text-gray-600 leading-relaxed mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Provide, operate, and maintain the DumpTruckBoss platform</li>
                <li>Process transactions and send related billing information</li>
                <li>Send service emails (account notifications, ticket approvals, invoice alerts)</li>
                <li>Respond to support requests and troubleshoot problems</li>
                <li>Analyze usage patterns to improve features and performance</li>
                <li>Detect and prevent fraudulent or unauthorized activity</li>
                <li>Comply with legal obligations</li>
                <li>Send product updates and marketing communications (you can opt out at any time)</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                We do not sell your personal information or your business data to third parties.
              </p>
            </Section>

            <Section title="3. Sharing and Disclosure">
              <p className="text-gray-600 leading-relaxed mb-4">
                We do not sell, rent, or trade your personal data. We share information only in these limited circumstances:
              </p>
              <Subsection title="Service Providers">
                We use trusted third-party vendors to operate the platform, including cloud hosting (Supabase/AWS),
                payment processing (Stripe), error monitoring (Sentry), and email delivery. These providers access
                your data only as necessary to perform their services and are bound by confidentiality agreements.
              </Subsection>
              <Subsection title="Legal Requirements">
                We may disclose information if required by law, subpoena, or other legal process, or if we
                believe disclosure is necessary to protect the rights, property, or safety of DumpTruckBoss,
                our users, or the public.
              </Subsection>
              <Subsection title="Business Transfers">
                If DumpTruckBoss is acquired by or merges with another company, your information may be
                transferred as part of that transaction. We will notify you via email and/or a prominent
                notice on the platform before your data is transferred or becomes subject to a different policy.
              </Subsection>
              <Subsection title="With Your Consent">
                We may share your information with other parties when you have given explicit consent to do so.
              </Subsection>
            </Section>

            <Section title="4. Data Security">
              <p className="text-gray-600 leading-relaxed mb-4">
                We implement appropriate technical and organizational safeguards to protect your data, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>TLS/HTTPS encryption for all data in transit</li>
                <li>AES-256 encryption for data at rest</li>
                <li>Row-level security policies that isolate each company's data</li>
                <li>Multi-factor authentication support for accounts</li>
                <li>Regular automated backups with point-in-time recovery</li>
                <li>Access controls limiting employee access to customer data</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                No system is 100% secure. If you believe your account has been compromised, contact us immediately
                at <a href="mailto:security@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">security@dumptruckboss.com</a>.
              </p>
            </Section>

            <Section title="5. Data Retention">
              <p className="text-gray-600 leading-relaxed mb-4">
                We retain your data for as long as your account is active. If you cancel your subscription:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Your data remains accessible for 30 days after cancellation</li>
                <li>After 30 days, your data is permanently deleted from our production systems</li>
                <li>Anonymized usage statistics may be retained indefinitely</li>
                <li>We may retain certain records for legal or regulatory compliance purposes</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                You can export all your data at any time from Settings → Data Export before your account closes.
              </p>
            </Section>

            <Section title="6. Your Rights and Choices">
              <p className="text-gray-600 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information through your account settings</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
                <li><strong>Portability:</strong> Export your business data in CSV format at any time</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing emails using the link in any email we send</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:privacy@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">privacy@dumptruckboss.com</a>.
                We will respond within 30 days.
              </p>
            </Section>

            <Section title="7. Cookies and Tracking">
              <p className="text-gray-600 leading-relaxed mb-4">
                We use cookies and similar technologies to operate the platform and understand usage:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li><strong>Essential cookies:</strong> Required for authentication and session management</li>
                <li><strong>Analytics cookies:</strong> Help us understand how the platform is used (anonymized)</li>
                <li><strong>Preference cookies:</strong> Remember your settings (language, theme)</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                You can control cookies through your browser settings. Disabling essential cookies will
                prevent you from logging in.
              </p>
            </Section>

            <Section title="8. Third-Party Services">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss integrates with third-party services whose privacy practices are governed by
                their own policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li><strong>Stripe</strong> — Payment processing (stripe.com/privacy)</li>
                <li><strong>Supabase</strong> — Database and authentication hosting</li>
                <li><strong>Sentry</strong> — Error monitoring and diagnostics</li>
                <li><strong>Anthropic</strong> — AI assistant (Enterprise plan only)</li>
              </ul>
            </Section>

            <Section title="9. Children's Privacy">
              <p className="text-gray-600 leading-relaxed">
                DumpTruckBoss is a business platform not directed at children under 16. We do not knowingly
                collect personal information from anyone under 16. If you believe we have inadvertently
                collected such information, contact us and we will delete it promptly.
              </p>
            </Section>

            <Section title="10. Changes to This Policy">
              <p className="text-gray-600 leading-relaxed">
                We may update this Privacy Policy from time to time. When we make material changes, we will
                notify you by email and update the "Last updated" date at the top of this page. Your continued
                use of the platform after changes take effect constitutes acceptance of the revised policy.
              </p>
            </Section>

            <Section title="11. Contact Us">
              <p className="text-gray-600 leading-relaxed">
                For privacy-related questions, requests, or concerns, contact us at:
              </p>
              <div className="mt-4 bg-gray-50 rounded-xl p-6 text-sm text-gray-600 space-y-1">
                <p className="font-semibold text-gray-800">DumpTruckBoss, Inc.</p>
                <p>Email: <a href="mailto:privacy@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">privacy@dumptruckboss.com</a></p>
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
