import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import { readFile } from 'fs/promises'
import { StoryContent } from '../storyService.js'
import { SUPPORTED_LANGUAGES, LEVELS } from '../constants.js'

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
        (lang) => lang.toLowerCase() === normalizedLanguage
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
          isLoggedIn: Boolean(req.session.userId),
        })
        return
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
          'story.json'
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
        otherLevels,
        isLoggedIn: Boolean(req.session.userId),
      })
    } catch (error) {
      next(error)
    }
  }
)

export default router
