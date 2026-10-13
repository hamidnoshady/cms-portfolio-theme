import { describe, expect, it } from 'vitest'

import * as runtime from '@eshobe/site-runtime'
import {
  blockSlugsForSiteType,
  contractVersion,
  dirFor,
  formatDate,
  formatNumber,
  formatPrice,
  HOME_SLUG,
  isHexColor,
  localeHref,
  pagePath,
  RESERVED_PAGE_SLUGS,
  siteBlocks,
  slugify,
  themeCss,
  toLocaleDigits,
} from '@/lib/runtime'

/**
 * The runtime contract: the vendored `@eshobe/site-runtime` must still be the one the
 * theme was written against (`contractVersion = 1`), and every helper the theme relies
 * on must exist. If a future drop-in replaces the vendored copy, this file fails before
 * a silent behavioural change can reach a page.
 */
describe('@eshobe/site-runtime contract', () => {
  it('is contractVersion 1', () => {
    expect(contractVersion).toBe(1)
    expect(runtime.contractVersion).toBe(1)
  })

  it('exposes the helpers the theme imports', () => {
    for (const [name, value] of Object.entries({
      blockSlugsForSiteType,
      dirFor,
      formatDate,
      formatNumber,
      formatPrice,
      isHexColor,
      localeHref,
      pagePath,
      slugify,
      themeCss,
      toLocaleDigits,
    })) {
      expect(typeof value, name).toBe('function')
    }
    expect(Array.isArray(siteBlocks)).toBe(true)
    expect(siteBlocks.length).toBeGreaterThan(0)
    expect(HOME_SLUG).toBe('home')
    expect(RESERVED_PAGE_SLUGS).toContain('posts')
  })

  it('formats Persian dates in the Gregorian calendar with Persian digits by default', () => {
    const formatted = formatDate('2026-03-21T12:00:00.000Z', 'fa', { dateStyle: 'medium' })
    expect(formatted).toMatch(/[۰-۹]/u)
    expect(formatted).not.toMatch(/\d/u)
  })

  it('formats English dates with Latin digits', () => {
    const formatted = formatDate('2026-03-21T12:00:00.000Z', 'en', { dateStyle: 'medium' })
    expect(formatted).toMatch(/2026/u)
    expect(formatted).not.toMatch(/[۰-۹]/u)
  })

  it('localises numbers and prices through the runtime, not through Intl in components', () => {
    expect(toLocaleDigits('0912 345 6789', 'fa')).toMatch(/[۰-۹]/u)
    expect(formatNumber(1234567, 'fa')).toMatch(/[۰-۹]/u)
    const price = formatPrice(1_250_000, 'IRT', 'fa')
    expect(price).toMatch(/[۰-۹]/u)
  })

  it('turns a CMS slug into a Persian-safe, URL-safe slug', () => {
    expect(slugify('پروژه‌ی شماره ۱')).toBe('پروژه-ی-شماره-1')
    expect(slugify('A  Path//Like This')).not.toMatch(/[/\s]/u)
  })

  it('builds locale-prefixed URLs only for non-default locales', () => {
    expect(localeHref('/about', 'fa', 'fa')).toBe('/about')
    expect(localeHref('/about', 'en', 'fa')).toBe('/en/about')
    expect(localeHref('/', 'en', 'fa')).toBe('/en')
    expect(localeHref('/', 'fa', 'fa')).toBe('/')
  })

  it('maps the home slug to the root path', () => {
    expect(pagePath(HOME_SLUG)).toBe('/')
    expect(pagePath('about')).toBe('/about')
  })

  it('derives direction from the locale, not from a component constant', () => {
    expect(dirFor('fa')).toBe('rtl')
    expect(dirFor('en')).toBe('ltr')
  })

  it('only accepts hex colours and never emits a dark-mode block', () => {
    expect(isHexColor('#000000')).toBe(true)
    expect(isHexColor('#abc')).toBe(true)
    expect(isHexColor('rgb(0,0,0)')).toBe(false)
    const css = themeCss({ accent: '#111111', lineHeight: 1, primary: '#000000', radius: 'none' })
    expect(css).toContain('--primary')
    expect(css).toMatch(/--radius:\s*0/u)
    expect(css).not.toContain('[data-theme')
  })

  it('answers block allowlists per site type', () => {
    expect(siteBlocks).toContain('gallery')
    expect(blockSlugsForSiteType('portfolio')).toContain('gallery')
    expect(blockSlugsForSiteType('portfolio')).not.toContain('productGrid')
  })
})
