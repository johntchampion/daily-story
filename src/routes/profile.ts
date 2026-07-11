import { Router, Request, Response, NextFunction } from 'express'
import { SUPPORTED_LANGUAGES, LEVELS } from '../constants.js'
import { User } from '../models/user.js'

const router = Router()

// --- Onboarding -----------------------------------------------------------

// Onboarding flow: pick a language + level, then read the first story.
router.get('/onboarding', (req: Request, res: Response) => {
  res.render('onboarding', {
    languages: SUPPORTED_LANGUAGES,
    levels: LEVELS,
    isLoggedIn: Boolean(req.session.userId),
  })
})

// Save the language/level chosen during onboarding and send the user on to a
// story. Either field may be missing — onboarding is skippable — so we persist
// whatever was provided (partially, if only one was chosen) rather than
// requiring both. When logged in, the choice is saved to the account; provided
// values are also mirrored into the session.
router.post(
  '/onboarding',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLanguage =
        typeof req.body.language === 'string' ? req.body.language.trim() : ''
      const rawLevel =
        typeof req.body.level === 'string' ? req.body.level.trim() : ''

      // Resolve to canonical values; ignore anything not actually supported.
      const language = SUPPORTED_LANGUAGES.find(
        (lang) => lang.toLowerCase() === rawLanguage.toLowerCase(),
      )
      const level = LEVELS.find((lvl) => lvl === rawLevel.toUpperCase())

      if (req.session.userId) {
        const user = await User.findById(req.session.userId)
        if (user) {
          // Partial update: only the provided fields are written (no-op if
          // neither was chosen).
          await user.updatePreferences({
            ...(language ? { language } : {}),
            ...(level ? { level } : {}),
          })
        }
      }

      // Mirror provided values into the session (lowercase to match the story
      // route convention), leaving any prior values untouched.
      if (language) req.session.lastViewedLanguage = language.toLowerCase()
      if (level) req.session.lastViewedLevel = level.toLowerCase()

      // Send them to a story, filling any gap from the session or the first
      // supported option so the URL is always valid.
      const destLanguage =
        req.session.lastViewedLanguage ?? SUPPORTED_LANGUAGES[0].toLowerCase()
      const destLevel =
        req.session.lastViewedLevel ?? LEVELS[0].toLowerCase()

      res.redirect(`/${destLanguage}/${destLevel}`)
    } catch (error) {
      next(error)
    }
  },
)

export default router
