import path from 'path'
import { readFile } from 'fs/promises'
import { StoryContent } from './storyService.js'
import { SUPPORTED_LANGUAGES } from './constants.js'
import type { User } from './models/user.js'

// Native language names for the "read in another language today" picker,
// mirroring the map used on the marketing home page (views/home.ejs).
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

// Short two-letter codes shown on the language chips (e.g. "DE" for German).
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

// Plain-language level names (matches the levelInfo map in views/home.ejs).
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
  story: DashboardStory
  preferredLabel: string
  pickerLangs: PickerLang[]
  // --- Progress widgets below are static placeholders for now. There is no
  // per-user reading/quiz history in the backend yet (see CLAUDE.md); wiring
  // these to real data is future work. ---
  streak: number
  streakNote: string
  week: WeekDay[]
  daysRead7: number
  quizPct: string
  quizFraction: string
  recentQuizzes: RecentQuiz[]
  quizNote: string
  exercise: ExerciseQuestion[]
  pastStories: PastStory[]
}

// Load today's generated story for a language/level, or null if there isn't
// one on disk. Mirrors the date-based path building in routes/story.ts.
async function loadTodaysStory(
  languageLower: string,
  levelLower: string,
): Promise<StoryContent | null> {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')

  const filePath = path.join(
    process.cwd(),
    'stories',
    year,
    month,
    day,
    languageLower,
    levelLower,
    'story.json',
  )

  try {
    const fileContent = await readFile(filePath, 'utf-8')
    return JSON.parse(fileContent) as StoryContent
  } catch {
    return null
  }
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// The last 7 calendar-day labels ending today (real dates), paired with
// placeholder "read" flags. Labels are real; the flags are not yet tracked.
function buildWeek(): WeekDay[] {
  const placeholderRead = [true, true, false, true, true, true, false]
  const days: WeekDay[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const isToday = i === 0
    days.push({
      label: isToday
        ? 'Today'
        : d.toLocaleDateString(undefined, { weekday: 'short' }),
      read: placeholderRead[6 - i] ?? false,
      isToday,
    })
  }
  return days
}

export async function buildDashboardViewModel(
  user: User,
): Promise<DashboardViewModel> {
  const now = new Date()

  // Issue number for flavor: the day-of-year, so it's stable per date.
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86_400_000,
  )
  const dateLine = `${now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })} · No. ${dayOfYear}`

  const name = user.name
  const greeting = name
    ? `${timeOfDayGreeting()}, ${name}.`
    : `${timeOfDayGreeting()}.`

  // --- Today's story hero (real data where available) ---
  const preferredLanguage = user.preferredLanguage // canonical, e.g. "German"
  const preferredLevel = user.preferredLevel // CEFR, e.g. "B1"
  const hasPreference = Boolean(preferredLanguage && preferredLevel)

  let story: DashboardStory
  if (hasPreference && preferredLanguage && preferredLevel) {
    const langLower = preferredLanguage.toLowerCase()
    const levelLower = preferredLevel.toLowerCase()
    const content = await loadTodaysStory(langLower, levelLower)
    const levelName = LEVEL_NAMES[preferredLevel] ?? preferredLevel
    const badgeLabel = `${NATIVE_NAMES[preferredLanguage] ?? preferredLanguage} · ${preferredLevel}`
    if (content) {
      story = {
        hasStory: true,
        hasPreference: true,
        title: content.title,
        titleEn: content.titleEn ?? null,
        href: `/${langLower}/${levelLower}`,
        ctaLabel: "Read today's story →",
        badgeLabel,
      }
    } else {
      // Preference set, but no story generated for today yet.
      story = {
        hasStory: false,
        hasPreference: true,
        title: "Today's story is on its way",
        titleEn: `${levelName} ${preferredLanguage}`,
        href: `/${langLower}/${levelLower}`,
        ctaLabel: 'Check for today’s story →',
        badgeLabel,
      }
    }
  } else {
    // No saved preference — send them to onboarding to choose.
    story = {
      hasStory: false,
      hasPreference: false,
      title: 'Choose your language to begin',
      titleEn: null,
      href: '/profile/onboarding',
      ctaLabel: 'Set up my reading →',
      badgeLabel: 'Not set yet',
    }
  }

  // "Read in another language today" chips. Each links to today's story in that
  // language at the user's current level (falls back to A1 if no level set).
  const levelForLinks = (preferredLevel ?? 'A1').toLowerCase()
  const pickerLangs: PickerLang[] = SUPPORTED_LANGUAGES.map((lang) => ({
    code: LANG_CODES[lang] ?? lang.slice(0, 2).toUpperCase(),
    native: NATIVE_NAMES[lang] ?? lang,
    href: `/${lang.toLowerCase()}/${levelForLinks}`,
    selected: preferredLanguage === lang,
  }))

  const preferredLabel = hasPreference
    ? `${NATIVE_NAMES[preferredLanguage!] ?? preferredLanguage} · ${preferredLevel}`
    : 'not set'

  // --- Placeholder progress widgets (no backend tracking yet) ---
  const week = buildWeek()
  const daysRead7 = week.filter((d) => d.read).length

  const recentQuizzes: RecentQuiz[] = [
    { score: '3/3', title: 'Ein Gespräch über Berufswechsel', good: true },
    { score: '2/3', title: 'Der Markt am Sonntag', good: false },
    { score: '3/3', title: 'Das alte Fotoalbum', good: true },
  ]

  const exercise: ExerciseQuestion[] = [
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

  const pastStories: PastStory[] = [
    {
      date: 'Mon · Jul 6',
      title: 'Ein Gespräch über Berufswechsel',
      meta: 'Read · quiz 3/3',
      href: story.href,
    },
    {
      date: 'Sun · Jul 5',
      title: 'Der Markt am Sonntag',
      meta: 'Read · quiz 2/3',
      href: story.href,
    },
    {
      date: 'Sat · Jul 4',
      title: 'Das alte Fotoalbum',
      meta: 'Read · quiz 3/3',
      href: story.href,
    },
  ]

  return {
    isLoggedIn: true,
    greeting,
    dateLine,
    story,
    preferredLabel,
    pickerLangs,
    streak: 7,
    streakNote: 'Reading today keeps it alive.',
    week,
    daysRead7,
    quizPct: '89%',
    quizFraction: '· 8 of 9',
    recentQuizzes,
    quizNote: 'Trickiest this week: dates & times.',
    exercise,
    pastStories,
  }
}
