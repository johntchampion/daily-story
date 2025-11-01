import path from 'path'
import express, { Request, Response } from 'express'
import { CronJob } from 'cron'
import { readFile } from 'fs/promises'
import {
  generateStory,
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
  timeZone: 'America/New_York',
})

app.get('/:language/:level', async (req: Request, res: Response) => {
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
    content = await generateStory(language!, level!)
  }

  res.render('index', {
    title: content.title,
    story: content.story,
    messages: content.messages,
    questions: content.questions,
  })
})

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`)
  job.start()
})
