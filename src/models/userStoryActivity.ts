import { pool } from '../db.js'
import { Language, Level } from '../constants.js'

// Shape of a row as returned by Postgres (snake_case columns).
type UserStoryActivityRow = {
  id: string
  user_id: string
  story_date: Date
  language: string
  level: string
  correct_count: number
  incorrect_count: number
  created_at: Date
  updated_at: Date
}

const COLUMNS =
  'id, user_id, story_date, language, level, correct_count, incorrect_count, created_at, updated_at'

/**
 * A record of activity for tracking users' progress and habits with
 * engaging with stories.
 */
export class UserStoryActivity {
  id: number
  userId: number
  storyDate: Date
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
}
