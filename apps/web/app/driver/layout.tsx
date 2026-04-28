import { redirect } from 'next/navigation'
import { getDriverContext } from '@/lib/get-driver-context'
import DriverLayoutClient from './layout-client'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const driver = await getDriverContext()
  if (!driver) redirect('/login')

  return <DriverLayoutClient driverName={driver.driverName}>{children}</DriverLayoutClient>
}
