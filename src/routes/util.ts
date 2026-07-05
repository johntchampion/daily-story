import { Router, Request, Response } from 'express'
import {
  StoryGenerationService,
  SUPPORTED_LANGUAGES,
  LEVELS,
} from '../storyService.js'

const router = Router()

// Story generation service used by the utility/cron routes below.
const storyService = new StoryGenerationService(
  process.env.ANTHROPIC_API_KEY || ''
)

// Format a date as YYYY-MM-DD.
const formatDate = (date: Date): string => {
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Manual / cron-triggered story generation.
//
// Three-step process:
//   1. Process any completed batches that haven't been written to disk yet
//   2. If a batch is in progress, report it and return (avoids duplicates)
//   3. Create new batches for today/tomorrow if their stories don't exist
router.get('/generate-stories', async (_req: Request, res: Response) => {
  try {
    const messages: string[] = []

    // Step 1: Process any completed batches first
    const processResult = await storyService.processBatches()

    if (processResult.processedBatchIDs.length > 0) {
      messages.push(
        `✓ Processed ${processResult.processedBatchIDs.length} completed batch(es)`
      )
    }
    if (processResult.errorBatchIDs.length > 0) {
      messages.push(
        `⚠ Encountered ${processResult.errorBatchIDs.length} error(s) while processing batches`
      )
    }
    if (processResult.inProgressBatchIDs.length > 0) {
      messages.push(
        `⏳ Batch(es) currently in progress: ${processResult.inProgressBatchIDs.length}. Please wait for processing to complete before requesting new stories.`
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
            LEVELS,
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

export default router
