import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import { readFile } from 'fs/promises'
import { StoryContent } from '../services/storyService.js'
import { SUPPORTED_LANGUAGES, LEVELS } from '../config/constants.js'
import { UserStoryActivity } from '../models/userStoryActivity.js'
import { signStoryDate, verifyStoryDate } from '../utils/storyDateToken.js'

const router = Router()

// Display today's story for a given language and level.
router.get(
  '/:language/:level',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { language, level } = req.params

      // Validate language and level
      const normalizedLanguage = language?.toLowerCase() || ''
      const normalizedLevel = level?.toUpperCase() || ''

      const isValidLanguage = SUPPORTED_LANGUAGES.some(
        (lang) => lang.toLowerCase() === normalizedLanguage,
      )
      const allLevels = LEVELS
      const isValidLevel = allLevels.some((lvl) => lvl === normalizedLevel)

      if (isValidLanguage && isValidLevel) {
        req.session.lastViewedLanguage = normalizedLanguage
        req.session.lastViewedLevel = normalizedLevel.toLowerCase()
      }

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
          isLoggedIn: Boolean(req.session.userId),
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
        'story.json',
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
          dateISO: `${year}-${month}-${day}`,
          isLoggedIn: Boolean(req.session.userId),
        })
        return
      }

      const matchedLanguage = SUPPORTED_LANGUAGES.find(
        (lang) => lang.toLowerCase() === normalizedLanguage,
      )!
      const matchedLevel = allLevels.find((lvl) => lvl === normalizedLevel)!
      const dateISO = `${year}-${month}-${day}`
      const storyDateToken = req.session.userId
        ? signStoryDate(
            req.session.userId,
            matchedLanguage,
            matchedLevel,
            dateISO,
          )
        : null

      if (req.session.userId) {
        UserStoryActivity.recordVisit({
          userId: req.session.userId,
          date: dateISO,
          language: matchedLanguage,
          level: matchedLevel,
        }).catch((error) =>
          console.error('Failed to record story visit:', error),
        )
      }

      // Load stories for all other levels within the same language
      const otherLevels: Array<{
        level: string
        title: string
        url: string
      }> = []

      for (const otherLevel of allLevels) {
        // Skip the current level
        if (otherLevel === normalizedLevel) continue

        const otherFilePath = path.join(
          process.cwd(),
          'stories',
          year,
          month,
          day,
          normalizedLanguage,
          otherLevel.toLowerCase(),
          'story.json',
        )

        try {
          const otherFileContent = await readFile(otherFilePath, 'utf-8')
          const otherStory: StoryContent = JSON.parse(otherFileContent)
          otherLevels.push({
            level: otherLevel,
            title: otherStory.title,
            url: `/${normalizedLanguage}/${otherLevel.toLowerCase()}`,
          })
        } catch {
          // Story doesn't exist for this level, skip it
          continue
        }
      }

      res.render('story', {
        title: content.title,
        titleEn: content.titleEn,
        story: content.story,
        messages: content.messages,
        questions: content.questions,
        language: matchedLanguage,
        level: matchedLevel,
        date: now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        dateISO,
        storyDateToken,
        otherLevels,
        isLoggedIn: Boolean(req.session.userId),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Record a piece of user story activity.
router.post(
  '/record-activity',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session.userId) {
        res.status(204).end()
        return
      }

      const { language, level, date, storyToken, correct, incorrect } =
        req.body ?? {}
      const normalizedLanguage =
        typeof language === 'string' ? language.toLowerCase() : ''
      const normalizedLevel =
        typeof level === 'string' ? level.toUpperCase() : ''

      const matchedLanguage = SUPPORTED_LANGUAGES.find(
        (lang) => lang.toLowerCase() === normalizedLanguage,
      )
      const matchedLevel = LEVELS.find((lvl) => lvl === normalizedLevel)

      if (!matchedLanguage || !matchedLevel) {
        res.status(400).end()
        return
      }

      const isValidDate =
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)

      if (
        !isValidDate ||
        typeof storyToken !== 'string' ||
        !verifyStoryDate(
          req.session.userId,
          matchedLanguage,
          matchedLevel,
          date,
          storyToken,
        )
      ) {
        res.status(400).end()
        return
      }

      const isValidCount = (n: unknown): n is number =>
        typeof n === 'number' && Number.isInteger(n) && n >= 0

      if (!isValidCount(correct) || !isValidCount(incorrect)) {
        res.status(400).end()
        return
      }

      await UserStoryActivity.recordAttempt({
        userId: req.session.userId,
        date,
        language: matchedLanguage,
        level: matchedLevel,
        correctCount: correct,
        incorrectCount: incorrect,
      })

      res.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

export default router
