import 'server-only'

import { pagePath } from '@/lib/runtime'

import type { SiteContext } from '@/lib/cms/context'
import { getSectionRef, localizedPostHref } from '@/lib/cms/content'
import { getPageById, getPostById, getPostsByIds } from '@/lib/cms/endpoints'
import type { PageDoc } from '@/lib/cms/types'

import { href } from './locale'
import { THEME_ROUTES } from './paths'
import { safeCustomUrl } from './safeUrl'

export { safeCustomUrl } from './safeUrl'

/**
 * The one resolver for every CMS link: navigation menus, content-column links, CTA
 * buttons, rich-text links and inline banners all come through here, so a reference
 * resolves to the same URL wherever an editor placed it.
 *
 * Contract:
 * - A **reference** stores a document id (or the populated document); it resolves to
 *   that document's canonical theme URL in the current locale, with the locale prefix
 *   applied exactly once. A page bound to a section slot lands on the section's fixed
 *   route (`/about`), never on its editable slug.
 * - A **custom URL** is validated: `http(s)`, `mailto` and `tel` are the only schemes;
 *   anything else (`javascript:`, `data:` …) is refused. Local paths are normalised,
 *   and an unprefixed one is placed in the current locale's tree. Fragments (`#…`) and
 *   query suffixes are kept.
 * - Anything that does not resolve is `null`. Callers render no link at all — never a
 *   placeholder `#` that looks like a working control.
 */

export type ResolvedLink = { external: boolean; href: string; newTab: boolean }

export type LinkInput = {
  newTab?: null | boolean
  reference?: null | { relationTo?: null | string; value?: unknown }
  type?: null | string
  url?: null | string
}

const idOf = (value: unknown): null | string => {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null
  }
  return null
}

/**
 * The URL of a page document in the current locale: a page bound to (or hinted as) a
 * section slot is that section's route; any other page is its own localized slug.
 */
export const pageHref = (page: Pick<PageDoc, 'id' | 'slug'>, ctx: SiteContext): string => {
  for (const [section, route] of [
    ['home', THEME_ROUTES.home],
    ['about', THEME_ROUTES.about],
    ['contact', THEME_ROUTES.contact],
    ['careers', THEME_ROUTES.careers],
    ['legal', THEME_ROUTES.legal],
  ] as const) {
    const ref = getSectionRef(section, ctx)
    if ((ref.by === 'binding' && ref.id === String(page.id)) || (ref.by === 'slug' && ref.slug === page.slug)) {
      return href(route, ctx.locale, ctx.site)
    }
  }
  return href(pagePath(page.slug), ctx.locale, ctx.site)
}

/** Bound section pages resolve without a read — the binding is the answer. */
const boundPageHref = (id: string, ctx: SiteContext): null | string => {
  for (const [section, route] of [
    ['home', THEME_ROUTES.home],
    ['about', THEME_ROUTES.about],
    ['contact', THEME_ROUTES.contact],
    ['careers', THEME_ROUTES.careers],
    ['legal', THEME_ROUTES.legal],
  ] as const) {
    const ref = getSectionRef(section, ctx)
    if (ref.by === 'binding' && ref.id === id) return href(route, ctx.locale, ctx.site)
  }
  return null
}

/** One document reference (`pages`/`posts`, id or populated) → its localized URL. */
export const referenceHref = async (
  reference: LinkInput['reference'],
  ctx: SiteContext,
): Promise<null | string> => {
  const id = idOf(reference?.value)
  if (!reference || !id) return null
  if (reference.relationTo === 'posts') {
    const post = await getPostById(id, ctx.locale, ctx.draft)
    return post ? localizedPostHref(post, ctx) : null
  }
  if (reference.relationTo && reference.relationTo !== 'pages') return null
  const bound = boundPageHref(id, ctx)
  if (bound) return bound
  // Always read in the current locale: a populated value can carry another locale's
  // slug, and the read also enforces published-only for public rendering.
  const page = await getPageById(id, ctx.locale, ctx.draft)
  return page?.slug ? pageHref(page, ctx) : null
}

/**
 * Many references at once (one rich-text field): posts in one batched read, pages
 * per id through the shared tenant cache. Keyed `relationTo:id`.
 */
export const referenceHrefs = async (
  references: { relationTo?: null | string; value?: unknown }[],
  ctx: SiteContext,
): Promise<Map<string, string>> => {
  const map = new Map<string, string>()
  const postIds = new Set<string>()
  const pageIds = new Set<string>()
  for (const reference of references) {
    const id = idOf(reference.value)
    if (!id) continue
    if (reference.relationTo === 'posts') postIds.add(id)
    else if (!reference.relationTo || reference.relationTo === 'pages') pageIds.add(id)
  }

  const [posts] = await Promise.all([
    getPostsByIds([...postIds], ctx.locale, ctx.draft),
    Promise.all(
      [...pageIds].map(async (id) => {
        const resolved = await referenceHref({ relationTo: 'pages', value: id }, ctx)
        if (resolved) map.set(`pages:${id}`, resolved)
      }),
    ),
  ])
  await Promise.all(
    posts.map(async (post) => {
      map.set(`posts:${post.id}`, await localizedPostHref(post, ctx))
    }),
  )
  return map
}

/** `link` group (menus, blocks) → a safe, localized link, or `null`. */
export const resolveCmsLink = async (link: LinkInput | null | undefined, ctx: SiteContext): Promise<null | ResolvedLink> => {
  if (!link) return null
  const newTab = Boolean(link.newTab)
  // Payload's link field defaults `type` to `reference`; an explicit `custom` or a link
  // that carries only a URL is a custom link.
  const isCustom = link.type === 'custom' || (!link.type && !link.reference && typeof link.url === 'string')
  if (isCustom) {
    const custom = safeCustomUrl(link.url, ctx.locale, ctx.site)
    return custom ? { ...custom, newTab } : null
  }
  const target = await referenceHref(link.reference, ctx)
  return target ? { external: false, href: target, newTab } : null
}

/** Shape used by the rich-text renderer to look a link node's reference up. */
export const referenceKey = (reference: { relationTo?: null | string; value?: unknown } | null | undefined): null | string => {
  const id = idOf(reference?.value)
  if (!id) return null
  return `${reference?.relationTo === 'posts' ? 'posts' : 'pages'}:${id}`
}
