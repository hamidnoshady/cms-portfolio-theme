import 'server-only'

import { cache } from 'react'

import { cmsEnv, cmsFetch, cmsFetchOptional, cmsTag, toQueryString, type QueryParams } from './client'
import type {
  CategoryDoc,
  FindResult,
  FooterDoc,
  FormDoc,
  HeaderDoc,
  Locale,
  PageDoc,
  PostDoc,
  SiteDescriptor,
} from './types'

/**
 * Raw document reads. Nothing above this file builds a CMS URL, and nothing below it
 * decides which document a route shows — that is `content.ts` + the pure rules in
 * `src/lib/theme/sections.ts`.
 */

const listParams = (params: QueryParams = {}): QueryParams => ({
  limit: 1,
  // A configured site key can read drafts, so published-only is *our* filter, not the
  // server's. Anonymous reads are published-only anyway; this makes intent explicit and
  // keeps a preview build from leaking a draft into a shared cache.
  ...params,
})

export const publishedFilter = (draft: boolean): QueryParams =>
  draft ? {} : { _status: { equals: 'published' } }

/** `GET /api/site` — the one bootstrap call. Cached per request and across requests. */
export const getSite = cache(async (): Promise<SiteDescriptor> => {
  const env = cmsEnv()
  const site = await cmsFetch<SiteDescriptor>('/api/site', {
    revalidate: 30,
    tags: [cmsTag(env, 'site')],
  })
  return site
})

export const getSiteOrNull = async (): Promise<null | SiteDescriptor> => {
  try {
    return await getSite()
  } catch {
    // An unreachable CMS must not render a fabricated studio identity; callers decide
    // between the holding/error state and the "not connected" development shell.
    return null
  }
}

export const getHeader = async (locale: Locale, draft = false): Promise<null | HeaderDoc> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<HeaderDoc>>('/api/header', {
    draft,
    locale,
    params: { depth: 2, limit: 1 },
    tags: [cmsTag(env, 'header', locale)],
  })
  return result?.docs[0] ?? null
}

export const getFooter = async (locale: Locale, draft = false): Promise<null | FooterDoc> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<FooterDoc>>('/api/footer', {
    draft,
    locale,
    params: { depth: 2, limit: 1 },
    tags: [cmsTag(env, 'footer', locale)],
  })
  return result?.docs[0] ?? null
}

export const getPageBySlug = async (
  slug: string,
  locale: Locale,
  draft = false,
): Promise<null | PageDoc> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<PageDoc>>('/api/pages', {
    draft,
    locale,
    params: listParams({
      depth: 2,
      'fallbackLocale': false,
      locale,
      where: { and: [{ slug: { equals: slug } }, publishedFilter(draft)] },
    }),
    tags: [cmsTag(env, 'pages', locale)],
  })
  return result?.docs[0] ?? null
}

export const getPageById = async (
  id: string,
  locale: Locale,
  draft = false,
): Promise<null | PageDoc> => {
  const env = cmsEnv()
  const page = await cmsFetchOptional<PageDoc>(`/api/pages/${encodeURIComponent(id)}`, {
    draft,
    locale,
    params: { depth: 2, fallbackLocale: false, locale },
    tags: [cmsTag(env, 'pages', locale)],
  })
  if (!page) return null
  // A bound document that is not published yet is *missing* in public rendering; the
  // id lookup would otherwise return it because the site key can read drafts.
  if (!draft && page._status === 'draft') return null
  return page
}

/**
 * Authorised list read used by the sitemap: same shape as `getPosts`, but for the
 * `pages` collection. `select` keeps the payload small on large sites.
 */
export const getPages = async (
  locale: Locale,
  params: QueryParams = {},
  draft = false,
): Promise<FindResult<PageDoc>> => {
  const env = cmsEnv()
  const { where, ...rest } = params
  return cmsFetch<FindResult<PageDoc>>('/api/pages', {
    draft,
    locale,
    params: {
      depth: 0,
      fallbackLocale: false,
      locale,
      sort: 'slug',
      where: { and: [where ?? {}, publishedFilter(draft)] },
      ...rest,
    },
    tags: [cmsTag(env, 'pages', locale)],
  })
}

