import { SurveyQuestion } from './types.js'

// Onboarding's "how does your language feel right now?" step. Each option is
// worded more descriptively than a bare CEFR label but still carries one of
// the four levels the app actually generates content for as its `value`
// (used to set users.preferred_level and pick which story to open). The
// option's `id` is what gets recorded to user_responses as the answer.
export const SKILL_ASSESSMENT: SurveyQuestion = {
  key: 'skill_self_assessment',
  question: 'How would you describe your current level?',
  options: [
    { id: 'zero', label: 'Starting from zero — or close to it.', value: 'A1' },
    { id: 'few-words', label: 'I know a handful of words and phrases.', value: 'A1' },
    { id: 'basic-chat', label: 'I can have basic, everyday conversations.', value: 'A2' },
    { id: 'rusty-school', label: "I learned some in school, but I've forgotten most of it.", value: 'A2' },
    { id: 'familiar-topics', label: 'I can talk about familiar topics, but I still make mistakes.', value: 'B1' },
    { id: 'comfortable', label: "I'm comfortable in everyday conversations.", value: 'B1' },
    { id: 'most-things', label: 'I can discuss most things, with the occasional stumble.', value: 'B2' },
    { id: 'polishing', label: "I'm confident — just polishing the details.", value: 'B2' },
  ],
}
