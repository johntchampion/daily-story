// Canonical lists of the languages and CEFR levels the app supports. Kept in
// their own module so any layer (routes, models, services) can import them
// without pulling in the story-generation service. Declared `as const` so the
// element types can be derived as literal unions (see `Language` / `Level`).

export const SUPPORTED_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
] as const

// A single supported language name, e.g. 'Spanish'.
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

// All supported CEFR levels, ordered simplest to most advanced.
export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

// A single supported CEFR level, e.g. 'A1'.
export type Level = (typeof LEVELS)[number]
