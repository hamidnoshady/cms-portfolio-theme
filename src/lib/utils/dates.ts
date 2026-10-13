import { formatDate } from '@/lib/runtime'
import type { Locale } from '@/lib/cms/types'

/**
 * Date handling for CMS values — deliberately defensive.
 *
 * The contract has two different kinds of "date":
 *
 * - **machine dates** (`publishedAt`, `updatedAt`): ISO strings the CMS generates;
 * - **editor text** (`projectMetadata.date`, fact values): free text such as `۱۴۰۴`,
 *   «بهار ۱۴۰۳» or `2024`. Feeding that to `Intl` throws `RangeError: Invalid time
 *   value`, and one malformed field must never take down a whole page render.
 *
 * So: parse strictly, format only what really is a date, and otherwise show the raw
 * string exactly as the editor wrote it. Nothing is inferred and nothing is invented.
 */

export const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
  }
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  // Only ISO-like values: `2024`, `۱۴۰۴`, `spring` and `بهار` are text, not dates.
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/u.test(trimmed)) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export type DateStyleOptions = Intl.DateTimeFormatOptions

/** A real date formatted for the locale, or `null` when the value is not a date. */
export const dateText = (
  value: unknown,
  locale: Locale,
  options?: DateStyleOptions,
): null | string => {
  const parsed = parseDate(value)
  if (!parsed) return null
  try {
    return formatDate(parsed, locale, options)
  } catch {
    return null
  }
}

/**
 * A CMS value that may be a date or free text: formatted when it is a date, otherwise
 * returned as the raw string (never dropped, never guessed).
 */
export const dateOrText = (
  value: null | string | undefined,
  locale: Locale,
  options?: DateStyleOptions,
): null | string => {
  const raw = (value ?? '').trim()
  if (!raw) return null
  return dateText(raw, locale, options) ?? raw
}

/** A day-of-month or a four-digit year, written with Latin, Persian or Arabic-Indic digits. */
const DIGIT = '[0-9\u06F0-\u06F9\u0660-\u0669]'
const DAY = `${DIGIT}{1,2}`
const YEAR = `${DIGIT}{4}`

/**
 * Drops the day from free text that spells a full date — «۱ بهمن ۱۴۰۴», `1 Mehr 1403`,
 * `March 12, 2024`, `1404/11/01` — leaving month and year. Anything else (a year, a
 * season, «بهار ۱۴۰۳») has no day to drop and is returned untouched.
 */
const withoutDay = (text: string): string => {
  const dayFirst = text.match(new RegExp(`^(${DAY})\\s+(\\D+?)\\s+(${YEAR})$`, 'u'))
  if (dayFirst) return `${dayFirst[2]} ${dayFirst[3]}`
  const dayAfter = text.match(new RegExp(`^(\\D+?)\\s+(${DAY}),?\\s+(${YEAR})$`, 'u'))
  if (dayAfter) return `${dayAfter[1]} ${dayAfter[3]}`
  const numeric = text.match(new RegExp(`^(${YEAR})([/.-])(${DAY})\\2(${DAY})$`, 'u'))
  if (numeric) return `${numeric[1]}${numeric[2]}${numeric[3]}`
  return text
}

/**
 * A project's date as month and year — the day is never shown. An ISO date is
 * formatted for the locale (Jalali for Persian); free text keeps what the editor wrote
 * minus a spelled-out day.
 */
export const monthYearOrText = (value: null | string | undefined, locale: Locale): null | string => {
  const raw = (value ?? '').trim()
  if (!raw) return null
  // Month and year are formatted apart and joined, so the order is always «month year»
  // whatever the calendar's own pattern would be.
  const month = dateText(raw, locale, { month: 'long' })
  const year = dateText(raw, locale, { year: 'numeric' })
  return month && year ? `${month} ${year}` : withoutDay(raw)
}

/**
 * Just the year of a project's date, for places too small for more (a card): the year
 * of an ISO date, the four-digit year inside free text, and otherwise the text as is.
 */
export const yearOrText = (value: null | string | undefined, locale: Locale): null | string => {
  const raw = (value ?? '').trim()
  if (!raw) return null
  return dateText(raw, locale, { year: 'numeric' }) ?? raw.match(new RegExp(`(?<!${DIGIT})${YEAR}(?!${DIGIT})`, 'u'))?.[0] ?? raw
}
