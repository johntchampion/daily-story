import 'dotenv/config'
import path from 'path'
import express, { Request, Response } from 'express'
import { readFile } from 'fs/promises'
import {
  StoryGenerationService,
  SUPPORTED_LANGUAGES,
  EARLY_LEVELS,
  INTERMEDIATE_LEVELS,
  StoryContent,
} from './storyService'

// Initialize the story generation service
const storyService = new StoryGenerationService(
  process.env.ANTHROPIC_API_KEY || ''
)

const app = express()
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))

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
    const messages: string[] = []

    // Step 1: Process any completed batches first
    const processResult = await storyService.processCompletedBatches()

    if (processResult.processed > 0) {
      messages.push(
        `✓ Processed ${processResult.processed} completed batch(es)`
      )
    }
    if (processResult.errors > 0) {
      messages.push(
        `⚠ Encountered ${processResult.errors} error(s) while processing batches`
      )
    }

    // Step 2: Check if there's already a batch in progress
    const inProgressBatchId = await storyService.checkInProgressBatch()
    if (inProgressBatchId) {
      messages.push(
        `⏳ Batch ${inProgressBatchId} is currently in progress. Please wait for it to complete before requesting new stories.`
      )
      messages.push(
        'Call this endpoint again to check for completed batches and process results.'
      )
      res.type('text/plain')
      res.send(messages.join('\n'))
      return
    }

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Step 3: Check which stories need to be generated
    const todayExists = await storyService.checkStoriesExistForDate(now)
    const tomorrowExists = await storyService.checkStoriesExistForDate(tomorrow)

    const datesToGenerate: Date[] = []
    if (!todayExists) datesToGenerate.push(now)
    if (!tomorrowExists) datesToGenerate.push(tomorrow)

    if (datesToGenerate.length === 0) {
      messages.push(
        `✓ Stories for today (${formatDate(now)}) and tomorrow (${formatDate(
          tomorrow
        )}) have already been generated.`
      )
      res.type('text/plain')
      res.send(messages.join('\n'))
    } else {
      // Step 4: Create batches without waiting for completion
      const batchIds: string[] = []

      for (const date of datesToGenerate) {
        try {
          const batchId = await storyService.generateDailyStories(
            SUPPORTED_LANGUAGES,
            [...EARLY_LEVELS, ...INTERMEDIATE_LEVELS],
            date
          )

          if (batchId) {
            batchIds.push(batchId)
            messages.push(
              `✓ Batch ${batchId} is processing stories for ${formatDate(date)}`
            )
          }
        } catch (error) {
          console.error(
            `Error creating batch for ${formatDate(date)}:`,
            error instanceof Error ? error.message : 'Unknown error'
          )
          messages.push(
            `✗ Failed to create batch for ${formatDate(date)}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }
      }

      if (batchIds.length > 0) {
        messages.push(
          '\nStories will be available once batch processing completes.'
        )
        messages.push(
          'Call this endpoint again to check for completed batches and process results.'
        )
      }

      res.type('text/plain')
      res.send(messages.join('\n'))
    }
  } catch (error) {
    console.error(
      'Error in generate-stories route:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    res
      .status(500)
      .type('text/plain')
      .send(
        `Error checking or generating stories: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
  }
})

// Get today's story for a given language and level
app.get('/:language/:level', async (req: Request, res: Response, next) => {
  try {
    const { language, level } = req.params

    // Validate language and level
    const normalizedLanguage = language?.toLowerCase() || ''
    const normalizedLevel = level?.toUpperCase() || ''

    const isValidLanguage = SUPPORTED_LANGUAGES.some(
      (lang) => lang.toLowerCase() === normalizedLanguage
    )
    const allLevels = [...EARLY_LEVELS, ...INTERMEDIATE_LEVELS]
    const isValidLevel = allLevels.includes(normalizedLevel)

    if (!isValidLanguage || !isValidLevel) {
      const supportedLanguages = SUPPORTED_LANGUAGES.join(', ')
      const supportedLevels = allLevels.join(', ')

      let errorMessage = 'Unsupported'
      if (!isValidLanguage && !isValidLevel) {
        errorMessage = 'Unsupported Language and Level'
      } else if (!isValidLanguage) {
        errorMessage = 'Unsupported Language'
      } else {
        errorMessage = 'Unsupported Level'
      }

      return res.status(400).render('error', {
        status: 400,
        message: errorMessage,
        details: `Supported languages: ${supportedLanguages}. Supported levels: ${supportedLevels}.`,
      })
    }

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
      normalizedLanguage,
      normalizedLevel.toLowerCase(),
      'story.json'
    )

    let content: StoryContent

    try {
      // Try to load story from filesystem
      const fileContent = await readFile(filePath, 'utf-8')
      content = JSON.parse(fileContent)
      console.log(`Loaded story from ${filePath}`)
    } catch (error) {
      // If file doesn't exist, render the no-story page
      console.log(`Story not found at ${filePath}`)
      res.render('no-story-today', {
        language:
          normalizedLanguage.charAt(0).toUpperCase() +
          normalizedLanguage.slice(1),
        level: normalizedLevel,
        date: now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        dateISO: now.toISOString().split('T')[0],
      })
      return
    }

    res.render('story', {
      title: content.title,
      story: content.story,
      messages: content.messages,
      questions: content.questions,
      language:
        normalizedLanguage.charAt(0).toUpperCase() +
        normalizedLanguage.slice(1),
      level: normalizedLevel,
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
})
