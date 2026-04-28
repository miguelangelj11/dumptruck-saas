import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getDriverContext } from '@/lib/get-driver-context'
import { createClient } from '@/lib/supabase/server'
import { Plus, Clock, CheckCircle, AlertCircle, Truck, MapPin, Users } from 'lucide-react'

const ticketStatusConfig = {
  pending:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  disputed: { label: 'Modified', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
}

async function acceptDispatch(formData: FormData) {
  'use server'
  const id = formData.get('dispatchId') as string
  const supabase = await createClient()
  await supabase.from('dispatches').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/driver')
}

async function completeDispatch(formData: FormData) {
  'use server'
  const id = formData.get('dispatchId') as string
  const supabase = await createClient()
  await supabase.from('dispatches').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/driver')
}

export default async function DriverHomePage() {
  const driver = await getDriverContext()
  if (!driver) redirect('/login')

  const supabase = await createClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]!
  const dayOfWeek = now.getDay()
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysToMon)
  const weekStartStr = weekStart.toISOString().split('T')[0]!

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const { data: rawDispatches } = await supabase
    .from('dispatches')
    .select('id, job_id, status, start_time, instructions, loads_completed, accepted_at, created_at')
    .eq('company_id', driver.companyId)
    .eq('driver_name', driver.driverName)
    .eq('dispatch_date', todayStr)
    .not('status', 'eq', 'completed')
    .order('created_at', { ascending: false })

  const activeDispatches = rawDispatches ?? []

  const jobIds = activeDispatches.map(d => d.job_id).filter(Boolean) as string[]
  const { data: jobs } = jobIds.length > 0
    ? await supabase.from('jobs').select('id, job_name, contractor, location').in('id', jobIds)
    : { data: [] }
  const jobMap = new Map((jobs ?? []).map(j => [j.id, j]))

  const { data: tickets } = await supabase
    .from('loads')
    .select('id, job_name, date, status, hours_worked, modification_reason')
    .eq('company_id', driver.companyId)
    .eq('driver_name', driver.driverName)
    .eq('submitted_by_driver', true)
    .gte('date', weekStartStr)
    .lte('date', todayStr)
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {driver.driverName.split(' ')[0]}!</h1>
        <p className="text-gray-500 text-sm mt-0.5">{dateLabel}</p>
      </div>

      {/* Today's dispatch cards */}
      {activeDispatches.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Today&apos;s Jobs</h2>
          {activeDispatches.map(d => {
            const job = d.job_id ? jobMap.get(d.job_id) : null
            const isDispatched = d.status === 'dispatched'
            const isAccepted   = d.status === 'accepted'
            const isWorking    = d.status === 'working'

            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Status stripe */}
                <div className={`h-1.5 w-full ${
                  isWorking  ? 'bg-green-500' :
                  isAccepted ? 'bg-blue-500'  :
                               'bg-gray-300'
                }`} />

                <div className="p-4 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base leading-tight">
                        {job?.job_name ?? 'Job Assignment'}
                      </p>
                      {d.start_time && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Start: {d.start_time}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      isWorking  ? 'bg-green-100 text-green-700' :
                      isAccepted ? 'bg-blue-100 text-blue-700'   :
                                   'bg-gray-100 text-gray-600'
                    }`}>
                      {isWorking  ? `Working · ${d.loads_completed} load${d.loads_completed !== 1 ? 's' : ''}` :
                       isAccepted ? 'Accepted' :
                                    'New Job'}
                    </span>
                  </div>

                  {/* Job details */}
                  {(job?.contractor || job?.location) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {job.contractor && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Users className="h-3 w-3" />{job.contractor}
                        </span>
                      )}
                      {job.location && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{job.location}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Instructions */}
                  {d.instructions && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">Special Instructions</p>
                      <p className="text-sm text-amber-800">{d.instructions}</p>
                    </div>
                  )}

                  {/* Actions: Dispatched → big Accept button */}
                  {isDispatched && (
                    <form action={acceptDispatch}>
                      <input type="hidden" name="dispatchId" value={d.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-[#2d7a4f] text-white py-4 text-lg font-black active:scale-95 transition-transform shadow-md"
                      >
                        Accept Job
                      </button>
                    </form>
                  )}

                  {/* Actions: Accepted */}
                  {isAccepted && (
                    <div className="space-y-2 pt-1">
                      <Link
                        href="/driver/submit"
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1e3a2a] text-white py-3.5 text-sm font-bold active:scale-95 transition-transform"
                      >
                        <Plus className="h-4 w-4" /> Submit First Ticket
                      </Link>
                      <form action={completeDispatch}>
                        <input type="hidden" name="dispatchId" value={d.id} />
                        <button
                          type="submit"
                          className="w-full rounded-xl border-2 border-gray-200 text-gray-600 py-3 text-sm font-semibold active:scale-95 transition-transform hover:border-gray-300 hover:bg-gray-50"
                        >
                          Done for the Day
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Actions: Working */}
                  {isWorking && (
                    <div className="space-y-2 pt-1">
                      {/* Load counter */}
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-4xl font-black text-green-700">{d.loads_completed}</p>
                        <p className="text-xs text-green-600 font-medium mt-0.5">loads submitted today</p>
                      </div>
                      <Link
                        href="/driver/submit"
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1e3a2a] text-white py-3.5 text-sm font-bold active:scale-95 transition-transform"
                      >
                        <Plus className="h-4 w-4" /> Submit Another Ticket
                      </Link>
                      <form action={completeDispatch}>
                        <input type="hidden" name="dispatchId" value={d.id} />
                        <button
                          type="submit"
                          className="w-full rounded-xl border-2 border-gray-200 text-gray-600 py-3 text-sm font-semibold active:scale-95 transition-transform hover:border-gray-300 hover:bg-gray-50"
                        >
                          Done for the Day
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* No dispatches today */
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
            <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">No jobs assigned today</p>
            <p className="text-xs text-gray-300 mt-1">Your boss will send you a dispatch</p>
          </div>
          {/* Allow standalone ticket submission when no dispatch */}
          <Link
            href="/driver/submit"
            className="flex items-center justify-center gap-3 w-full rounded-2xl bg-[#1e3a2a] text-white py-4 text-base font-bold shadow-lg active:scale-95 transition-transform"
          >
            <Plus className="h-5 w-5" /> Submit Ticket
          </Link>
        </div>
      )}

      {/* This week's tickets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">This Week&apos;s Tickets</h2>
          <Link href="/driver/submit" className="text-xs text-[#2d7a4f] font-medium">+ Add</Link>
        </div>
        {!tickets?.length ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-6 text-center">
            <p className="text-sm text-gray-400">No tickets submitted this week</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const cfg = ticketStatusConfig[t.status as keyof typeof ticketStatusConfig] ?? ticketStatusConfig.pending
              const Icon = cfg.icon
              return (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.job_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {t.hours_worked ? ` · ${t.hours_worked}h` : ''}
                      </p>
                      {t.modification_reason && (
                        <p className="text-xs text-orange-600 mt-1">Modified: {t.modification_reason}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
