import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import type { CmsLink, NavItem } from '@/lib/cms/types'
import { mediaUrl } from '@/lib/utils/media'

import { resolveCmsLink } from './links'
import { href } from './locale'
import { resolveThemeRoute } from './resolve'

/**
 * CMS navigation → theme URLs.
 *
 * A menu item is a link group: `type: reference|custom`, with a polymorphic
 * `reference` (`pages` or `posts`). A referenced **page** that is bound to a section
 * slot lands on that section's fixed route (`/about`), not on its editable slug — the
 * customer can rename «درباره ما» without moving the URL.
 */

export type NavLink = {
  current: boolean
  external: boolean
  href: string
  label: string
  newTab: boolean
}

/**
 * A menu item's target, through the one link resolver every CMS link uses
 * (`links.ts`): references by id, section bindings, validated custom URLs, and the
 * locale prefix applied exactly once.
 */
export const linkHref = async (link: CmsLink | null | undefined, ctx: SiteContext): Promise<null | string> =>
  (await resolveCmsLink(link, ctx))?.href ?? null

export const navLinks = async (
  items: NavItem[] | null | undefined,
  ctx: SiteContext,
  currentPath: string,
): Promise<NavLink[]> => {
  // Views pass their locale-neutral path (`/projects`); links are localized
  // (`/en/projects`), so "current" is compared in the same, localized form.
  const first = currentPath.split(/[/?#]/u)[1] ?? ''
  const here = first === ctx.locale && ctx.locale !== ctx.site.defaultLocale ? currentPath : href(currentPath, ctx.locale, ctx.site)
  const resolved = await Promise.all(
    (items ?? []).map(async (item) => {
      const link = item.link
      const resolved = await resolveCmsLink(link, ctx)
      if (!resolved) return null
      const label = (link?.label ?? '').trim() || labelFromUrl(resolved.href)
      return {
        current: !resolved.external && samePath(resolved.href, here),
        external: resolved.external,
        href: resolved.href,
        label,
        newTab: resolved.newTab,
      } satisfies NavLink
    }),
  )
  return resolved.filter((entry): entry is NavLink => Boolean(entry))
}

const labelFromUrl = (url: string): string => {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url
    const last = pathname.split('/').filter(Boolean).at(-1) ?? ''
    return decodeURIComponent(last)
  } catch {
    return url
  }
}

/** Compares only the pathname (query strings must not affect "current"). */
export const samePath = (a: string, b: string): boolean => {
  const path = (value: string): string => {
    try {
      return (value.startsWith('http') ? new URL(value).pathname : value.split('?')[0] ?? value).replace(/\/$/, '') || '/'
    } catch {
      return value
    }
  }
  return path(a) === path(b)
}

/**
 * Logo URLs for the chrome, both slots resolved: `primary` for the desktop header,
 * `compact` for phones/tablets (each falls back to the other when only one asset was
 * uploaded — `Logo` then renders a single image). Never bundled artwork.
 */
export const brandLogo = (ctx: SiteContext) => {
  const branding = ctx.site.branding
  const origin = ctx.site.media.origin
  const compact = mediaUrl(branding?.compactLogo ?? branding?.logoCompact ?? null, origin)
  const primary = mediaUrl(branding?.primaryLogo ?? branding?.logo ?? null, origin)
  const home = mediaUrl(branding?.homeLogo ?? null, origin)
  return { compact: compact ?? primary, home: home ?? primary, primary }
}

/** Route helper reused by `generateMetadata` and page bodies. */
export const routePathFor = (segments: string[], ctx: SiteContext): string => {
  const route = resolveThemeRoute(segments, ctx.site)
  return href('/', route.locale, ctx.site)
}
