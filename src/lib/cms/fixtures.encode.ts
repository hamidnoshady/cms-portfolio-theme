import {
  FIXTURE_CATEGORIES,
  FIXTURE_ORIGIN_FALLBACK,
  FIXTURE_FOOTER,
  FIXTURE_FORM,
  FIXTURE_HEADER,
  FIXTURE_PAGES,
  FIXTURE_POSTS,
  fixtureSite,
} from './fixtures.data'
import type { QueryParams } from './client'

/**
 * The fixture CMS itself: **no Next.js imports**, so the exact same encoder answers both
 * the in-app development provider (`fixtures.ts`) and the standalone mock CMS used for
 * production-build QA (`scripts/mock-cms.mjs`), which imports this file directly with
 * Node's type stripping.
 *
 * It implements the small subset of Payload query syntax this theme issues (`where`
 * with `and`/`or`, `equals`, `not_equals`, `in`, `not_in`, `exists`, `like`, plus
 * `limit`/`page`/`sort`), so the client's request shape is exercised too.
 */

export const fixturesEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' && process.env.ESHOBE_DEV_FIXTURES === '1'

const idOf = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return typeof id === 'string' ? id : null
  }
  return null
}

const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value.map(idOf).filter((id): id is string => Boolean(id)) : [])

type Doc = Record<string, unknown>

/**
 * Query values arrive as strings (`exists=false`), so booleans are parsed explicitly —
 * a naive truthiness check reads the *string* `"false"` as true and silently widens
 * every filter that uses it.
 */
const asBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1'

const matchesClause = (doc: Doc, clause: Doc): boolean =>
  Object.entries(clause).every(([field, condition]) => {
    if (field === 'and') return Array.isArray(condition) && condition.every((entry) => matchesClause(doc, entry as Doc))
    if (field === 'or') return Array.isArray(condition) && condition.some((entry) => matchesClause(doc, entry as Doc))
    if (!condition || typeof condition !== 'object') return false

    const operator = condition as Record<string, unknown>
    const value = doc[field]

    if ('equals' in operator) return value === operator.equals
    if ('not_equals' in operator) return value !== operator.not_equals
    if ('in' in operator) {
      const wanted = operator.in as unknown[]
      const present = Array.isArray(value) ? idsOf(value) : [idOf(value)]
      return present.some((entry) => entry !== null && wanted.some((candidate) => idOf(candidate) === entry || candidate === entry))
    }
    if ('not_in' in operator) {
      const unwanted = operator.not_in as unknown[]
      const present = Array.isArray(value) ? idsOf(value) : [idOf(value)]
      return !present.some((entry) => entry !== null && unwanted.some((candidate) => idOf(candidate) === entry || candidate === entry))
    }
    if ('exists' in operator) {
      const has = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''
      return asBoolean(operator.exists) ? has : !has
    }
    if ('like' in operator) {
      return String(value ?? '').toLowerCase().includes(String(operator.like).toLowerCase())
    }
    return false
  })

const paginate = <T extends Doc>(docs: T[], params: QueryParams): Record<string, unknown> => {
  const limit = Math.max(0, Number(params.limit ?? 10) || 10)
  const page = Math.max(1, Number(params.page ?? 1) || 1)
  const totalDocs = docs.length
  const totalPages = limit === 0 ? 1 : Math.max(1, Math.ceil(totalDocs / limit))
  const start = (page - 1) * limit
  const slice = docs.slice(start, start + limit)

  return {
    docs: slice,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    limit,
    nextPage: page < totalPages ? page + 1 : null,
    page,
    prevPage: page > 1 ? page - 1 : null,
    totalDocs,
    totalPages,
  }
}

const list = (docs: Doc[], params: QueryParams, sort?: (a: Doc, b: Doc) => number): Record<string, unknown> => {
  const where = (params.where ?? {}) as Doc
  const filtered = docs.filter((doc) => (Object.keys(where).length === 0 ? true : matchesClause(doc, where)))
  const sorted = sort ? [...filtered].sort(sort) : filtered
  return paginate(sorted, params)
}

const byPublished = (a: Doc, b: Doc): number =>
  String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? ''))

/** Simulates the documented REST responses for the paths this theme calls. */
export type FixtureMode = 'empty' | 'holding' | 'ok' | (string & {})

/**
 * Modes are composable: `--mode holding,nologo` renders a suspended site whose branding
 * has no logo at all. That lets one mock instance answer a whole QA scenario
 * (`docs/QA.md`) instead of needing a stack per edge case.
 */
const modeSet = (mode: FixtureMode): Set<string> =>
  new Set(
    String(mode ?? 'ok')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  )

/** Deliberately long, realistic labels used to prove no navigation row can overflow. */
const LONG_LABEL_SUFFIX = ' و بررسی‌های تکمیلی دفتر در مقیاس شهری'

