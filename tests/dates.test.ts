import { describe, expect, it } from 'vitest'

import { monthYearOrText, yearOrText } from '@/lib/utils/dates'

/**
 * A project's date is shown as month and year; the day is never part of it. An ISO date
 * is formatted by the platform (Jalali for Persian), free text keeps what the editor
 * wrote minus a spelled-out day, and a value with no day in it is left exactly alone.
 */
describe('monthYearOrText', () => {
  it('formats an ISO date as month and year in the page language', () => {
    expect(monthYearOrText('2026-01-21T00:00:00.000Z', 'fa')).toBe('بهمن ۱۴۰۴')
    expect(monthYearOrText('2024-03-12', 'en')).toBe('March 2024')
  })

  it('drops the day from a spelled-out date', () => {
    expect(monthYearOrText('۱ بهمن ۱۴۰۴', 'fa')).toBe('بهمن ۱۴۰۴')
    expect(monthYearOrText('1 مهر 1403', 'fa')).toBe('مهر 1403')
    expect(monthYearOrText('12 March 2024', 'en')).toBe('March 2024')
    expect(monthYearOrText('March 12, 2024', 'en')).toBe('March 2024')
    expect(monthYearOrText('1404/11/01', 'fa')).toBe('1404/11')
    expect(monthYearOrText('۱۴۰۴-۱۱-۰۱', 'fa')).toBe('۱۴۰۴-۱۱')
  })

  it('leaves values without a day exactly as the editor wrote them', () => {
    for (const value of ['۱۴۰۴', 'بهار ۱۴۰۳', 'بهمن ۱۴۰۴', '2024', 'Spring 2024']) {
      expect(monthYearOrText(value, 'fa')).toBe(value)
    }
  })

  it('returns null for an empty value', () => {
    expect(monthYearOrText('  ', 'fa')).toBeNull()
    expect(monthYearOrText(null, 'fa')).toBeNull()
    expect(monthYearOrText(undefined, 'en')).toBeNull()
  })
})

describe('yearOrText', () => {
  it('keeps only the year where space is tight', () => {
    expect(yearOrText('2026-01-21T00:00:00.000Z', 'fa')).toBe('۱۴۰۴')
    expect(yearOrText('2024-03-12', 'en')).toBe('2024')
    expect(yearOrText('۱ بهمن ۱۴۰۴', 'fa')).toBe('۱۴۰۴')
    expect(yearOrText('بهار ۱۴۰۳', 'fa')).toBe('۱۴۰۳')
    expect(yearOrText('Spring 2024', 'en')).toBe('2024')
  })

  it('returns text without a year unchanged, and null for nothing', () => {
    expect(yearOrText('در دست طراحی', 'fa')).toBe('در دست طراحی')
    expect(yearOrText('', 'fa')).toBeNull()
  })
})
