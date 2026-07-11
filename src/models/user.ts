import bcrypt from 'bcrypt'
import { pool } from '../db.js'
import { Language, Level } from '../constants.js'

// Cost factor for bcrypt hashing. Higher is slower / more resistant to
// brute-force; 12 is a sensible modern default.
const SALT_ROUNDS = 12

// Pragmatic email check: a single @ with non-empty, whitespace-free local and
// domain parts and at least one dot in the domain. Not RFC-perfect by design —
// it rejects obvious garbage without false-rejecting real addresses.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Normalize and validate an email for storage. Trims surrounding whitespace
// and lowercases (pairs with the lower(email) unique index in setup.sql).
// Throws if the result isn't a valid email format.
const normalizeEmail = (email: string): string => {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) {
    throw new Error('Invalid email format')
  }
  return normalized
}

// Shape of a row as returned by Postgres (snake_case columns).
type UserRow = {
  id: string
  email: string
  hashed_password: string
  created_at: Date
  updated_at: Date
  last_logged_in: Date | null
  preferred_language: string | null
  preferred_level: string | null
}

const COLUMNS =
  'id, email, hashed_password, created_at, updated_at, last_logged_in, preferred_language, preferred_level'

// An instantiable user account, mapped from the `users` table defined in
// database/setup.sql. Create new accounts with `User.create()` and load
// existing ones with `User.findById()` / `User.findByEmail()`.
export class User {
  id: number
  email: string
  hashedPassword: string
  createdAt: Date
  updatedAt: Date
  lastLoggedIn: Date | null
  preferredLanguage: string | null
  preferredLevel: string | null

  private constructor(row: UserRow) {
    this.id = Number(row.id)
    this.email = row.email
    this.hashedPassword = row.hashed_password
    this.createdAt = row.created_at
    this.updatedAt = row.updated_at
    this.lastLoggedIn = row.last_logged_in
    this.preferredLanguage = row.preferred_language
    this.preferredLevel = row.preferred_level
  }

  // --- Finders / factories ------------------------------------------------

  // Create and persist a new account. The email is normalized and validated
  // (throws on invalid format). Throws if the email already exists.
  static async create(input: {
    email: string
    hashedPassword: string
  }): Promise<User> {
    const email = normalizeEmail(input.email)
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (email, hashed_password)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [email, input.hashedPassword],
    )
    return new User(rows[0]!)
  }

  // Register a new account from a plaintext password. Hashes the password
  // with bcrypt before persisting. Throws if the email already exists.
  static async register(input: {
    email: string
    password: string
  }): Promise<User> {
    // Validate/normalize first so an invalid email fails before we spend the
    // cost of hashing. create() re-normalizes (idempotent) as the real gate.
    const email = normalizeEmail(input.email)
    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS)
    return User.create({ email, hashedPassword })
  }

  // Load an account by id. Returns null if not found.
  static async findById(id: number): Promise<User | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE id = $1`,
      [id],
    )
    return rows[0] ? new User(rows[0]) : null
  }

  // Load an account by email (case-insensitive). Returns null if not found.
  static async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    )
    return rows[0] ? new User(rows[0]) : null
  }

  // --- Instance methods ---------------------------------------------------

  // Check a plaintext password against this account's stored hash.
  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.hashedPassword)
  }

  // Persist changes to `email` / `hashedPassword` made on this instance.
  // The email is normalized and validated (throws on invalid format), so this
  // path can't bypass the format rule enforced by create(). `updatedAt` is
  // maintained by a DB trigger and refreshed locally.
  async save(): Promise<this> {
    const email = normalizeEmail(this.email)
    const { rows } = await pool.query<UserRow>(
      `UPDATE users
       SET email = $1, hashed_password = $2
       WHERE id = $3
       RETURNING ${COLUMNS}`,
      [email, this.hashedPassword, this.id],
    )
    if (!rows[0]) {
      throw new Error(`Cannot save user ${this.id}: account no longer exists`)
    }
    this.hydrate(rows[0])
    return this
  }

  // Stamp last_logged_in with the current time and persist it.
  async recordLogin(): Promise<this> {
    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET last_logged_in = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [this.id],
    )
    if (!rows[0]) {
      throw new Error(
        `Cannot record login for user ${this.id}: account no longer exists`,
      )
    }
    this.hydrate(rows[0])
    return this
  }

  // Persist a partial update to the user's preferences. Only the fields
  // present in `prefs` are written, so callers can update one preference
  // without resubmitting the rest. Values are stored as-is (canonical language
  // name, e.g. 'Spanish', and CEFR level, e.g. 'A1'); validation is the
  // caller's job. A no-op update (empty `prefs`) leaves the row untouched.
  async updatePreferences(prefs: {
    language?: Language
    level?: Level
  }): Promise<this> {
    // Map each provided preference to its column.
    const columns: Partial<Record<keyof UserRow, string>> = {}
    if (prefs.language !== undefined) columns.preferred_language = prefs.language
    if (prefs.level !== undefined) columns.preferred_level = prefs.level

    const entries = Object.entries(columns)
    if (entries.length === 0) return this

    // Build `col = $n` assignments; the id is the final positional param.
    const assignments = entries
      .map(([col], i) => `${col} = $${i + 1}`)
      .join(', ')
    const values = entries.map(([, value]) => value)

    const { rows } = await pool.query<UserRow>(
      `UPDATE users
       SET ${assignments}
       WHERE id = $${values.length + 1}
       RETURNING ${COLUMNS}`,
      [...values, this.id],
    )
    if (!rows[0]) {
      throw new Error(
        `Cannot update preferences for user ${this.id}: account no longer exists`,
      )
    }
    this.hydrate(rows[0])
    return this
  }

  // Delete this account. Returns true if a row was removed.
  async delete(): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [
      this.id,
    ])
    return (rowCount ?? 0) > 0
  }

  // Refresh this instance's fields from a row (e.g. after an update).
  private hydrate(row: UserRow): void {
    this.id = Number(row.id)
    this.email = row.email
    this.hashedPassword = row.hashed_password
    this.createdAt = row.created_at
    this.updatedAt = row.updated_at
    this.lastLoggedIn = row.last_logged_in
    this.preferredLanguage = row.preferred_language
    this.preferredLevel = row.preferred_level
  }
}
