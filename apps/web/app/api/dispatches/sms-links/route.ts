import { NextResponse } from 'next/server'
import { generateDispatchToken } from '@/lib/dispatch-token'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const token = generateDispatchToken(id)
  const base = `https://dumptruckboss.com/api/dispatches/respond?id=${encodeURIComponent(id)}&token=${token}`

  return NextResponse.json({
    acceptUrl:  `${base}&action=accepted`,
    declineUrl: `${base}&action=declined`,
  })
}
