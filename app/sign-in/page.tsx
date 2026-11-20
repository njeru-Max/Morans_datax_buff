import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthPage } from '@/components/auth/auth-page'
import { safeInternalPath } from '@/lib/auth/redirect'
import { getCurrentUser } from '@/lib/auth/session'
import { isAuthConfigured } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in | Nelsen Savannah',
  description: 'Sign in to your Nelsen Savannah Data X and MORANS workspaces.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  const returnTo = safeInternalPath(
    firstValue(params.returnTo) ?? firstValue(params.callbackURL) ?? firstValue(params.next),
  )

  if (user) {
    redirect(returnTo)
  }
  const status = firstValue(params.status)

  return (
    <AuthPage
      authAvailable={isAuthConfigured()}
      mode="sign-in"
      returnTo={returnTo}
      status={firstValue(params.status)}
    />
  )
}
