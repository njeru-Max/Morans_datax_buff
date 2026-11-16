import { NextResponse } from 'next/server'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const database = await getDatabaseStatus()
  const connected = database === 'connected'

  return NextResponse.json(
    { ok: connected, database },
    {
      status: connected ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
