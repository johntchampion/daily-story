import 'dotenv/config'
import path from 'path'
import express, { Request, Response } from 'express'
import session from 'express-session'
import { SUPPORTED_LANGUAGES, LEVELS } from './config/constants'
import { User } from './models/user'
import { buildDashboardViewModel } from './services/dashboardViewModel'
import { syncSurveyQuestions } from './survey/sync'
import authRoutes from './routes/auth'
import utilRoutes from './routes/util'
import storyRoutes from './routes/story'
import profileRoutes from './routes/profile'

const app = express()
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))

// Parse form-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Session middleware. Uses the default in-memory store, which is fine for
// development but drops sessions on restart and leaks memory — swap for a
// persistent store (e.g. connect-pg-simple) before production.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  }),
)

// Authentication routes (signup, login, logout)
app.use(authRoutes)

// Utility/cron routes (e.g. /generate-stories)
app.use(utilRoutes)

// Profile routes (onboarding, preferences) mounted under /profile
app.use('/profile', profileRoutes)

// Home page route. Signed-in users get the dashboard ("Home v2"); logged-out
// visitors get the marketing home page.
app.get('/', async (req: Request, res: Response, next) => {
  try {
    // Signed in: load the account and render the dashboard.
    if (req.session.userId) {
      const user = await User.findById(req.session.userId)
      if (user) {
        return res.render('dashboard', await buildDashboardViewModel(user))
      }
    }

    // Logged out (or a stale session whose user no longer exists): the
    // marketing home page. Preselect the visitor's last-viewed language/level.
    res.render('home', {
      languages: SUPPORTED_LANGUAGES,
      levels: LEVELS,
      isLoggedIn: false,
      preferredLanguage: req.session.lastViewedLanguage ?? null,
      preferredLevel: req.session.lastViewedLevel ?? null,
    })
  } catch (error) {
    next(error)
  }
})

// About page route
app.get('/about', (req: Request, res: Response) => {
  res.render('about', {
    isLoggedIn: Boolean(req.session.userId),
  })
})

// Story display routes (/:language/:level). Mounted after the static page
// routes above so they take precedence over the catch-all param route.
app.use(storyRoutes)

// 404 handler - must be after all other routes
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    status: 404,
    message: 'Page Not Found',
    details: `The requested URL ${req.url} was not found on this server.`,
    isLoggedIn: Boolean(req.session.userId),
  })
})

// 500 error handler - must be last
app.use((err: Error, req: Request, res: Response, _next: any) => {
  console.error('Error occurred:', err)
  res.status(500).render('error', {
    status: 500,
    message: 'Internal Server Error',
    details: err.message || 'An unexpected error occurred.',
    isLoggedIn: Boolean(req.session.userId),
  })
})

async function start() {
  await syncSurveyQuestions()

  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`)
  })
}

start()