export const getPosts = async (
  locale: Locale,
  params: QueryParams = {},
  draft = false,
): Promise<FindResult<PostDoc>> => {
  const env = cmsEnv()
  const { where, ...rest } = params
  return cmsFetch<FindResult<PostDoc>>('/api/posts', {
    draft,
    locale,
    params: {
      depth: 1,
      fallbackLocale: false,
      locale,
      sort: '-publishedAt',
      where: { and: [where ?? {}, publishedFilter(draft)] },
      ...rest,
    },
    tags: [cmsTag(env, 'posts', locale)],
  })
}

export const getPostBySlug = async (
  slug: string,
  locale: Locale,
  draft = false,
): Promise<null | PostDoc> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<PostDoc>>('/api/posts', {
    draft,
    locale,
    params: listParams({
      depth: 2,
      fallbackLocale: false,
      locale,
      where: { and: [{ slug: { equals: slug } }, publishedFilter(draft)] },
    }),
    tags: [cmsTag(env, 'posts', locale)],
  })
  return result?.docs[0] ?? null
}

/**
 * Single post by id — what a **nav reference** carries (`relationTo: 'posts'`).
 *
 * A reference stores a document id, not a slug: passing that id to `getPostBySlug`
 * silently drops the menu item whenever the two differ, which is almost always.
 */
export const getPostById = async (
  id: string,
  locale: Locale,
  draft = false,
): Promise<null | PostDoc> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<PostDoc>>('/api/posts', {
    draft,
    locale,
    params: listParams({
      depth: 2,
      fallbackLocale: false,
      locale,
      where: { and: [{ id: { equals: id } }, publishedFilter(draft)] },
    }),
    tags: [cmsTag(env, 'posts', locale)],
  })
  const post = result?.docs[0] ?? null
  // Same rule as `getPageById`: a site key can read drafts, public rendering must not.
  if (!draft && post?._status === 'draft') return null
  return post
}

export const getPostsByIds = async (
  ids: string[],
  locale: Locale,
  draft = false,
): Promise<PostDoc[]> => {
  if (ids.length === 0) return []
  const env = cmsEnv()
  const result = await cmsFetch<FindResult<PostDoc>>('/api/posts', {
    draft,
    locale,
    params: {
      depth: 1,
      fallbackLocale: false,
      limit: ids.length,
      locale,
      where: { and: [{ id: { in: ids } }, publishedFilter(draft)] },
    },
    tags: [cmsTag(env, 'posts', locale)],
  })
  return result.docs
}

/** Every category for the site (`depth: 0`; the tree is rebuilt from `parent`). */
export const getCategories = async (locale: Locale, draft = false): Promise<CategoryDoc[]> => {
  const env = cmsEnv()
  const result = await cmsFetch<FindResult<CategoryDoc>>('/api/categories', {
    draft,
    locale,
    params: {
      depth: 1,
      fallbackLocale: false,
      limit: 200,
      locale,
      sort: 'title',
    },
    tags: [cmsTag(env, 'categories', locale)],
  })
  return result.docs
}

export const getFormById = async (id: string, locale: Locale, draft = false): Promise<null | FormDoc> => {
  const env = cmsEnv()
  const form = await cmsFetchOptional<FormDoc>(`/api/forms/${encodeURIComponent(id)}`, {
    draft,
    locale,
    params: { depth: 0, fallbackLocale: false, locale },
    tags: [cmsTag(env, 'forms', locale)],
  })
  return form
}

export type SearchHit = {
  id: string
  title: string
  slug: string
  doc?: { relationTo: string; value: string } | null
  meta?: { description?: null | string } | null
}

export const searchPosts = async (query: string, locale: Locale): Promise<SearchHit[]> => {
  const env = cmsEnv()
  const result = await cmsFetchOptional<FindResult<SearchHit>>('/api/search', {
    locale,
    params: {
      depth: 0,
      fallbackLocale: false,
      limit: 20,
      locale,
      // No `_status` filter here: the search index is a copy of *published* documents
      // (the CMS plugin does not sync drafts) and the index collection has no `_status`
      // field at all — querying it is a 400 QueryError, not an empty result. Tenant
      // scoping is the CMS's, per the headless contract.
      where: { and: [{ title: { like: query } }] },
    },
    tags: [cmsTag(env, 'search', locale)],
  })
  return result?.docs ?? []
}

export const cmsQueryPreview = (params: QueryParams): string => toQueryString(params)
