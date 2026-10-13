import 'server-only'

/**
 * Small process-local cache for CMS reads.
 *
 * Eshobe's site-key response deliberately says `private, no-store`, so Next's data
 * cache and any shared HTTP cache must not retain it. This cache is only in the theme
 * process, is partitioned by the trusted tenant identity/Host in its key, and keeps a
 * last known-good response available while the CMS is briefly unavailable.
 */
export type CachedCmsResponse = {
  body: string
  headers: Headers
  status: number
}

type CacheEntry = CachedCmsResponse & {
  freshUntil: number
  key: string
  lastAccess: number
  path: string
  refreshing?: Promise<void>
  tags: Set<string>
}

export type CmsCachePurge = {
  paths?: unknown[]
  resources?: unknown[]
  tags?: unknown[]
}

const CACHE_TTL_MS = 3 * 60 * 1000
const MAX_ENTRIES = 512

type CacheStore = Map<string, CacheEntry>
type CacheGlobal = typeof globalThis & { __eshobeCmsReadCache?: CacheStore }

const cache = (): CacheStore => {
  const scope = globalThis as CacheGlobal
  scope.__eshobeCmsReadCache ??= new Map<string, CacheEntry>()
  return scope.__eshobeCmsReadCache
}

const clone = (entry: CachedCmsResponse): CachedCmsResponse => ({
  body: entry.body,
  headers: new Headers(entry.headers),
  status: entry.status,
})

const isSuccess = (response: CachedCmsResponse): boolean => response.status >= 200 && response.status < 300

const evictOldest = (store: CacheStore): void => {
  while (store.size >= MAX_ENTRIES) {
    let oldest: CacheEntry | undefined
    for (const entry of store.values()) {
      if (!oldest || entry.lastAccess < oldest.lastAccess) oldest = entry
    }
    if (!oldest) return
    store.delete(oldest.key)
  }
}

const put = (
  key: string,
  path: string,
  tags: readonly string[] | undefined,
  response: CachedCmsResponse,
): CacheEntry | undefined => {
  if (!isSuccess(response)) return undefined

  const store = cache()
  const existing = store.get(key)
  if (!existing) evictOldest(store)
  const now = Date.now()
  const entry: CacheEntry = {
    ...clone(response),
    freshUntil: now + CACHE_TTL_MS,
    key,
    lastAccess: now,
    path,
    tags: new Set([...(existing?.tags ?? []), ...(tags ?? [])]),
  }
  store.set(key, entry)
  return entry
}

/**
 * Read through a process-local cache. Expired values are intentionally served stale
 * immediately and refreshed in the background; that is what lets a rendering process
 * continue serving its last good page while a CMS request times out.
 */
export const cachedCmsRead = async ({
  key,
  load,
  path,
  tags,
}: {
  key: string
  load: () => Promise<CachedCmsResponse>
  path: string
  tags?: readonly string[]
}): Promise<CachedCmsResponse> => {
  const store = cache()
  const existing = store.get(key)
  const now = Date.now()

  if (existing) {
    existing.lastAccess = now
    if (existing.freshUntil > now) return clone(existing)

    if (!existing.refreshing) {
      // Never await this refresh. CMS webhook delivery waits only three seconds and a
      // rendering request must not inherit a CMS outage after it already has a value.
      existing.refreshing = (async () => {
        try {
          const refreshed = await load()
          put(key, path, tags, refreshed)
        } catch {
          // Keep the last good entry. A later request will start another background
          // attempt; no failed CMS response replaces usable content.
        } finally {
          const current = store.get(key)
          if (current) current.refreshing = undefined
        }
      })()
    }
    return clone(existing)
  }

  const response = await load()
  const entry = put(key, path, tags, response)
  return entry ? clone(entry) : response
}

const strings = (values: unknown[] | undefined): string[] =>
  (values ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0)

const resourceForPath = (path: string): string => {
  const segment = path.split('?')[0]?.split('/').filter(Boolean)[1] ?? ''
  if (segment === 'pages') return 'page'
  if (segment === 'posts') return 'post'
  if (segment === 'products') return 'product'
  if (segment === 'categories') return 'category'
  if (segment === 'header' || segment === 'footer') return 'navigation'
  if (segment === 'theme' || segment === 'store' || segment === 'site') return 'branding'
  return segment
}

const resourceName = (value: string): string => {
  const normalized = value.trim().toLowerCase()
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`
  return normalized.endsWith('s') ? normalized.slice(0, -1) : normalized
}

const semanticResources = (values: string[]): Set<string> => {
  const resources = new Set<string>()
  for (const value of values) {
    for (const part of value.split(/[:/]/u)) {
      const resource = resourceName(part)
      if (['page', 'post', 'product', 'category', 'navigation', 'branding', 'theme-setting', 'site'].includes(resource)) {
        resources.add(resource === 'theme-setting' || resource === 'site' ? 'branding' : resource)
      }
    }
  }
  return resources
}

/**
 * Purge local reads named by an Eshobe webhook. Render paths do not have a one-to-one
 * CMS URL (a page can read navigation, categories and several posts), so a render-path
 * notice conservatively clears the local CMS cache. Every accepted webhook also clears
 * `/api/site`: it contains theme, branding, locale and binding data used by all routes.
 */
export const purgeCmsReadCache = ({ paths, resources, tags }: CmsCachePurge = {}): number => {
  const store = cache()
  const requestedPaths = strings(paths)
  const requestedTags = new Set(strings(tags))
  const namedResources = semanticResources([...strings(resources), ...strings(tags)])
  const apiPaths = requestedPaths.filter((path) => path.startsWith('/api/'))
  const hasRenderPath = requestedPaths.some((path) => !path.startsWith('/api/'))
  const clearEverything = hasRenderPath || (requestedTags.size > 0 && namedResources.size === 0)
  let removed = 0

  for (const [key, entry] of store) {
    const path = entry.path.split('?')[0] ?? ''
    const directTagMatch = [...entry.tags].some((tag) => requestedTags.has(tag))
    const directPathMatch = apiPaths.some((requested) => path === requested || path.startsWith(`${requested}/`))
    const resourceMatch = namedResources.has(resourceForPath(path))
    const isSite = path === '/api/site'

    if (clearEverything || isSite || directTagMatch || directPathMatch || resourceMatch) {
      store.delete(key)
      removed += 1
    }
  }
  return removed
}

/** Test-only and process-shutdown hygiene; no route exposes this. */
export const clearCmsReadCache = (): void => cache().clear()
