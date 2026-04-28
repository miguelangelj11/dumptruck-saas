import { createClient } from '@/lib/supabase/server'

export type DriverContext = {
  driverId: string
  companyId: string
  driverName: string
  truckNumber: string | null
  email: string | null
}

export async function getDriverContext(): Promise<DriverContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, company_id, name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!driver) return null

  return {
    driverId: driver.id,
    companyId: driver.company_id,
    driverName: driver.name,
    truckNumber: null,
    email: driver.email,
  }
}
