import { Router, Request, Response, NextFunction } from 'express'
import { User } from '../models/user.js'

const router = Router()

// Generic message used for any failed login so we don't reveal whether an
// email exists or whether it was the password that was wrong.
const INVALID_CREDENTIALS = 'Invalid email or password'

// --- Signup ---------------------------------------------------------------

router.get('/signup', (_req: Request, res: Response) => {
  res.render('signup', { error: null })
})

router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : ''
    const password =
      typeof req.body.password === 'string' ? req.body.password : ''

    if (!email || !password) {
      return res
        .status(400)
        .render('signup', { error: 'Email and password are required' })
    }

    const existing = await User.findByEmail(email)
    if (existing) {
      return res
        .status(409)
        .render('signup', { error: 'An account with that email already exists' })
    }

    const user = await User.register({ email, password })
    req.session.userId = user.id
    res.redirect('/')
  } catch (error) {
    next(error)
  }
})

// --- Login ----------------------------------------------------------------

router.get('/login', (_req: Request, res: Response) => {
  res.render('login', { error: null })
})

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : ''
    const password =
      typeof req.body.password === 'string' ? req.body.password : ''

    const user = await User.findByEmail(email)
    if (!user || !(await user.verifyPassword(password))) {
      return res.status(401).render('login', { error: INVALID_CREDENTIALS })
    }

    await user.recordLogin()
    req.session.userId = user.id
    res.redirect('/')
  } catch (error) {
    next(error)
  }
})

// --- Logout ---------------------------------------------------------------

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.session.destroy((err) => {
    if (err) return next(err)
    res.clearCookie('connect.sid')
    res.redirect('/')
  })
})

export default router

// Middleware: require an authenticated session. Redirects to /login when the
// request has no logged-in user. Use to protect routes (e.g. streak pages).
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.session.userId) {
    next()
  } else {
    res.redirect('/login')
  }
}
