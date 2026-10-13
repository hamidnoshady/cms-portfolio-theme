import type { MetadataRoute } from 'next'

import { getCategories, getPages, getPosts, getSiteOrNull } from '@/lib/cms/endpoints'
import { cmsEnv } from '@/lib/cms/client'
import { categorySubtree, resolveSectionRef } from '@/lib/theme/sections'
import { href } from '@/lib/routing/locale'
import { pagePath } from '@/lib/runtime'
import { detailPath, THEME_ROUTES } from '@/lib/routing/paths'
import type { CategoryDoc, Locale, SiteDescriptor } from '@/lib/cms/types'

export const revalidate = 300

const SECTION_SLUGS = new Set(['about', 'contact', 'careers', 'legal', 'projects', 'objects'])

const idOf = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return typeof id === 'string' ? id : null
  }
  return null
}

/**
 * Paginated sitemap.
 *
 * Only URLs that really exist are emitted: documents are read with
 * `fallbackLocale=false`, so an untranslated page does not advertise a URL that would
 * 404, and `hreflang` alternates are added only for locales where the document exists.
 * Projects/education entries are placed on their canonical section route rather than on
 * the CMS's reserved `/posts/<slug>`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteOrNull()
  if (!site || site.status !== 'active') return []
  const env = cmsEnv()
  const origin = `https://${site.domain}`

  const entries: MetadataRoute.Sitemap = []
  const locales = site.availableLocales

  const staticPaths: { changeFrequency: 'monthly' | 'weekly'; path: string; priority: number }[] = [
    { changeFrequency: 'weekly', path: THEME_ROUTES.home, priority: 1 },
    { changeFrequency: 'weekly', path: THEME_ROUTES.projects, priority: 0.9 },
    { changeFrequency: 'weekly', path: THEME_ROUTES.objects, priority: 0.9 },
    { changeFrequency: 'monthly', path: THEME_ROUTES.about, priority: 0.6 },
    { changeFrequency: 'monthly', path: THEME_ROUTES.contact, priority: 0.6 },
    { changeFrequency: 'monthly', path: THEME_ROUTES.careers, priority: 0.5 },
    { changeFrequency: 'monthly', path: THEME_ROUTES.legal, priority: 0.3 },
  ]

  for (const locale of locales) {
    for (const entry of staticPaths) {
      entries.push({
        changeFrequency: entry.changeFrequency,
        lastModified: new Date(),
        priority: entry.priority,
        url: `${origin}${href(entry.path, locale, site)}`,
      })
    }
  }

  const [pages, posts, categories] = await Promise.all([
    readAll('pages', site, locales, ['id', 'slug', 'updatedAt']),
    readAll('posts', site, locales, ['id', 'slug', 'categories', 'updatedAt']),
    safeCategories(site),
  ])

  // Posts are listed on the section route that renders them: projects or objects.
  const subtreeOf = (section: 'objects' | 'projects'): Set<string> => {
    const ref = resolveSectionRef(section, site.themeRuntime?.bindings)
    const root =
      ref.by === 'binding'
        ? categories.find((category) => String(category.id) === ref.id)
        : ref.by === 'slug'
          ? categories.find((category) => category.slug === ref.slug)
          : undefined
    if (!root) return new Set()
    return new Set([String(root.id), ...categorySubtree(root, categories).map((category) => String(category.id))])
  }
  const objectIds = subtreeOf('objects')
  const boundPageIds = new Set(
    (['home', 'about', 'contact', 'careers', 'legal'] as const).flatMap((section) => {
      const ref = resolveSectionRef(section, site.themeRuntime?.bindings)
      return ref.by === 'binding' ? [ref.id] : []
    }),
  )

  for (const locale of locales) {
    for (const page of pages[locale] ?? []) {
      // Section pages live on their fixed routes (listed above), whatever their slug.
      if (SECTION_SLUGS.has(page.slug) || page.slug === 'home' || (page.id && boundPageIds.has(page.id))) continue
      entries.push({
        changeFrequency: 'monthly',
        lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
        url: `${origin}${href(pagePath(page.slug), locale, site)}`,
      })
    }
    for (const post of posts[locale] ?? []) {
      const categoryIds = (post.categories ?? []).map(idOf).filter((id): id is string => Boolean(id))
      const path = categoryIds.some((id) => objectIds.has(id))
        ? detailPath('objects', post.slug)
        : detailPath('projects', post.slug)
      entries.push({
        changeFrequency: 'monthly',
        lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
        url: `${origin}${href(path, locale, site)}`,
      })
    }
  }

  void env
  return entries
}

const safeCategories = async (site: SiteDescriptor): Promise<CategoryDoc[]> => {
  try {
    return await getCategories(site.defaultLocale)
  } catch {
    return []
  }
}

type SlimDoc = { categories?: unknown[]; id?: string; slug: string; updatedAt?: null | string }

/** Reads every published document of a collection for one locale, capped and documented. */
const readAll = async (
  kind: 'pages' | 'posts',
  _site: SiteDescriptor,
  locales: Locale[],
  select: string[],
): Promise<Partial<Record<Locale, SlimDoc[]>>> => {
  const out: Partial<Record<Locale, SlimDoc[]>> = {}
  const options = { limit: 500, select: Object.fromEntries(select.map((key) => [key, true])) }
  for (const locale of locales) {
    try {
      const docs = kind === 'pages' ? (await getPages(locale, options)).docs : (await getPosts(locale, options)).docs
      out[locale] = docs.flatMap((doc) =>
        typeof doc.slug === 'string'
          ? [
              {
                categories: (doc as { categories?: unknown[] }).categories,
                id: typeof doc.id === 'string' ? doc.id : undefined,
                slug: doc.slug,
                updatedAt: doc.updatedAt ?? null,
              },
            ]
          : [],
      )
    } catch {
      out[locale] = []
    }
  }
  return out
}

