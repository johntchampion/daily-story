// A single choice offered for a Question. `value` is an optional,
// machine-usable value this option maps to, distinct from its display
// `label` (analogous to an HTML <option value="...">). E.g. the skill
// self-assessment question's options each carry a CEFR level as their
// `value`, used to drive users.preferred_level and the level-picker UI; the
// answer recorded to user_responses is the option's `id`, not its `value`.
export type QuestionOption = {
  id: string
  label: string
  description?: string
  value?: string
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
