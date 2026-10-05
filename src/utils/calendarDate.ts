// Helpers for plain YYYY-MM-DD calendar dates. Arithmetic is done in UTC so a
// date string never shifts because of the server's local timezone.

function parseDateISO(dateISO: string): [number, number, number] {
  return dateISO.split('-').map(Number) as [number, number, number]
}

function formatUTCDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The server-local calendar date of `date`, as YYYY-MM-DD. */
export function toLocalDateISO(date: Date): string {
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function subtractDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = parseDateISO(dateISO)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - days)
  return formatUTCDateISO(date)
}

export function daysSinceEpoch(dateISO: string): number {
  const [year, month, day] = parseDateISO(dateISO)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/** A YYYY-MM-DD date as e.g. "November 12, 2025", independent of timezone. */
export function formatLongDate(dateISO: string): string {
  const [year, month, day] = parseDateISO(dateISO)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  )
}
