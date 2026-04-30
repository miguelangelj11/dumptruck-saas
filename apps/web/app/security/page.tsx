import Nav from '@/components/landing/nav'
import Footer from '@/components/landing/footer'
import { Shield, Lock, Server, Eye, AlertTriangle, RefreshCw } from 'lucide-react'

export const metadata = {
  title: 'Security — DumpTruckBoss',
  description: 'How DumpTruckBoss protects your business data.',
}

const LAST_UPDATED = 'April 30, 2026'

const pillars = [
  {
    icon: Lock,
    title: 'Encryption',
    body: 'All data is encrypted in transit using TLS 1.2+ and at rest using AES-256. Backups are encrypted before leaving our servers.',
  },
  {
    icon: Server,
    title: 'Infrastructure',
    body: 'Hosted on enterprise-grade cloud infrastructure with redundant availability zones, DDoS protection, and automated failover.',
  },
  {
    icon: Eye,
    title: 'Access Controls',
    body: 'Row-level security ensures each company can only access its own data. Employee access to production data is restricted and audited.',
  },
  {
    icon: RefreshCw,
    title: 'Backups',
    body: 'Automated daily backups with point-in-time recovery. We can restore any account to any minute within the last 7 days.',
  },
  {
    icon: AlertTriangle,
    title: 'Monitoring',
    body: '24/7 uptime monitoring, anomaly detection, and automated alerts. Incidents are investigated and resolved with full post-mortems.',
  },
  {
    icon: Shield,
    title: 'Authentication',
    body: 'Secure password hashing (bcrypt), optional two-factor authentication (TOTP), and session management with automatic expiry.',
  },
]

export default function SecurityPage() {
  return (
    <div className="bg-[#0f1923] min-h-screen flex flex-col">
      <Nav />

      {/* Hero */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-semibold text-[#4ade80] uppercase tracking-wider mb-4">Trust &amp; Safety</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Security</h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Your business data is valuable. Here's how we protect it.
          </p>
          <p className="text-white/30 text-sm mt-4">Last updated: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Security pillars */}
      <div className="bg-[#0f1923] border-t border-white/5 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="h-10 w-10 rounded-xl bg-[#2d7a4f]/30 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-[#4ade80]" />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed content */}
      <div className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="prose prose-gray max-w-none">

            <Section title="Infrastructure Security">
              <p className="text-gray-600 leading-relaxed mb-4">
                DumpTruckBoss runs on Supabase (built on AWS), one of the world's most reliable cloud
                infrastructure providers. Our deployment uses:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Isolated PostgreSQL database instances per region</li>
                <li>Virtual private cloud (VPC) with strict inbound/outbound rules</li>
                <li>Automatic scaling to handle traffic spikes without service degradation</li>
                <li>DDoS mitigation at the network edge</li>
                <li>Redundant storage with geographic replication</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                Our physical infrastructure is housed in SOC 2 Type II certified data centers. We do not operate
                our own physical servers.
              </p>
            </Section>

            <Section title="Data Encryption">
              <p className="text-gray-600 leading-relaxed mb-4">All data is protected at every layer:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li><strong>In transit:</strong> TLS 1.2 or higher for all connections. HTTP requests are automatically redirected to HTTPS.</li>
                <li><strong>At rest:</strong> AES-256 encryption for all stored data, including database rows, file uploads, and backups.</li>
                <li><strong>Passwords:</strong> Stored as bcrypt hashes. We never store plaintext passwords and cannot retrieve them.</li>
                <li><strong>API keys:</strong> Stored as one-way hashes. Shown only once at creation time.</li>
              </ul>
            </Section>

            <Section title="Access Controls and Isolation">
              <p className="text-gray-600 leading-relaxed mb-4">
                Multi-tenant data isolation is enforced at the database level using Row Level Security (RLS):
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Every database query is automatically scoped to the authenticated company's records</li>
                <li>It is architecturally impossible for one company to access another company's data</li>
                <li>Role-based permissions within a company (Admin, Dispatcher, Driver, Accountant)</li>
                <li>Drivers can only submit and view their own tickets</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                DumpTruckBoss employees do not have routine access to customer data. When access is required
                for support purposes, it requires explicit authorization and is logged.
              </p>
            </Section>

            <Section title="Authentication">
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Passwords must meet minimum complexity requirements</li>
                <li>Optional TOTP-based two-factor authentication (Google Authenticator, Authy)</li>
                <li>Sessions expire after periods of inactivity</li>
                <li>Email verification required for new accounts and email changes</li>
                <li>Rate limiting on login attempts to prevent brute-force attacks</li>
                <li>Account lockout after repeated failed login attempts</li>
              </ul>
            </Section>

            <Section title="Backups and Recovery">
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Automated backups run daily with a 7-day retention window</li>
                <li>Point-in-time recovery available to restore data to any minute within the retention window</li>
                <li>Backups are stored in a separate region from primary data</li>
                <li>Recovery procedures are tested quarterly</li>
              </ul>
            </Section>

            <Section title="Monitoring and Incident Response">
              <p className="text-gray-600 leading-relaxed mb-4">
                We maintain continuous monitoring across our systems:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Real-time uptime monitoring with automatic alerts</li>
                <li>Application error tracking and performance monitoring via Sentry</li>
                <li>Anomaly detection for unusual access patterns or data volumes</li>
                <li>Security event logging with tamper-proof audit trails</li>
              </ul>
              <p className="text-gray-600 leading-relaxed">
                In the event of a confirmed security incident affecting your data, we will notify affected
                customers by email within 72 hours of discovery, in accordance with applicable regulations.
              </p>
            </Section>

            <Section title="Responsible Disclosure">
              <p className="text-gray-600 leading-relaxed mb-4">
                We take security reports seriously. If you discover a vulnerability in DumpTruckBoss, please
                report it to us privately before disclosing it publicly. We commit to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mb-4">
                <li>Acknowledging your report within 2 business days</li>
                <li>Providing a timeline for investigation and remediation</li>
                <li>Notifying you when the issue is resolved</li>
                <li>Crediting you publicly (if you'd like) for the finding</li>
              </ul>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <p className="text-sm font-semibold text-gray-800 mb-1">Report a vulnerability</p>
                <p className="text-sm text-gray-600">
                  Email:{' '}
                  <a href="mailto:security@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">
                    security@dumptruckboss.com
                  </a>
                  {' '}— PGP key available on request.
                </p>
              </div>
            </Section>

            <Section title="Questions">
              <p className="text-gray-600 leading-relaxed">
                For security questions, vendor assessments, or compliance inquiries, contact{' '}
                <a href="mailto:security@dumptruckboss.com" className="text-[#2d7a4f] hover:underline">
                  security@dumptruckboss.com
                </a>.
              </p>
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
