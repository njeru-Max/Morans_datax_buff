import 'server-only'

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type DatabaseStatus = 'connected' | 'not-configured' | 'unavailable'

type DatabaseGlobals = typeof globalThis & {
  __platformPostgresPool?: Pool
}

const databaseGlobals = globalThis as DatabaseGlobals

export function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    return null
  }

  if (!databaseGlobals.__platformPostgresPool) {
    databaseGlobals.__platformPostgresPool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10000,
    })
  }

  return databaseGlobals.__platformPostgresPool
}

export function getDb() {
  const pool = getPool()
  return pool ? drizzle(pool, { schema }) : null
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const pool = getPool()

  if (!pool) {
    return 'not-configured'
  }

  try {
    await pool.query('SELECT 1')
    return 'connected'
  } catch (error) {
    console.error(
      '[database] PostgreSQL health check failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return 'unavailable'
  }
}
