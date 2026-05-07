import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCompanyId } from '@/lib/get-company-id'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 403 })

  const { id: contractorId } = await params

  const { data, error } = await admin()
    .from('contractor_trucks')
    .select('id, truck_number, notes, created_at')
    .eq('contractor_id', contractorId)
    .eq('company_id', companyId)
    .order('truck_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getCompanyId()
  if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 403 })

  const { id: contractorId } = await params
  const body = await request.json() as { truck_number?: string; notes?: string }

  if (!body.truck_number?.trim()) {
    return NextResponse.json({ error: 'truck_number is required' }, { status: 400 })
  }

  // Verify contractor belongs to this company
  const { data: co } = await admin()
    .from('contractors')
    .select('id')
    .eq('id', contractorId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!co) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  const { data, error } = await admin()
    .from('contractor_trucks')
    .insert({ contractor_id: contractorId, company_id: companyId, truck_number: body.truck_number.trim(), notes: body.notes ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
