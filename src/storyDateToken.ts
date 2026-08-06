import { createHmac, timingSafeEqual } from 'crypto'
import { Language, Level } from './constants.js'

const SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret'

export function signStoryDate(
  userId: number,
  language: Language,
  level: Level,
  date: string,
): string {
  return createHmac('sha256', SECRET)
    .update(`story-date:${userId}|${language}|${level}|${date}`)
    .digest('hex')
}

export function verifyStoryDate(
  userId: number,
  language: Language,
  level: Level,
  date: string,
  token: string,
): boolean {
  const expected = signStoryDate(userId, language, level, date)
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(token, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
