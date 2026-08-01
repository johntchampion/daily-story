import { pool } from '../db.js'

type UserResponseRow = {
  id: string
  user_id: string
  question_key: string
  answer: unknown
  created_at: Date
}

const COLUMNS = 'id, user_id, question_key, answer, created_at'

export class UserResponse {
  id: number
  userId: number
  questionKey: string
  answer: unknown
  createdAt: Date

  private constructor(row: UserResponseRow) {
    this.id = Number(row.id)
    this.userId = Number(row.user_id)
    this.questionKey = row.question_key
    this.answer = row.answer
    this.createdAt = row.created_at
  }

  // Record a new answer. Always inserts — never updates a prior answer to the
  // same question, so answering again just adds another row to the history.
  // `answer` holds the selected option key(s) (see survey_question_options),
  // or raw text/JSON for free-response questions with no options.
  static async record(input: {
    userId: number
    questionKey: string
    answer: unknown
  }): Promise<UserResponse> {
    const { rows } = await pool.query<UserResponseRow>(
      `INSERT INTO user_responses (user_id, question_key, answer)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.userId, input.questionKey, JSON.stringify(input.answer)],
    )
    return new UserResponse(rows[0]!)
  }

  // The most recent answer a user gave to one specific question, or null if
  // they've never answered it.
  static async latestAnswer(
    userId: number,
    questionKey: string,
  ): Promise<UserResponse | null> {
    const { rows } = await pool.query<UserResponseRow>(
      `SELECT ${COLUMNS} FROM user_responses
       WHERE user_id = $1 AND question_key = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, questionKey],
    )
    return rows[0] ? new UserResponse(rows[0]) : null
  }

  // The most recent answer to every question this user has ever answered
  // (one row per question_key).
  static async latestAnswers(userId: number): Promise<UserResponse[]> {
    const { rows } = await pool.query<UserResponseRow>(
      `SELECT DISTINCT ON (question_key) ${COLUMNS} FROM user_responses
       WHERE user_id = $1
       ORDER BY question_key, created_at DESC`,
      [userId],
    )
    return rows.map((row) => new UserResponse(row))
  }
}
