import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Metadata } from 'next'
import ImportDispatchButton from './ImportDispatchButton'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const admin = getAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select('job_name, companies(name)')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single()

  if (!job) return { title: 'Dispatch Not Found – DumpTruckBoss' }
  const sender = (job.companies as { name?: string } | null)?.name ?? 'A contractor'
  return {
    title: `${sender} is offering you work – DumpTruckBoss`,
    description: `Dispatch: ${job.job_name}`,
  }
}

export default async function PublicDispatchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = getAdmin()

  const { data: job } = await admin
    .from('jobs')
    .select('*, companies(id, name, phone, email, logo_url)')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single()

  if (!job) notFound()

  const expired = job.share_expires_at && new Date(job.share_expires_at) < new Date()

  const sender = job.companies as { id: string; name: string; phone?: string; email?: string; logo_url?: string } | null

  function fmt(d: string | null) {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dtb-logo.png" alt="DumpTruckBoss" className="h-10 object-contain mx-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;ve received a dispatch offer</h1>
          <p className="text-sm text-gray-500 mt-1">Review the details below and import it into your account</p>
        </div>

        {expired ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-lg font-bold text-red-700">This link has expired</p>
            <p className="text-sm text-red-500 mt-1">Please contact the sender for a new link.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Sender banner */}
            <div className="bg-[#1e3a2a] px-5 py-4 flex items-center gap-3">
              {sender?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sender.logo_url} alt={sender.name} className="h-10 w-10 rounded-full object-cover bg-white" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#F5B731] flex items-center justify-center text-[#1e3a2a] font-bold text-lg">
                  {sender?.name?.charAt(0) ?? '?'}
                </div>
              )}
              <div>
                <p className="text-xs text-white/60 font-medium">From</p>
                <p className="text-white font-bold text-base leading-tight">{sender?.name ?? 'Unknown Company'}</p>
              </div>
            </div>

            {/* Job details */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Job Name</p>
                <p className="text-xl font-bold text-gray-900">{job.job_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {job.location && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                    <p className="text-sm text-gray-800">{job.location}</p>
                  </div>
                )}
                {job.material && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Material</p>
                    <p className="text-sm text-gray-800">{job.material}</p>
                  </div>
                )}
                {job.rate != null && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Rate</p>
                    <p className="text-sm font-semibold text-gray-900">${Number(job.rate).toFixed(2)} / {job.rate_type ?? 'load'}</p>
                  </div>
                )}
                {(job.start_date || job.end_date) && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Schedule</p>
                    <p className="text-sm text-gray-800">
                      {fmt(job.start_date)}{job.end_date ? ` – ${fmt(job.end_date)}` : ''}
                    </p>
                  </div>
                )}
              </div>

              {job.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}

              {/* Sender contact */}
              {(sender?.phone || sender?.email) && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Sender Contact</p>
                  <div className="flex flex-wrap gap-3">
                    {sender?.phone && (
                      <a href={`tel:${sender.phone}`} className="text-sm text-[#1e3a2a] font-medium hover:underline">
                        📞 {sender.phone}
                      </a>
                    )}
                    {sender?.email && (
                      <a href={`mailto:${sender.email}`} className="text-sm text-[#1e3a2a] font-medium hover:underline">
                        ✉️ {sender.email}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Expiry notice */}
              {job.share_expires_at && (
                <p className="text-xs text-gray-400 text-center">
                  Link expires {new Date(job.share_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              <ImportDispatchButton shareToken={token} jobName={job.job_name} />
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Not on DumpTruckBoss?{' '}
          <Link href="/signup" className="text-[#1e3a2a] font-medium hover:underline">
            Create a free account
          </Link>{' '}
          to manage dispatches, drivers, and invoices.
        </p>
      </div>
    </div>
  )
}
