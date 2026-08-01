import { Router, Request, Response, NextFunction } from 'express'
import { SUPPORTED_LANGUAGES, LEVELS } from '../constants.js'
import { User } from '../models/user.js'
import { UserResponse } from '../models/userResponse.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { SKILL_ASSESSMENT, LEARNING_REASONS } from '../survey/index.js'

const router = Router()

// All profile routes are for account holders only.
router.use(requireAuth)

// --- Onboarding -----------------------------------------------------------

// Onboarding flow: pick a language + level, then read the first story.
router.get('/onboarding', (req: Request, res: Response) => {
  res.render('onboarding', {
    languages: SUPPORTED_LANGUAGES,
    levels: LEVELS,
    skillAssessmentQuestion: SKILL_ASSESSMENT,
    reasonsQuestion: LEARNING_REASONS,
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

      // The richer skill self-assessment the level buttons now offer (each
      // maps to the CEFR `level` above, submitted alongside it). Matching
      // against the known option list also validates the submitted id.
      const skillAssessmentId =
        typeof req.body.skillAssessment === 'string'
          ? req.body.skillAssessment.trim()
          : ''
      const skillAssessment = SKILL_ASSESSMENT.options.find(
        (opt) => opt.id === skillAssessmentId,
      )

      // Reasons is a multi-select: zero, one, or many `reasons` fields may be
      // submitted. Ignore anything that doesn't match a known option.
      const rawReasonsForLearning = req.body.reasons
      const reasonIds = Array.isArray(rawReasonsForLearning)
        ? rawReasonsForLearning.filter(
            (r): r is string => typeof r === 'string',
          )
        : typeof rawReasonsForLearning === 'string'
          ? [rawReasonsForLearning]
          : []
      const selectedReasons = LEARNING_REASONS.options.filter((opt) =>
        reasonIds.includes(opt.id),
      )

      if (req.session.userId) {
        const user = await User.findById(req.session.userId)
        if (user) {
          await user.updatePreferences({
            ...(language ? { language } : {}),
            ...(level ? { level } : {}),
          })

          if (skillAssessment) {
            await UserResponse.record({
              userId: user.id,
              questionKey: SKILL_ASSESSMENT.key,
              answer: skillAssessment.id,
            })
          }
          if (selectedReasons.length > 0) {
            await UserResponse.record({
              userId: user.id,
              questionKey: LEARNING_REASONS.key,
              answer: selectedReasons.map((opt) => opt.id),
            })
          }
        }
      }

      if (language) req.session.lastViewedLanguage = language.toLowerCase()
      if (level) req.session.lastViewedLevel = level.toLowerCase()

      const destLanguage =
        req.session.lastViewedLanguage ?? SUPPORTED_LANGUAGES[0].toLowerCase()
      const destLevel = req.session.lastViewedLevel ?? LEVELS[0].toLowerCase()

      res.redirect(`/${destLanguage}/${destLevel}`)
    } catch (error) {
      next(error)
    }
  },
)

export default router
