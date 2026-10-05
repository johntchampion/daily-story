import path from 'path'
import { readFile } from 'fs/promises'
import { StoryContent } from './storyService.js'
import { archiveDatesInRotationOrder } from './storyArchive.js'
import { isStoryGenerationEnabled } from '../config/storyGeneration.js'

export type ServedStory = {
  content: StoryContent
  // The date the story was originally generated for; differs from the served
  // date when an archived story is being repeated.
  sourceDateISO: string
}

function storyFilePath(
  dateISO: string,
  language: string,
  level: string,
): string {
  const [year, month, day] = dateISO.split('-') as [string, string, string]
  return path.join(
    process.cwd(),
    'stories',
    year,
    month,
    day,
    language.toLowerCase(),
    level.toLowerCase(),
    'story.json',
  )
}

async function readStoryFile(
  dateISO: string,
  language: string,
  level: string,
): Promise<ServedStory | null> {
  try {
    const fileContent = await readFile(
      storyFilePath(dateISO, language, level),
      'utf-8',
    )
    return {
      content: JSON.parse(fileContent) as StoryContent,
      sourceDateISO: dateISO,
    }
  } catch {
    return null
  }
}

async function findArchivedStoryInRotation(
  dateISO: string,
  language: string,
  level: string,
): Promise<ServedStory | null> {
  for (const archiveDate of await archiveDatesInRotationOrder(dateISO)) {
    const story = await readStoryFile(archiveDate, language, level)
    if (story) return story
  }
  return null
}

/**
 * The story served on `dateISO`. With generation disabled, a missing story is
 * replaced by an archived one picked deterministically for that date.
 */
export async function findStoryForDate(
  dateISO: string,
  language: string,
  level: string,
): Promise<ServedStory | null> {
  const storyForDate = await readStoryFile(dateISO, language, level)
  if (storyForDate || isStoryGenerationEnabled) return storyForDate

  return findArchivedStoryInRotation(dateISO, language, level)
}
