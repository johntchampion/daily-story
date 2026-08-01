import { SKILL_ASSESSMENT } from './skillAssessment.js'
import { LEARNING_REASONS } from './learningReasons.js'
import { SurveyQuestion } from './types.js'

export { SKILL_ASSESSMENT } from './skillAssessment.js'
export { LEARNING_REASONS } from './learningReasons.js'
export type { SurveyQuestion, SurveyQuestionOption } from './types.js'

export const ALL_SURVEY_QUESTIONS: SurveyQuestion[] = [
  SKILL_ASSESSMENT,
  LEARNING_REASONS,
]
