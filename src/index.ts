import 'dotenv/config'
import path from 'path'
import express, { Request, Response } from 'express'
import { CronJob } from 'cron'
import { readFile } from 'fs/promises'
import {
  generateDailyStories,
  SUPPORTED_LANGUAGES,
  EARLY_LEVELS,
  INTERMEDIATE_LEVELS,
  StoryContent,
} from './util'

const app = express()
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))

const job = CronJob.from({
  cronTime: '0 0 * * *', // Run at midnight every day
  onTick: async () =>
    generateDailyStories(SUPPORTED_LANGUAGES, [
      ...EARLY_LEVELS,
      ...INTERMEDIATE_LEVELS,
    ]),
  start: true,
  timeZone: 'utc',
})

// Home page route
app.get('/', (_req: Request, res: Response) => {
  res.render('home', {
    languages: SUPPORTED_LANGUAGES,
    earlyLevels: EARLY_LEVELS,
    intermediateLevels: INTERMEDIATE_LEVELS,
  })
})

app.get('/:language/:level', async (req: Request, res: Response, next) => {
  try {
    const { language, level } = req.params

    // Build file path based on current date
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
      language!.toLowerCase(),
      level!.toLowerCase(),
      'story.json'
    )

    let content: StoryContent

    try {
      // Try to load story from filesystem
      const fileContent = await readFile(filePath, 'utf-8')
      content = JSON.parse(fileContent)
      console.log(`Loaded story from ${filePath}`)
    } catch (error) {
      // If file doesn't exist, generate a new story
      console.log(`Story not found at ${filePath}, generating new story...`)
      throw error
    }

    res.render('story', {
      title: content.title,
      story: content.story,
      messages: content.messages,
      questions: content.questions,
      language: language!.charAt(0).toUpperCase() + language!.slice(1),
      level: level!.toUpperCase(),
      date: now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dateISO: now.toISOString().split('T')[0],
    })
  } catch (error) {
    next(error)
  }
})

// 404 handler - must be after all other routes
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    status: 404,
    message: 'Page Not Found',
    details: `The requested URL ${req.url} was not found on this server.`,
  })
})

// 500 error handler - must be last
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Error occurred:', err)
  res.status(500).render('error', {
    status: 500,
    message: 'Internal Server Error',
    details: err.message || 'An unexpected error occurred.',
  })
})

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
  job.start()
})
