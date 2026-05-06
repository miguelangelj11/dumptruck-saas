import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TrialExpiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', background: '#0f1923', backgroundImage: 'radial-gradient(#ffffff06 1px, transparent 1px)', backgroundSize: '24px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="DumpTruckBoss" width={96} height={48}   />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>DumpTruckBoss</span>
          </Link>
        </div>

        {/* Card */}
        <div style={{ background: '#141f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚛</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Your 7-Day Free Trial Has Ended</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '32px' }}>
            Subscribe now to keep your data and continue running your business.
          </p>

          {/* What they had */}
          <div style={{ background: 'rgba(45,122,79,0.12)', border: '1px solid rgba(45,122,79,0.25)', borderRadius: '12px', padding: '20px', marginBottom: '32px', textAlign: 'left' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              You had full access to:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                '✓ Ticket management',
                '✓ Driver dispatch',
                '✓ Invoice generation',
                '✓ Revenue tracking',
                '✓ All your data',
                '✓ Driver management',
              ].map((item) => (
                <div key={item} style={{ fontSize: '14px', color: '#4ade80' }}>{item}</div>
              ))}
            </div>
          </div>

          {/* Subscribe buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <Link
              href="/signup?plan=owner_operator"
              style={{
                display: 'block',
                padding: '14px',
                borderRadius: '10px',
                background: '#f59e0b',
                color: '#0f1923',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Subscribe — $80/mo
              <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.7 }}>Owner Operator Plan</div>
            </Link>
            <Link
              href="/signup?plan=fleet"
              style={{
                display: 'block',
                padding: '14px',
                borderRadius: '10px',
                background: '#2d7a4f',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Subscribe — $150/mo
              <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.7 }}>Fleet Plan</div>
            </Link>
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            Questions?{' '}
            <a href="mailto:contact@dumptruckboss.com" style={{ color: '#4ade80', textDecoration: 'none' }}>
              contact@dumptruckboss.com
            </a>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
          Need 15+ trucks?{' '}
          <Link href="/schedule-demo" style={{ color: '#f59e0b', textDecoration: 'none' }}>Schedule an enterprise demo</Link>
        </p>
      </div>
    </div>
  )
}
