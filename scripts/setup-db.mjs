import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is missing. Create .env.local from .env.example first.')
  process.exit(1)
}

const schemaUrl = new URL('../db/schema.sql', import.meta.url)
const schemaSql = await readFile(schemaUrl, 'utf8')

const pool = new Pool({ connectionString: databaseUrl, max: 1 })

try {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(schemaSql)
    await client.query('COMMIT')
    console.log('Database schema ready.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  console.error('Database setup failed. Verify DATABASE_URL and PostgreSQL permissions.')
  console.error(error instanceof Error ? error.name : 'UnknownError')
  process.exitCode = 1
} finally {
  await pool.end()
}
