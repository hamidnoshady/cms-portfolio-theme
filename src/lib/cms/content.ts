import 'server-only'
import { cache } from 'react'
import { SECTIONS, categorySubtree, resolveSectionRef, type SectionKey, type SectionRef } from '@/lib/theme/sections'
import { href } from '@/lib/routing/locale'
import { detailPath, type PortfolioSection } from '@/lib/routing/paths'
import type { SiteContext } from './context'
import { getCategories, getPageById, getPageBySlug, getPostBySlug, getPosts, getPostsByIds } from './endpoints'
import type { CategoryDoc, FindResult, PageDoc, PostDoc } from './types'
import type { QueryParams } from './client'

export type PageSection = 'about' | 'careers' | 'contact' | 'home' | 'legal'
export type CategorySection = PortfolioSection

export type CategoryIndex = {
  all: CategoryDoc[]
  byId: Map<string, CategoryDoc>
  bySlug: Map<string, CategoryDoc>
  subtreeIds: (rootId: string) => string[]
  rootIdOf: (categoryId: string) => string
}

export const getCategoryIndex = cache(async (locale: string, draft: boolean): Promise<CategoryIndex> => {
  const all = await getCategories(locale as never, draft)
  const byId = new Map(all.map((c) => [String(c.id), c]))
  const bySlug = new Map(all.map((c) => [c.slug, c]))
  const parentIdOf = (c: CategoryDoc): null | string => {
    const p = c.parent
    if (!p) return null
    if (typeof p === 'string') return p
    return String(p.id)
  }
  return {
    all, byId, bySlug,
    rootIdOf: (id: string) => {
      let cur = byId.get(id)
      const seen = new Set<string>()
      while (cur) {
        const pid = parentIdOf(cur)
        if (!pid || seen.has(pid)) break
        seen.add(pid)
        const parent = byId.get(pid)
        if (!parent) return pid
        cur = parent
      }
      return cur ? String(cur.id) : id
    },
    subtreeIds: (rootId: string) => {
      const root = byId.get(rootId)
      if (!root) return [rootId]
      return [rootId, ...categorySubtree(root, all).map((c) => String(c.id))]
    },
  }
})

export const getSectionRef = (section: SectionKey, ctx: SiteContext): SectionRef =>
  resolveSectionRef(section, ctx.site.themeRuntime?.bindings)

export const getSectionPage = async (section: PageSection, ctx: SiteContext): Promise<{ page: null | PageDoc; ref: SectionRef }> => {
  const ref = getSectionRef(section, ctx)
  if (ref.by === 'binding') return { page: await getPageById(ref.id, ctx.locale, ctx.draft), ref }
  if (ref.by === 'slug') return { page: await getPageBySlug(ref.slug, ctx.locale, ctx.draft), ref }
  return { page: null, ref }
}

export type SectionCategory = { root: null | CategoryDoc; children: CategoryDoc[]; ref: SectionRef }

export const getSectionCategories = async (section: CategorySection, ctx: SiteContext): Promise<SectionCategory> => {
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const ref = getSectionRef(section, ctx)
  const root = ref.by === 'binding' ? (index.byId.get(ref.id) ?? null) : ref.by === 'slug' ? (index.bySlug.get(ref.slug) ?? null) : null
  return { children: root ? index.all.filter((c) => idOf(c.parent) === String(root.id)) : [], ref, root }
}

const idOf = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export type ArchiveOptions = { limit?: number; page?: number; section: CategorySection }

/** One query shape for both archives, stable ordering, bounded page size. */
export const getArchive = async (ctx: SiteContext, options: ArchiveOptions): Promise<FindResult<PostDoc>> => {
  const { section, page = 1, limit = 24 } = options
  const sectionData = await getSectionCategories(section, ctx)
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  let where: QueryParams = {}
  if (sectionData.root) {
    where = { categories: { in: index.subtreeIds(String(sectionData.root.id)) } }
  } else {
    return emptyPage(page, limit)
  }
  const result = await getPosts(ctx.locale, { limit, page, where }, ctx.draft)
  // Stable ordering: CMS sorts by -publishedAt; tie-break by slug so repeated
  // renders and both locales list the same deterministic sequence.
  const docs = [...result.docs].sort((a, b) => {
    const da = a.publishedAt ?? ''
    const db = b.publishedAt ?? ''
    if (da !== db) return db.localeCompare(da)
    return String(a.slug).localeCompare(String(b.slug))
  })
  return { ...result, docs }
}

const emptyPage = (page: number, limit: number): FindResult<PostDoc> => ({
  docs: [], hasNextPage: false, hasPrevPage: false, limit, nextPage: null, page, prevPage: null, totalDocs: 0, totalPages: 0,
})

/** Which portfolio section a post belongs to. Null = in neither (orphan). */
export const postSection = async (post: PostDoc, ctx: SiteContext): Promise<CategorySection | null> => {
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const ids = (post.categories ?? []).map((e) => idOf(e)).filter((id): id is string => Boolean(id))
  const roots = new Set(ids.map((id) => index.rootIdOf(id)))
  for (const section of ['projects', 'objects'] as const) {
    const data = await getSectionCategories(section, ctx)
    if (data.root && roots.has(String(data.root.id))) return section
  }
  return null
}

export const postHref = async (post: PostDoc, ctx: SiteContext): Promise<string> => {
  const section = await postSection(post, ctx)
  const s: CategorySection = section ?? 'projects'
  return detailPath(s, post.slug)
}

export const localizedPostHref = async (post: PostDoc, ctx: SiteContext): Promise<string> =>
  href(await postHref(post, ctx), ctx.locale, ctx.site)

export const getPostContext = async (slug: string, ctx: SiteContext): Promise<{
  post: PostDoc; section: CategorySection | null; related: PostDoc[]; siblings: CategoryDoc[]
} | null> => {
  const post = await getPostBySlug(slug, ctx.locale, ctx.draft)
  if (!post) return null
  const section = await postSection(post, ctx)
  const index = await getCategoryIndex(ctx.locale, ctx.draft)
  const relatedIds = (post.relatedPosts ?? []).map((e) => (typeof e === 'string' ? e : (e as { id: string }).id)).filter(Boolean) as string[]
  const related = relatedIds.length ? (await getPostsByIds(relatedIds, ctx.locale, ctx.draft)).slice(0, 3) : []
  const siblings = (post.categories ?? []).map((e) => idOf(e)).map((id) => (id ? index.byId.get(id) : undefined)).filter((c): c is CategoryDoc => Boolean(c))
  return { post, related, section, siblings }
}

export const sectionRootCategory = async (section: CategorySection, ctx: SiteContext): Promise<null | CategoryDoc> =>
  (await getSectionCategories(section, ctx)).root

export const SECTION_KEYS: SectionKey[] = ['home', 'about', 'contact', 'careers', 'legal', 'projects', 'objects']
export const SECTION_RULES = SECTIONS
