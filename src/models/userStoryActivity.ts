import { pool } from '../db.js'
import { Language, Level } from '../constants.js'

// Shape of a row as returned by Postgres (snake_case columns).
type UserStoryActivityRow = {
  id: string
  user_id: string
  story_date: string
  language: string
  level: string
  correct_count: number
  incorrect_count: number
  created_at: Date
  updated_at: Date
}

const COLUMNS =
  'id, user_id, story_date::text AS story_date, language, level, correct_count, incorrect_count, created_at, updated_at'

// Subtracts `days` from a plain YYYY-MM-DD calendar date.
function subtractDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export type UserActivitySummary = {
  streak: number
  readToday: boolean
  week: { date: string; read: boolean }[]
  quizStats: {
    correctCount: number
    incorrectCount: number
    percentCorrect: number | null
    attemptDays: number
  }
  recentQuizAttempts: UserStoryActivity[]
  recentDays: UserStoryActivity[]
}

/**
 * A record of activity for tracking users' progress and habits with
 * engaging with stories.
 */
export class UserStoryActivity {
  id: number
  userId: number
  storyDate: string
  language: string
  level: string
  correctCount: number
  incorrectCount: number
  createdAt: Date
  updatedAt: Date

  private constructor(row: UserStoryActivityRow) {
    this.id = Number(row.id)
    this.userId = Number(row.user_id)
    this.storyDate = row.story_date
    this.language = row.language
    this.level = row.level
    this.correctCount = row.correct_count
    this.incorrectCount = row.incorrect_count
    this.createdAt = row.created_at
    this.updatedAt = row.updated_at
  }

  // How far back a streak can possibly reach.
  private static readonly STREAK_LOOKBACK_DAYS = 400

  // How many entries the dashboard's "recent quizzes" / "past stories" lists show.
  private static readonly RECENT_LIMIT = 3

  static async recordAttempt(input: {
    userId: number
    date: string
    language: Language
    level: Level
    correctCount: number
    incorrectCount: number
  }): Promise<UserStoryActivity> {
    const { rows } = await pool.query<UserStoryActivityRow>(
      `INSERT INTO user_story_activity
         (user_id, story_date, language, level, correct_count, incorrect_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, story_date, language, level)
       DO UPDATE SET correct_count = EXCLUDED.correct_count,
                      incorrect_count = EXCLUDED.incorrect_count
       RETURNING ${COLUMNS}`,
      [
        input.userId,
        input.date,
        input.language,
        input.level,
        input.correctCount,
        input.incorrectCount,
      ],
    )
    return new UserStoryActivity(rows[0]!)
  }

  static async recordVisit(input: {
    userId: number
    date: string
    language: Language
    level: Level
  }): Promise<void> {
    await pool.query(
      `INSERT INTO user_story_activity (user_id, story_date, language, level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, story_date, language, level) DO NOTHING`,
      [input.userId, input.date, input.language, input.level],
    )
  }

  private static async findSince(
    userId: number,
    sinceDateISO: string,
  ): Promise<UserStoryActivity[]> {
    const { rows } = await pool.query<UserStoryActivityRow>(
      `SELECT ${COLUMNS}
       FROM user_story_activity
       WHERE user_id = $1 AND story_date >= $2
       ORDER BY story_date DESC, updated_at DESC`,
      [userId, sinceDateISO],
    )
    return rows.map((row) => new UserStoryActivity(row))
  }

  static async getSummary(
    userId: number,
    todayISO: string,
  ): Promise<UserActivitySummary> {
    const rows = await this.findSince(
      userId,
      subtractDaysISO(todayISO, this.STREAK_LOOKBACK_DAYS),
    )
    const activeDates = new Set(rows.map((row) => row.storyDate))

    // --- streak ---
    const readToday = activeDates.has(todayISO)
    // If today has no activity yet, the streak is still "alive" as long as
    // yesterday was active — the user just hasn't read today yet.
    let cursor = readToday ? todayISO : subtractDaysISO(todayISO, 1)
    let streak = 0
    while (activeDates.has(cursor)) {
      streak++
      cursor = subtractDaysISO(cursor, 1)
    }

    // --- last 7 calendar days ---
    const week: { date: string; read: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = subtractDaysISO(todayISO, i)
      week.push({ date, read: activeDates.has(date) })
    }

    // --- this week's quiz stats, summed over the same 7-day window ---
    const weekDates = new Set(week.map((day) => day.date))
    let correctCount = 0
    let incorrectCount = 0
    let attemptDays = 0
    for (const row of rows) {
      if (!weekDates.has(row.storyDate)) continue
      correctCount += row.correctCount
      incorrectCount += row.incorrectCount
      if (row.correctCount + row.incorrectCount > 0) attemptDays++
    }
    const total = correctCount + incorrectCount
    const quizStats = {
      correctCount,
      incorrectCount,
      percentCorrect:
        total > 0 ? Math.round((correctCount / total) * 100) : null,
      attemptDays,
    }

    // --- most recent quiz attempts (rows already sorted story_date DESC) ---
    const recentQuizAttempts = rows
      .filter((row) => row.correctCount + row.incorrectCount > 0)
      .slice(0, this.RECENT_LIMIT)

    // --- most recent distinct days, excluding today (shown in the hero) ---
    const seenDates = new Set<string>()
    const recentDays: UserStoryActivity[] = []
    for (const row of rows) {
      if (row.storyDate === todayISO || seenDates.has(row.storyDate)) continue
      seenDates.add(row.storyDate)
      recentDays.push(row)
      if (recentDays.length >= this.RECENT_LIMIT) break
    }

    return {
      streak,
      readToday,
      week,
      quizStats,
      recentQuizAttempts,
      recentDays,
    }
  }
}
