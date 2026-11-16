
'use client'

import { useEffect, useState } from 'react'

type Account = {
  id: string
  name: string
  email: string
  emailVerified: boolean
}

type AccountResponse = {
  users: Account[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  error?: string
}

export function AccountDirectory() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AccountResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadAccounts() {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          page: String(page),
        })

        const response = await fetch(
          `/api/platform/admin/users?${params.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = (await response.json()) as AccountResponse

        if (!response.ok) {
          throw new Error(result.error || 'Could not load accounts.')
        }

        setData(result)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        setError(err instanceof Error ? err.message : 'Could not load accounts.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadAccounts()

    return () => controller.abort()
  }, [query, page])

  function updateSearch(value: string) {
    setQuery(value)
    setPage(1)
  }

  return (
    <section aria-label="Account directory">
      <label className="workflow-field" htmlFor="directory-search">
        <span>Search accounts by name or email</span>
        <input
          id="directory-search"
          type="search"
          value={query}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder="Enter a name or email address"
          autoComplete="off"
        />
      </label>

      {loading ? <p role="status">Loading accounts…</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {data && !loading && !error ? (
        <>
          <p role="status">
            {data.total} active account{data.total === 1 ? '' : 's'} found.
          </p>

          {data.users.length > 0 ? (
            <div className="table-scroll-region">
              <table className="admin-user-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Email verified</th>
                    <th scope="col">Account ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name || 'Unnamed account'}</td>
                      <td>{account.email || 'No email'}</td>
                      <td>{account.emailVerified ? 'Yes' : 'No'}</td>
                      <td><code>{account.id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No active accounts match this search.</p>
          )}

          <div className="inline-actions">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <span>
              Page {data.page} of {data.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() =>
                setPage((current) => Math.min(data.totalPages, current + 1))
              }
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}
