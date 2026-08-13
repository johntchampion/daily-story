import { Pool } from 'pg'

// Shared connection pool for the application.
// Configured via the standard `DATABASE_URL` environment variable, e.g.
//   postgres://user:password@host:5432/daily_story
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const pool = new Pool({ connectionString })
