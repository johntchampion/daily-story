import path from 'path'
import { readFile } from 'fs/promises'
import { StoryContent } from './storyService.js'
import { SUPPORTED_LANGUAGES } from '../config/constants.js'
import type { User } from '../models/user.js'
import {
  UserStoryActivity,
  type UserActivitySummary,
} from '../models/userStoryActivity.js'

const NATIVE_NAMES: Record<string, string> = {
  English: 'English',
  Spanish: 'Español',
  French: 'Français',
  German: 'Deutsch',
  Italian: 'Italiano',
  Portuguese: 'Português',
  Chinese: '中文',
  Japanese: '日本語',
}

const LANG_CODES: Record<string, string> = {
  English: 'EN',
  Spanish: 'ES',
  French: 'FR',
  German: 'DE',
  Italian: 'IT',
  Portuguese: 'PT',
  Chinese: 'ZH',
  Japanese: 'JA',
}

const LEVEL_NAMES: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Conversational',
  B1: 'Intermediate',
  B2: 'Advanced',
}

export type DashboardStory = {
  // Whether a real generated story was found for the user's preference today.
  hasStory: boolean
  // Whether the user has a saved language + level preference at all.
  hasPreference: boolean
  title: string
  titleEn: string | null
  href: string
  ctaLabel: string
  badgeLabel: string
}

export type PickerLang = {
  code: string // two-letter uppercase code, e.g. "DE"
  native: string
  href: string
  selected: boolean
}

export type WeekDay = { label: string; read: boolean; isToday: boolean }

export type RecentQuiz = { score: string; title: string; good: boolean }

export type PastStory = {
  date: string
  title: string
  meta: string
  href: string
}

export type ExerciseQuestion = {
  word: string
  source: string
  options: string[]
  correct: number
}

export type DashboardViewModel = {
  isLoggedIn: true
  greeting: string
  dateLine: string
  dashboardStory: DashboardStory
  preferredLabel: string
  pickerLangs: PickerLang[]
  streak: number
  streakNote: string
  week: WeekDay[]
  daysRead7: number
  quizPct: string
  quizFraction: string
  recentQuizzes: RecentQuiz[]
  quizNote: string
  // --- Static placeholder: no vocab data exists anywhere in StoryContent
  // (see CLAUDE.md's Story Schema), so this can't be wired to real data
  // without a story-generation/schema change. ---
  exercise: ExerciseQuestion[]
  pastStories: PastStory[]
}

async function loadStoryForDate(
  dateISO: string,
  language: string,
  level: string,
): Promise<StoryContent | null> {
  const [year, month, day] = dateISO.split('-') as [string, string, string]

  const filePath = path.join(
    process.cwd(),
    'stories',
    year,
    month,
    day,
    language.toLowerCase(),
    level.toLowerCase(),
    'story.json',
  )

  try {
    const fileContent = await readFile(filePath, 'utf-8')
    return JSON.parse(fileContent) as StoryContent
  } catch {
    return null
  }
}

// "Mon · Jul 6" style label for a plain YYYY-MM-DD date
function formatDayLabel(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00Z`)
  const weekday = date.toLocaleDateString(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  })
  const monthDay = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${weekday} · ${monthDay}`
}

