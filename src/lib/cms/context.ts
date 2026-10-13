import 'server-only'

import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import { dirFor } from '@/lib/runtime'

import type { Locale, SiteDescriptor } from './types'
import { cmsEnv, isLocaleServed, isSiteServing } from './client'
import { getSite } from './endpoints'
import { PREVIEW_COOKIE, previewEnabled, previewSecret, verifyPreviewToken } from './preview'

export { PREVIEW_COOKIE, previewEnabled, previewSecret, previewToken } from './preview'

export type SiteContext = {
  /** Canonical origin for metadata: the customer's real domain. */
  canonicalOrigin: string
  /** True when an authenticated preview cookie unlocked drafts. */
  draft: boolean
  /** Where this deployment is actually reachable (preview host ≠ customer domain). */
  deploymentOrigin: string
  dir: 'ltr' | 'rtl'
  locale: Locale
  /** False for `suspended`/`archived`: render the holding state, never content. */
  serving: boolean
  site: SiteDescriptor
}

const originFromHeaders = async (): Promise<string> => {
  const env = cmsEnv()
  if (env.publicOrigin) return env.publicOrigin.replace(/\/$/, '')
  const headerList = await headers()
  const host = headerList.get('host') ?? 'localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}

export const isPreviewRequest = async (path: string): Promise<boolean> => {
  const secret = previewSecret()
  if (!secret) return false
  const jar = await cookies()
  const token = jar.get(PREVIEW_COOKIE)?.value
  if (!token) return false
  return verifyPreviewToken(secret, path, token)
}

/**
 * Per-request site context. Draft mode requires **both** a valid preview token and a
 * site API key (anonymous draft reads are refused by the CMS anyway).
 */
export const getSiteContext = cache(async (locale: Locale, path = '/'): Promise<SiteContext> => {
  const site = await getSite()
  const env = cmsEnv()
  const draft = previewEnabled() && Boolean(env.apiKey) && (await isPreviewRequest(path))

  return {
    canonicalOrigin: `https://${site.domain}`,
    deploymentOrigin: await originFromHeaders(),
    dir: dirFor(locale),
    draft,
    locale,
    serving: isSiteServing(site),
    site,
  }
})

export const localeIsServed = (site: SiteDescriptor, locale: string): boolean =>
  isLocaleServed(site, locale)
