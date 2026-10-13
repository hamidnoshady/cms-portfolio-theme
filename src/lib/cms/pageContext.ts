import 'server-only'

import { notFound } from 'next/navigation'

import type { Locale } from './types'
import { getSiteOrNull } from './endpoints'
import { getSiteContext, type SiteContext } from './context'
import { brandName } from '@/lib/theme/brand'

/**
 * One entry point for every view's guards, so the order can never differ between
 * pages:
 *   1. CMS unreachable        → an honest "not connected" page (no fake studio identity)
 *   2. unknown host / no site → 404
 *   3. unserved locale        → 404 (never a silent fallback to the default locale)
 *   4. suspended / archived   → holding page, 200 + noindex, no portfolio content
 */
export type PageContextOutcome =
  | { ctx: SiteContext; ok: true }
  | { ok: false; state: 'unreachable' }
  | { name: null | string; ok: false; state: 'holding' }

export const loadPageContext = async (locale: Locale, pathname: string): Promise<PageContextOutcome> => {
  const site = await getSiteOrNull()
  if (!site) return { ok: false, state: 'unreachable' }
  if (!site.availableLocales.includes(locale)) notFound()

  const ctx = await getSiteContext(locale, pathname)
  if (!ctx.serving) return { name: brandName(site), ok: false, state: 'holding' }
  return { ctx, ok: true }
}
