
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

type AccountPickerProps = {
  id: string
  name: 'initialUserId' | 'userId' | 'judgeUserId'
  label: string
}

export function AccountPicker({ id, name, label }: AccountPickerProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AccountResponse | null>(null)
  const [selected, setSelected] = useState<Account | null>(null)
  const [selectedId, setSelectedId] = useState('')
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
            method: 'GET',
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

        if (selectedId) {
          const match = result.users.find((account) => account.id === selectedId)
          if (match) setSelected(match)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        setError(err instanceof Error ? err.message : 'Could not load accounts.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadAccounts()

    return () => controller.abort()
  }, [query, page, selectedId])

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function changeSelection(value: string) {
    setSelectedId(value)

    const match = data?.users.find((account) => account.id === value)
    setSelected(match ?? null)
  }

  const visibleAccounts = data?.users ?? []
  const selectedIsVisible = visibleAccounts.some(
    (account) => account.id === selectedId,
  )

  return (
    <div className="workflow-field">
      <label htmlFor={`${id}-search`}>
        <span>Search {label.toLowerCase()} by name or email</span>
      </label>

      <input
        id={`${id}-search`}
        type="search"
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        placeholder="Type a name or email"
        autoComplete="off"
      />

      <label htmlFor={id}>
        <span>{label}</span>
      </label>

      <select
        id={id}
        name={name}
        value={selectedId}
        onChange={(event) => changeSelection(event.target.value)}
        required
      >
        <option value="">Select an active account</option>

        {selected && !selectedIsVisible ? (
          <option value={selected.id}>
            {selected.name || selected.email} — selected
          </option>
        ) : null}

        {visibleAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name || account.email}
            {account.email ? ` — ${account.email}` : ''}
            {account.emailVerified ? ' (verified)' : ''}
          </option>
        ))}
      </select>

      {loading ? <p role="status">Loading accounts…</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {data && !loading ? (
        <div className="inline-actions">
          <span>
            {data.total} active account{data.total === 1 ? '' : 's'} found
          </span>

          <button
            type="button"
            className="button button-outline"
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
            className="button button-outline"
            disabled={page >= data.totalPages}
            onClick={() =>
              setPage((current) => Math.min(data.totalPages, current + 1))
            }
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
