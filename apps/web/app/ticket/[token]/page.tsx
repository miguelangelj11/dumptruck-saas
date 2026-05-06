import { createClient } from '@supabase/supabase-js'
import { verifyDispatchToken } from '@/lib/dispatch-token'
import MobileTicketForm from './mobile-ticket-form'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type Props = { params: Promise<{ token: string }> }

export default async function MobileTicketPage({ params }: Props) {
  const { token } = await params

  const dotIdx = token.indexOf('.')
  if (dotIdx < 1) return <ErrorPage message="Invalid ticket link." />

  const dispatchId = token.substring(0, dotIdx)
  const hmac       = token.substring(dotIdx + 1)

  if (!verifyDispatchToken(dispatchId, hmac)) {
    return <ErrorPage message="This link is invalid or has expired." />
  }

  const admin = getAdmin()
  const { data: dispatch } = await admin
    .from('dispatches')
    .select('id, driver_name, truck_number, job_name, job_id, dispatch_date, start_time, instructions, status, rate, rate_type, material, company_id')
    .eq('id', dispatchId)
    .maybeSingle()

  if (!dispatch) return <ErrorPage message="Dispatch not found." />

  const d = dispatch as Record<string, unknown>

  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url')
    .eq('id', d.company_id as string)
    .maybeSingle()

  const co = company as Record<string, unknown> | null

  return (
    <MobileTicketForm
      dispatchId={dispatchId}
      hmacToken={hmac}
      driverName={d.driver_name as string}
      truckNumber={d.truck_number as string | null}
      jobName={d.job_name as string}
      dispatchDate={d.dispatch_date as string}
      startTime={d.start_time as string | null}
      instructions={d.instructions as string | null}
      material={d.material as string | null}
      rate={d.rate as number | null}
      rateType={d.rate_type as string | null}
      companyName={co?.name as string | null}
      companyLogo={co?.logo_url as string | null}
      alreadyCompleted={(d.status as string) === 'completed'}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{ fontFamily: 'sans-serif', background: '#fef2f2', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #fecaca', padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ color: '#dc2626', fontSize: 22, margin: '0 0 8px' }}>Invalid Link</h1>
        <p style={{ color: '#374151', fontSize: 15, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}
