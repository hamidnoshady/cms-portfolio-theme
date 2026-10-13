import { dirFor, localeHref } from '@/lib/runtime'

import type { Locale, SiteDescriptor } from '@/lib/cms/types'

export const KNOWN_LOCALES: Locale[] = ['fa', 'en']

export type LocaleSplit = {
  /** True when the URL carried an explicit locale prefix. */
  explicit: boolean
  locale: Locale
  /** Segments after the locale prefix. */
  rest: string[]
}

/**
 * Persian is the unprefixed default; other served locales live under `/<locale>`.
 * A locale that the site does not serve is **not** silently folded into the default —
 * `/de/...` must 404 rather than duplicate the site's home page under a URL that does
 * not exist (`docs/THEME_API.md` §11).
 */
export const splitLocale = (
  segments: string[],
  site: Pick<SiteDescriptor, 'availableLocales' | 'defaultLocale'>,
): LocaleSplit | { unsupported: string } => {
  const [first, ...rest] = segments
  if (first && KNOWN_LOCALES.includes(first as Locale)) {
    if (!site.availableLocales.includes(first as Locale)) return { unsupported: first }
    if (first === site.defaultLocale) return { explicit: true, locale: first as Locale, rest }
    return { explicit: true, locale: first as Locale, rest }
  }
  return { explicit: false, locale: site.defaultLocale, rest: segments }
}

export const href = (path: string, locale: Locale, site: Pick<SiteDescriptor, 'defaultLocale'>): string =>
  localeHref(path, locale, site.defaultLocale)

export const direction = (locale: Locale): 'ltr' | 'rtl' => dirFor(locale)

export const isDefaultLocale = (
  locale: Locale,
  site: Pick<SiteDescriptor, 'defaultLocale'>,
): boolean => locale === site.defaultLocale
