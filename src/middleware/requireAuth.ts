import { Request, Response, NextFunction } from 'express'

// Middleware: require an authenticated session. Unauthenticated requests are
// redirected to /login. Use to protect account-holder-only routes (e.g. the
// profile pages).
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.session.userId) {
    next()
  } else {
    res.redirect('/login')
  }
}
