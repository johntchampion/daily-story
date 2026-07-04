import 'express-session'

// Augment the session payload with our application-specific fields.
declare module 'express-session' {
  interface SessionData {
    userId?: number
    preferredLanguage?: string
    preferredLevel?: string
  }
}
