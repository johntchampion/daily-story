import 'dotenv/config'
import path from 'path'
import express, { Request, Response } from 'express'
import { CronJob } from 'cron'
import { readFile, access } from 'fs/promises'
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

// Manual story generation route
app.get('/generate-stories', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')

    // Check if stories for today already exist by checking the first language/level combo
    const firstLanguage = SUPPORTED_LANGUAGES[0]?.toLowerCase() || 'spanish'
    const firstLevel = EARLY_LEVELS[0]?.toLowerCase() || 'a1'

    const sampleFilePath = path.join(
      process.cwd(),
      'stories',
      year,
      month,
      day,
      firstLanguage,
      firstLevel,
      'story.json'
    )

    let storiesExist = false
    try {
      await access(sampleFilePath)
      storiesExist = true
    } catch {
      storiesExist = false
    }

    if (storiesExist) {
      res.type('text/plain')
      res.send(
        `Stories for ${year}-${month}-${day} have already been generated.`
      )
    } else {
      // Start generation process
      res.type('text/plain')
      res.send(
        `Starting story generation for ${year}-${month}-${day}. This may take a few minutes...`
      )

      // Trigger generation in the background
      generateDailyStories(SUPPORTED_LANGUAGES, [
        ...EARLY_LEVELS,
        ...INTERMEDIATE_LEVELS,
      ])
        .then(() => {
          console.log(`Story generation completed for ${year}-${month}-${day}`)
        })
        .catch((error) => {
          console.error('Error during story generation:', error)
        })
    }
  } catch (error) {
    console.error('Error in generate-stories route:', error)
    res
      .status(500)
      .type('text/plain')
      .send('Error checking or generating stories.')
  }
})

// Get today's story for a given language and level
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

    res.render('index', {
      title: content.title,
      story: content.story,
      messages: content.messages,
      questions: content.questions,
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
