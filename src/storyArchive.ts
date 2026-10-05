import path from 'path'
import { readdir } from 'fs/promises'
import { daysSinceEpoch } from './calendarDate.js'

const STORIES_ROOT = path.join(process.cwd(), 'stories')
const YEAR_PATTERN = /^\d{4}$/
const MONTH_OR_DAY_PATTERN = /^\d{2}$/

let cachedArchiveDates: Promise<string[]> | null = null

async function listNumericSubdirectories(
  directory: string,
  namePattern: RegExp,
): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && namePattern.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

async function scanArchiveDates(): Promise<string[]> {
  const dates: string[] = []
  for (const year of await listNumericSubdirectories(
    STORIES_ROOT,
    YEAR_PATTERN,
  )) {
    const yearDirectory = path.join(STORIES_ROOT, year)
    for (const month of await listNumericSubdirectories(
      yearDirectory,
      MONTH_OR_DAY_PATTERN,
    )) {
      const monthDirectory = path.join(yearDirectory, month)
      for (const day of await listNumericSubdirectories(
        monthDirectory,
        MONTH_OR_DAY_PATTERN,
      )) {
        dates.push(`${year}-${month}-${day}`)
      }
    }
  }
  return dates.sort()
}

// Cached for the life of the process: the archive only grows when story
// generation is enabled, and rotation is only used when it's disabled.
function listArchiveDates(): Promise<string[]> {
  cachedArchiveDates ??= scanArchiveDates()
  return cachedArchiveDates
}

/**
 * Archived story dates before `dateISO`, starting at that day's slot in a
 * fixed rotation and wrapping around, so each day maps to a different story
 * and none repeats until the whole archive has been shown.
 */
export async function archiveDatesInRotationOrder(
  dateISO: string,
): Promise<string[]> {
  const pastDates = (await listArchiveDates()).filter((date) => date < dateISO)
  if (pastDates.length === 0) return []

  const rotationStart = daysSinceEpoch(dateISO) % pastDates.length
  return [
    ...pastDates.slice(rotationStart),
    ...pastDates.slice(0, rotationStart),
  ]
}
