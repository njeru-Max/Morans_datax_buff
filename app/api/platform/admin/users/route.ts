
import { and, asc, count, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'
import { isPlatformAdmin } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { appUsers } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PAGE_SIZE = 25

export async function GET(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!isPlatformAdmin(user)) {
    return NextResponse.json(
      { error: 'Platform administrator access required.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const db = getDb()

  if (!db) {
    return NextResponse.json(
      { error: 'Database unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const params = new URL(request.url).searchParams
  const search = (params.get('q') ?? '').trim().slice(0, 100)
  const requestedPage = Number.parseInt(params.get('page') ?? '1', 10)
  const safePage = Number.isFinite(requestedPage)
    ? Math.max(1, requestedPage)
    : 1

  const conditions = search
    ? and(
        eq(appUsers.status, 'active'),
        or(
          ilike(appUsers.name, `%${search}%`),
          ilike(appUsers.email, `%${search}%`),
        ),
      )
    : eq(appUsers.status, 'active')

  try {
    const [totalResult] = await db
      .select({ total: count() })
      .from(appUsers)
      .where(conditions)

    const total = totalResult.total
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const page = Math.min(safePage, totalPages)

    const users = await db
      .select({
        id: appUsers.id,
        name: appUsers.name,
        email: appUsers.email,
        emailVerified: appUsers.emailVerified,
      })
      .from(appUsers)
      .where(conditions)
      .orderBy(asc(appUsers.name), asc(appUsers.email))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)

    return NextResponse.json(
      { users, page, pageSize: PAGE_SIZE, total, totalPages },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error(
      '[platform-admin] Account search failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return NextResponse.json(
      { error: 'Could not retrieve accounts.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
