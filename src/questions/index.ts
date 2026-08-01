import { SKILL_ASSESSMENT } from './skillAssessment.js'
import { LEARNING_REASONS } from './learningReasons.js'
import { Question } from './types.js'

export { SKILL_ASSESSMENT } from './skillAssessment.js'
export { LEARNING_REASONS } from './learningReasons.js'
export type { Question, QuestionOption } from './types.js'

export const ALL_QUESTIONS: Question[] = [SKILL_ASSESSMENT, LEARNING_REASONS]