const KEY_STRETCH_KEYS = new Set(['label', 'placeholder', 'title'])

/** Recursively lengthens the same fields a real tenant could put a long string in. */
const stretch = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stretch)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        KEY_STRETCH_KEYS.has(key) && typeof entry === 'string' ? `${entry}${LONG_LABEL_SUFFIX}` : stretch(entry),
      ]),
    )
  }
  return value
}

export const fixtureRaw = async (
  path: string,
  params: QueryParams = {},
  origin = FIXTURE_ORIGIN_FALLBACK,
  mode: FixtureMode = 'ok',
): Promise<{ body: string; status: number }> => {
  const modes = modeSet(mode)
  const has = (token: string) => modes.has(token)
  const respond = (payload: unknown, status = 200) => ({
    body: JSON.stringify(has('longlabels') ? stretch(payload) : payload),
    status,
  })

  // QA switches: simulate a slow CMS (to photograph real Suspense skeletons) and an
  // unreachable CMS (to photograph the error state). Development only, same guards.
  if (process.env.ESHOBE_FIXTURE_MODE === 'fail') return respond({ error: 'fixture-cms-unreachable' }, 503)
  const delay = Number(process.env.ESHOBE_FIXTURE_DELAY_MS ?? 0)
  if (Number.isFinite(delay) && delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

  if (path === '/api/site') {
    const site = fixtureSite(origin)
    // `holding` photographs the lifecycle gate: a suspended site must render the
    // noindex holding state with no portfolio content.
    // `nologo` photographs the honest fallback: with no logo the theme shows the
    // customer's own site-name wordmark, never an invented brand.
    const branding = has('nologo')
      ? { ...site.branding, compactLogo: null, favicon: null, homeLogo: null, primaryLogo: null }
      : site.branding
    return respond({ ...site, branding, ...(has('holding') ? { status: 'suspended' } : {}) })
  }
  if (has('empty') && (path === '/api/posts' || path === '/api/pages')) {
    return respond({ docs: [], hasNextPage: false, hasPrevPage: false, limit: 12, nextPage: null, page: 1, prevPage: null, totalDocs: 0, totalPages: 0 })
  }
  if (has('empty') && path === '/api/search') return respond({ docs: [] })
  if (path === '/api/header') return respond({ docs: [FIXTURE_HEADER] })
  if (path === '/api/footer') return respond({ docs: [FIXTURE_FOOTER] })

  if (path === '/api/pages') return respond(list(FIXTURE_PAGES as unknown as Doc[], params, (a, b) => String(a.slug).localeCompare(String(b.slug))))
  if (path.startsWith('/api/pages/')) {
    const id = decodeURIComponent(path.slice('/api/pages/'.length))
    const page = FIXTURE_PAGES.find((entry) => entry.id === id)
    return page ? respond(page) : respond({ error: 'not-found' }, 404)
  }

  if (path === '/api/posts') return respond(list(FIXTURE_POSTS as unknown as Doc[], params, byPublished))
  if (path.startsWith('/api/posts/')) {
    const id = decodeURIComponent(path.slice('/api/posts/'.length))
    const post = FIXTURE_POSTS.find((entry) => entry.id === id || entry.slug === id)
    return post ? respond(post) : respond({ error: 'not-found' }, 404)
  }

  if (path === '/api/categories') return respond({ docs: FIXTURE_CATEGORIES })

  if (path.startsWith('/api/forms/')) {
    const id = decodeURIComponent(path.slice('/api/forms/'.length))
    return id === FIXTURE_FORM.id ? respond(FIXTURE_FORM) : respond({ error: 'not-found' }, 404)
  }

  // Form submissions: the mock CMS accepts the documented shape and refuses an
  // incomplete one, so the theme's pending/success/failure states are all reachable.
  if (path === '/api/form-submissions') {
    const payload = params as unknown as { form?: unknown; submissionData?: unknown }
    if (!payload.form || !Array.isArray(payload.submissionData)) {
      return respond({ errors: [{ message: 'form and submissionData are required' }] }, 400)
    }
    return respond({ doc: { createdAt: new Date(0).toISOString(), form: payload.form, id: 'fixture-submission' }, message: 'submitted' }, 201)
  }

  if (path === '/api/search') {
    const where = (params.where ?? {}) as Doc
    const filtered = (FIXTURE_POSTS as unknown as Doc[]).filter((doc) => matchesClause(doc, where))
    return respond({
      docs: filtered.map((doc) => ({
        id: doc.id,
        meta: doc.meta,
        slug: doc.slug,
        title: doc.title,
      })),
    })
  }

  return respond({ error: 'fixture-path-not-implemented', path }, 404)
}
