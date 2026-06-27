import 'dotenv/config'
import path from 'path'
import express, { Request, Response } from 'express'
import session from 'express-session'
import {
  SUPPORTED_LANGUAGES,
  EARLY_LEVELS,
  INTERMEDIATE_LEVELS,
} from './storyService'
import authRoutes from './routes/auth'
import utilRoutes from './routes/util'
import storyRoutes from './routes/story'

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
  })
)

// Authentication routes (signup, login, logout)
app.use(authRoutes)

// Utility/cron routes (e.g. /generate-stories)
app.use(utilRoutes)

// Home page route
app.get('/', (req: Request, res: Response) => {
  res.render('home', {
    languages: SUPPORTED_LANGUAGES,
    earlyLevels: EARLY_LEVELS,
    intermediateLevels: INTERMEDIATE_LEVELS,
    isLoggedIn: Boolean(req.session.userId),
  })
})

// About page route
app.get('/about', (_req: Request, res: Response) => {
  res.render('about')
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
