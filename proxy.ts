import { NextResponse, type NextRequest } from 'next/server'

// This is only a navigation convenience. Every page/action still verifies the
// session against PostgreSQL; a cookie by itself never grants authorization.
export function proxy(request: NextRequest) {
  if (!request.cookies.has('nelsen_session')) {
    const loginUrl = new URL('/sign-in', request.url)
    loginUrl.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/data-x/:path*', '/morans/workspace/:path*', '/platform/admin/:path*'],
}
