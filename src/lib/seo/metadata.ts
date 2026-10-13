import 'server-only'

import type { Metadata } from 'next'

import type { SiteContext } from '@/lib/cms/context'
import type { Media } from '@/lib/cms/types'
import { href } from '@/lib/routing/locale'
import { absoluteMediaUrl, mediaUrl } from '@/lib/utils/media'
import { truncate } from '@/lib/utils/text'
import { brandName } from '@/lib/theme/brand'

/**
 * Metadata construction.
 *
 * Two deliberate choices:
 * - **Canonical identity is the customer's real domain** (`https://<site.domain>` from
 *   the descriptor), never a preview host. Preview deployments therefore keep
 *   `noindex` and a canonical that points at production.
 * - **OG images come from the document's own `meta.image` or the site's
 *   `defaultOgImage`.** The CMS's `/og` renderer is *not* used: in the direct
 *   deployment mode the theme container only proxies `/api/*`, so `/og` is not
 *   reachable from a customer domain and an `og:image` pointing at it would 404.
 */

export type MetadataInput = {
  context: SiteContext
  description?: null | string
  /** Localizable path without a locale prefix, e.g. `/projects/foo`. */
  path: string
  image?: Media | null
  noindex?: boolean
  title: string
  type?: 'article' | 'website'
  languages?: Record<string, string>
}

export const absoluteUrl = (context: SiteContext, path: string, locale = context.locale): string =>
  `${context.canonicalOrigin}${href(path, locale, context.site)}`

export const metadataFor = (input: MetadataInput): Metadata => {
  const { context, title, description, path, image, type = 'website', languages } = input
  const siteName = brandName(context.site)
  // Absolute for crawlers, but from where this deployment answers (ESHOBE_PUBLIC_ORIGIN),
  // so a preview's og:image never points at production.
  const ogImage = absoluteMediaUrl(
    mediaUrl(image ?? context.site.branding?.defaultOgImage ?? null, context.site.media.origin),
    context.deploymentOrigin,
  )
  const canonical = absoluteUrl(context, path)

  return {
    alternates: {
      canonical,
      ...(languages && Object.keys(languages).length > 1 ? { languages } : {}),
    },
    description: description ? truncate(description, 300) : undefined,
    openGraph: {
      description: description ? truncate(description, 300) : undefined,
      images: ogImage ? [{ alt: image?.alt ?? siteName, url: ogImage }] : undefined,
      locale: context.locale === 'fa' ? 'fa_IR' : 'en_US',
      siteName,
      title,
      type,
      url: canonical,
    },
    robots: context.draft || input.noindex || !context.serving ? { follow: false, index: false } : undefined,
    title,
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      description: description ? truncate(description, 200) : undefined,
      images: ogImage ? [ogImage] : undefined,
      title,
    },
  }
}

/** `hreflang` key for a locale (`fa` is published as `fa-IR`). */
export const hreflangFor = (locale: string): string => (locale === 'fa' ? 'fa-IR' : locale)
