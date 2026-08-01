import { Level } from '../constants.js'

// A single choice offered for a Question. `level` is optional metadata used
// only by questions whose answer also maps to a CEFR level (e.g. the skill
// self-assessment question drives both users.preferred_level and the answer
// recorded to user_responses).
export type QuestionOption = {
  id: string
  label: string
  description?: string
  level?: Level
}

// A question asked of the user (e.g. during onboarding) whose answers are
// recorded via UserResponse. `key` is the stable question_key stored in
// user_responses; `question` is the human-readable text stored alongside each
// answer; `options` are the choices offered at the time of asking.
export type Question = {
  key: string
  question: string
  options: QuestionOption[]
}