async function titleForStory(row: UserStoryActivity): Promise<string> {
  const content = await loadStoryForDate(row.storyDate, row.language, row.level)
  return content?.title ?? `${row.language} ${row.level} story`
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function computeTodayISO(now: Date): string {
  return `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
}

// Issue number for flavor: the day-of-year, so it's stable per date.
function computeDateLine(now: Date): string {
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86_400_000,
  )
  return `${now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })} · No. ${dayOfYear}`
}

function computeGreeting(name: string | null): string {
  return name ? `${timeOfDayGreeting()}, ${name}.` : `${timeOfDayGreeting()}.`
}

async function buildStory(
  preferredLanguage: string | null,
  preferredLevel: string | null,
  todayISO: string,
): Promise<DashboardStory> {
  if (!preferredLanguage || !preferredLevel) {
    // No saved preference — send them to onboarding to choose.
    return {
      hasStory: false,
      hasPreference: false,
      title: 'Choose your language to begin',
      titleEn: null,
      href: '/profile/onboarding',
      ctaLabel: 'Set up my reading →',
      badgeLabel: 'Not set yet',
    }
  }

  const langLower = preferredLanguage.toLowerCase()
  const levelLower = preferredLevel.toLowerCase()
  const content = await loadStoryForDate(todayISO, langLower, levelLower)
  const badgeLabel = `${NATIVE_NAMES[preferredLanguage] ?? preferredLanguage} · ${preferredLevel}`

  if (content) {
    return {
      hasStory: true,
      hasPreference: true,
      title: content.title,
      titleEn: content.titleEn ?? null,
      href: `/${langLower}/${levelLower}`,
      ctaLabel: "Read today's story →",
      badgeLabel,
    }
  }

  // Preference set, but no story generated for today yet.
  const levelName = LEVEL_NAMES[preferredLevel] ?? preferredLevel
  return {
    hasStory: false,
    hasPreference: true,
    title: "Today's story is on its way",
    titleEn: `${levelName} ${preferredLanguage}`,
    href: `/${langLower}/${levelLower}`,
    ctaLabel: 'Check for today’s story →',
    badgeLabel,
  }
}

function buildPickerLangs(
  preferredLanguage: string | null,
  preferredLevel: string | null,
): PickerLang[] {
  const levelForLinks = (preferredLevel ?? 'A1').toLowerCase()
  return SUPPORTED_LANGUAGES.map((lang) => ({
    code: LANG_CODES[lang] ?? lang.slice(0, 2).toUpperCase(),
    native: NATIVE_NAMES[lang] ?? lang,
    href: `/${lang.toLowerCase()}/${levelForLinks}`,
    selected: preferredLanguage === lang,
  }))
}

function computePreferredLabel(
  preferredLanguage: string | null,
  preferredLevel: string | null,
): string {
  if (!preferredLanguage || !preferredLevel) return 'not set'
  return `${NATIVE_NAMES[preferredLanguage] ?? preferredLanguage} · ${preferredLevel}`
}

function buildWeek(
  weekActivity: UserActivitySummary['week'],
  todayISO: string,
): WeekDay[] {
  return weekActivity.map(({ date, read }) => {
    const isToday = date === todayISO
    return {
      label: isToday
        ? 'Today'
        : new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: 'short',
            timeZone: 'UTC',
          }),
      read,
      isToday,
    }
  })
}

function computeDaysRead7(week: WeekDay[]): number {
  return week.filter((d) => d.read).length
}

function computeStreakNote(streak: number, readToday: boolean): string {
  if (streak === 0) return 'Start your streak today.'
  return readToday
    ? 'Nice work — keep it going tomorrow.'
    : 'Read today to keep it alive.'
}

function computeQuizPct(quizStats: UserActivitySummary['quizStats']): string {
  return quizStats.percentCorrect !== null
    ? `${quizStats.percentCorrect}%`
    : '—'
}

function computeQuizFraction(
  quizStats: UserActivitySummary['quizStats'],
): string {
  if (quizStats.percentCorrect === null) return 'No quizzes yet this week'
  const total = quizStats.correctCount + quizStats.incorrectCount
  return `· ${quizStats.correctCount} of ${total} correct`
}

function computeQuizNote(quizStats: UserActivitySummary['quizStats']): string {
  if (quizStats.attemptDays === 0) return 'Answer a quiz today to get started.'
  const plural = quizStats.attemptDays === 1 ? '' : 'zes'
  return `${quizStats.attemptDays} quiz${plural} this week.`
}

async function buildRecentQuizzes(
  recentAttempts: UserStoryActivity[],
): Promise<RecentQuiz[]> {
  return Promise.all(
    recentAttempts.map(async (row) => ({
      score: `${row.correctCount}/${row.correctCount + row.incorrectCount}`,
      title: await titleForStory(row),
      good: row.incorrectCount === 0 && row.correctCount > 0,
    })),
  )
}

async function buildPastStories(
  recentDays: UserStoryActivity[],
  storyHref: string,
): Promise<PastStory[]> {
  return Promise.all(
    recentDays.map(async (row) => {
      const total = row.correctCount + row.incorrectCount
      return {
        date: formatDayLabel(row.storyDate),
        title: await titleForStory(row),
        meta: total > 0 ? `Read · quiz ${row.correctCount}/${total}` : 'Read',
        href: storyHref,
      }
    }),
  )
}

// Static placeholder: no vocab data exists anywhere in StoryContent (see
// CLAUDE.md's Story Schema), so this can't be wired to real data without a
// story-generation/schema change.
function buildExercise(): ExerciseQuestion[] {
  return [
    {
      word: 'der Umzug',
      source: 'Ein Gespräch über Berufswechsel',
      options: ['the move / relocation', 'the umbrella', 'the detour'],
      correct: 0,
    },
    {
      word: 'verlässlich',
      source: 'Der Markt am Sonntag',
      options: ['forgetful', 'reliable', 'left behind'],
      correct: 1,
    },
    {
      word: 'die Erinnerung',
      source: 'Das alte Fotoalbum',
      options: ['the decision', 'the entrance', 'the memory'],
      correct: 2,
    },
  ]
}

export async function buildDashboardViewModel(
  user: User,
): Promise<DashboardViewModel> {
  const now = new Date()
  const todayISO = computeTodayISO(now)
  const dateLine = computeDateLine(now)
  const greeting = computeGreeting(user.name)

  const preferredLanguage = user.preferredLanguage // canonical, e.g. "German"
  const preferredLevel = user.preferredLevel // CEFR, e.g. "B1"

  const dashboardStory = await buildStory(
    preferredLanguage,
    preferredLevel,
    todayISO,
  )
  const pickerLangs = buildPickerLangs(preferredLanguage, preferredLevel)
  const preferredLabel = computePreferredLabel(
    preferredLanguage,
    preferredLevel,
  )

  const summary = await UserStoryActivity.getSummary(user.id, todayISO)

  const week = buildWeek(summary.week, todayISO)
  const daysRead7 = computeDaysRead7(week)
  const streakNote = computeStreakNote(summary.streak, summary.readToday)
  const quizPct = computeQuizPct(summary.quizStats)
  const quizFraction = computeQuizFraction(summary.quizStats)
  const quizNote = computeQuizNote(summary.quizStats)
  const recentQuizzes = await buildRecentQuizzes(summary.recentQuizAttempts)
  const pastStories = await buildPastStories(
    summary.recentDays,
    dashboardStory.href,
  )
  const exercise = buildExercise()

  return {
    isLoggedIn: true,
    greeting,
    dateLine,
    dashboardStory,
    preferredLabel,
    pickerLangs,
    streak: summary.streak,
    streakNote,
    week,
    daysRead7,
    quizPct,
    quizFraction,
    recentQuizzes,
    quizNote,
    exercise,
    pastStories,
  }
}
