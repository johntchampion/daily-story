import { pool } from '../config/db.js'
import { ALL_SURVEY_QUESTIONS } from './index.js'

// Keeps the `survey_questions` / `survey_question_options` tables in step
// with the SurveyQuestion definitions in this directory (the source of
// truth). New questions/options are inserted; existing ones are updated
// only when their text actually changed (bumping `updated_at` via the DB
// trigger); unchanged rows are left untouched. Run once at app startup.
export async function syncSurveyQuestions(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const question of ALL_SURVEY_QUESTIONS) {
      await client.query(
        `INSERT INTO survey_questions (key, question)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET question = EXCLUDED.question
         WHERE survey_questions.question IS DISTINCT FROM EXCLUDED.question`,
        [question.key, question.question],
      )

      for (const option of question.options) {
        await client.query(
          `INSERT INTO survey_question_options (question_key, option_key, label, description, value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (question_key, option_key) DO UPDATE SET
             label = EXCLUDED.label,
             description = EXCLUDED.description,
             value = EXCLUDED.value
           WHERE survey_question_options.label IS DISTINCT FROM EXCLUDED.label
              OR survey_question_options.description IS DISTINCT FROM EXCLUDED.description
              OR survey_question_options.value IS DISTINCT FROM EXCLUDED.value`,
          [
            question.key,
            option.id,
            option.label,
            option.description ?? null,
            option.value ?? null,
          ],
        )
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
