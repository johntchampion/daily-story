// Toggles whether the app generates new stories via the Anthropic Batch API.
// When disabled, no API calls are made.
const STORY_GENERATION_MODES = ['enabled', 'disabled'] as const

type StoryGenerationMode = (typeof STORY_GENERATION_MODES)[number]

function readStoryGenerationMode(): StoryGenerationMode {
  const configuredMode = (process.env.STORY_GENERATION ?? 'enabled')
    .trim()
    .toLowerCase()
  const matchedMode = STORY_GENERATION_MODES.find(
    (mode) => mode === configuredMode,
  )
  if (!matchedMode) {
    throw new Error(
      `Invalid STORY_GENERATION "${process.env.STORY_GENERATION}". Expected one of: ${STORY_GENERATION_MODES.join(', ')}.`,
    )
  }
  return matchedMode
}

export const isStoryGenerationEnabled = readStoryGenerationMode() === 'enabled'
