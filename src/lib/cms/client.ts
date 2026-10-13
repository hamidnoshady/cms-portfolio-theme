import 'server-only'

import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

import { cachedCmsRead, type CachedCmsResponse } from './cache'
import { fixtureRaw, fixturesEnabled } from './fixtures'
import type { SiteDescriptor } from './types'

/**
 * The server-only CMS client.
 *
 * ## Tenant identity
 * The theme never accepts a tenant from a visitor: the site is whatever
 * `ESHOBE_SITE_DOMAIN`/`ESHOBE_SITE_ID` the platform injected, and every read carries
 * `Authorization: Bearer $ESHOBE_API_KEY` (a `role: "site"` credential — the key *is*
 * the tenant, not a filter).
 *
 * ## Why there is no Host rewriting here
 * `docs/THEME_API.md` §3 is explicit that a deployed theme must use the key rather
 * than forge the customer's `Host`: behind the same proxy, rewriting `Host` sends the
 * request back into the theme's own container. There is a second, verified reason:
 * **Node's `fetch` ignores a `Host` header you set** (undici derives it from the URL),
 * so a Host-based read cannot be expressed with `fetch` at all. The direct API proxy
 * and opt-in local host-tenant development therefore use `requestWithHost()` — a
 * `node:http(s)` request that can set the header. Server-side content reads use it only
 * when `ESHOBE_ALLOW_HOST_TENANT=true`.
 */

export class CmsError extends Error {
  readonly status: number
  readonly path: string

  constructor(path: string, status: number, message: string) {
    // The API key is never interpolated into an error, log or thrown message.
    super(`CMS ${status} for ${path}: ${message}`)
    this.name = 'CmsError'
    this.path = path
    this.status = status
  }
}

export type QueryValue =
  | boolean
  | null
  | number
  | QueryValue[]
  | string
  | undefined
  | { [key: string]: QueryValue }

export type QueryParams = Record<string, QueryValue>

/** Payload's `where[slug][equals]=x` syntax, built without a query-string library. */
export const toQueryString = (params: QueryParams): string => {
  const parts: string[] = []
  const append = (key: string, value: QueryValue): void => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((entry, index) => append(`${key}[${index}]`, entry))
      return
    }
    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) append(`${key}[${childKey}]`, childValue)
      return
    }
    parts.push(`${key}=${encodeURIComponent(String(value))}`)
  }
  for (const [key, value] of Object.entries(params)) append(key, value)
  return parts.join('&')
}

export type CmsEnv = {
  apiKey: null | string
  allowHostTenant: boolean
  cmsUrl: null | string
  defaultLocale: null | string
  hasCms: boolean
  publicOrigin: null | string
  siteDomain: null | string
  siteId: null | string
  /** Stable tenant key for cache-tag partitioning; never a secret. */
  tenantKey: string
}

const first = (...values: (null | string | undefined)[]): null | string =>
  values.find((value) => typeof value === 'string' && value.length > 0) ?? null

export const cmsEnv = (): CmsEnv => {
  // Normalised once, here: every caller may then join paths without worrying about a
  // trailing slash (and the env value is never logged or exposed to the browser).
  const cmsUrl = first(process.env.ESHOBE_CMS_URL, process.env.ESHOBE_API_URL)?.replace(/\/+$/, '') ?? null
  const apiKey = first(process.env.ESHOBE_API_KEY, process.env.ESHOBE_SITE_API_KEY)
  const siteDomain = first(process.env.ESHOBE_SITE_DOMAIN)
  const siteId = first(process.env.ESHOBE_SITE_ID)
  const allowHostTenant =
    process.env.ESHOBE_ALLOW_HOST_TENANT === 'true' && Boolean(siteDomain) && !apiKey

  return {
    apiKey,
    allowHostTenant,
    cmsUrl,
    defaultLocale: first(process.env.ESHOBE_DEFAULT_LOCALE),
    hasCms: Boolean(cmsUrl),
    publicOrigin: first(process.env.ESHOBE_PUBLIC_ORIGIN),
    siteDomain,
    siteId,
    tenantKey: siteId ?? siteDomain ?? 'unbound',
  }
}

/** Cache tag for a tenant-scoped, locale-scoped CMS read. */
export const cmsTag = (env: CmsEnv, resource: string, locale?: null | string): string =>
  `cms:${env.tenantKey}:${resource}${locale ? `:${locale}` : ''}`

export type CmsFetchOptions = {
  /** Draft reads need the site key; they are never shared-cached. */
  draft?: boolean
  locale?: null | string
  params?: QueryParams
  revalidate?: number
  tags?: string[]
}

export type RawResponse = CachedCmsResponse

/**
 * The one locale policy for every CMS read.
 *
 * `options.locale` used to be advisory: only `params` reached the URL, so a call that
 * set the option but forgot the query (`getHeader`/`getFooter`) silently read the
 * default language — and cached it under a key that did not mention the locale, so
 * the English chrome showed Persian menus. A locale now always reaches the upstream
 * URL (and therefore the cache key, which is the complete path + query), and field
 * fallback is off unless a caller asks for it explicitly: a missing translation stays
 * missing instead of being filled with another language's values. A `locale` already
 * in `params` must agree with the option — a disagreement is a programming error, not
 * something to resolve by picking one.
 */
export const localizedCmsParams = (locale: null | string | undefined, params: QueryParams = {}): QueryParams => {
  if (!locale) return params
  if (params.locale !== undefined && params.locale !== locale) {
    throw new Error(`CMS read asked for locale "${locale}" with a conflicting locale param "${String(params.locale)}"`)
  }
  return { ...params, fallbackLocale: params.fallbackLocale ?? false, locale }
}

/**
 * Host-preserving native request. `node:http(s)` is the only reliable way to set Host:
 * server-side content reads use it only for opt-in, key-less local development, and
 * the direct public API proxy uses it only when no site key is configured. Callers
 * must never combine a site credential with a visitor-provided Host.
 */
export type BinaryResponse = { body: Buffer; headers: Headers; status: number }

/**
 * Added to every request this theme sends to the CMS. A request that *arrives*
 * carrying it has come back round through a proxy that routed it here instead of to
 * the CMS, and is refused at once (`proxy-recursion-refused`) instead of looping until
 * the upstream timeout.
 */
export const THEME_PROXY_MARKER = 'x-eshobe-theme-proxy'

/**
 * How a relayed visitor request names its site to the CMS.
 *
 * With a site key the key *is* the tenant: it goes in `Authorization`, and the
 * visitor's host travels only as `x-forwarded-host` (informational — the CMS does not
 * trust it). The request keeps the CMS's own `Host`, so a reverse proxy that routes by
 * Host (Traefik in front of `cms.eshobe.com`) sends it to the CMS rather than back to
 * this theme, and a preview hostname the CMS has never heard of still resolves.
 *
 * Without a key the visitor's host is the only tenant signal the CMS accepts, so it is
 * sent as `Host` (`host` below) — the key-less host-tenant mode. The browser's own
 * `Authorization` is never forwarded: these headers are built from scratch.
 */
export const relayIdentity = (
  env: Pick<CmsEnv, 'apiKey'>,
  visitorHost: null | string,
): { headers: Record<string, string>; host: null | string } => ({
  headers: {
    [THEME_PROXY_MARKER]: '1',
    ...(visitorHost ? { 'x-forwarded-host': visitorHost } : {}),
    ...(env.apiKey ? { authorization: `Bearer ${env.apiKey}` } : {}),
  },
  host: env.apiKey ? null : visitorHost,
})

/**
 * Options for the native request. `servername` is set explicitly: without it Node
 * derives TLS SNI from the `Host` header, so a visitor host override also became the
 * SNI, and a proxy that routes by SNI sent the request back to this theme.
 */
export const nativeRequestOptions = (
  url: string,
  host: null | string,
  init: { method?: string; headers?: Record<string, string> } = {},
) => {
  const target = new URL(url)
  const https = target.protocol === 'https:'
  return {
    headers: { accept: 'application/json', ...init.headers, ...(host ? { host } : {}) },
    hostname: target.hostname,
    method: init.method ?? 'GET',
    path: `${target.pathname}${target.search}`,
    port: target.port || (https ? 443 : 80),
    protocol: target.protocol,
    // RFC 6066 forbids an IP address as SNI (and Node warns on one).
    ...(https && !isIP(target.hostname) ? { servername: target.hostname } : {}),
    // CMS reads fail after a short bound so an older in-process value can keep
    // rendering instead of tying up a request during an upstream outage.
    timeout: 5000,
  }
}

/**
 * Bytes, not text. `/api/media/file/*` relays JPEG/PNG/WebP through this; decoding
 * those as UTF-8 replaces every invalid sequence with U+FFFD, so the browser receives
 * a "JPEG" it cannot decode and every CMS image on a direct deployment rendered as a
 * broken-image box.
 */
export const requestBinaryWithHost = async (
  url: string,
  host: null | string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<BinaryResponse> => {
  const target = new URL(url)
  const transport = target.protocol === 'https:' ? await import('node:https') : await import('node:http')

  return new Promise<BinaryResponse>((resolve, reject) => {
    const request = transport.request(nativeRequestOptions(url, host, init), (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () =>
        resolve({
          body: Buffer.concat(chunks),
          headers: new Headers(
            Object.entries(response.headers).flatMap(([key, value]) =>
              typeof value === 'string' ? [[key, value] as [string, string]] : [],
            ),
          ),
          status: response.statusCode ?? 500,
        }),
      )
    })
    request.on('timeout', () => request.destroy(new Error('CMS request timed out')))
    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })
}

/** JSON/text reads: the same request, decoded. Never use this for media bytes. */
export const requestWithHost = async (
  url: string,
  host: null | string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> => {
  const response = await requestBinaryWithHost(url, host, {
    ...init,
    headers: { ...init.headers, accept: 'application/json' },
  })
  return { ...response, body: response.body.toString('utf8') }
}

export const cmsFetchRaw = async (
  path: string,
  options: CmsFetchOptions = {},
  init: { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> => {
  const method = init.method ?? 'GET'
  const env = cmsEnv()
  const params = localizedCmsParams(options.locale, options.params)
  const query = toQueryString(params)
  const cachePath = `${path}${query ? `?${query}` : ''}`

  const load = async (): Promise<RawResponse> => {
    // Development fixtures come first so the whole theme can render without a CMS. The
    // guard lives inside `fixturesEnabled()` (never production, never implicit).
    if (method === 'GET' && fixturesEnabled()) {
      const fixture = await fixtureRaw(path, params)
      return { body: fixture.body, headers: new Headers({ 'content-type': 'application/json' }), status: fixture.status }
    }

    if (!env.cmsUrl) throw new CmsError(path, 503, 'ESHOBE_CMS_URL is not configured')

    const url = `${env.cmsUrl.replace(/\/$/, '')}${cachePath}`
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers, [THEME_PROXY_MARKER]: '1' }
    if (env.apiKey) headers.authorization = `Bearer ${env.apiKey}`

    if (env.allowHostTenant && env.siteDomain) {
      return requestWithHost(url, env.siteDomain, { body: init.body, headers, method })
    }

    const response = await fetch(url, {
      body: init.body,
      // `GET /api/site` with a site key is explicitly `private, no-store`. The
      // application cache below is tenant-partitioned and owns expiry/stale fallback;
      // do not let Next's shared data cache retain a credentialed response.
      cache: 'no-store',
      headers,
      method,
      signal: AbortSignal.timeout(5000),
    })

    return { body: await response.text(), headers: response.headers, status: response.status }
  }

  // Drafts and writes are never shared. All public reads (site/pages/posts/products/
  // categories and future documented endpoints) share the same bounded in-memory
  // cache, keyed by complete path/query and the trusted deployment tenant.
  if (method !== 'GET' || options.draft) return load()
  return cachedCmsRead({
    key: `cms:${env.cmsUrl ?? 'fixtures'}:${env.tenantKey}:${env.allowHostTenant ? env.siteDomain ?? '' : 'key'}:${cachePath}`,
    load,
    path,
    tags: options.tags,
  })
}

const parse = <T>(path: string, raw: RawResponse): T => {
  if (raw.status >= 400) {
    throw new CmsError(path, raw.status, raw.body.slice(0, 200) || 'no body')
  }
  try {
    return JSON.parse(raw.body) as T
  } catch {
    throw new CmsError(path, raw.status, 'response was not JSON')
  }
}

export const cmsFetch = async <T>(path: string, options: CmsFetchOptions = {}): Promise<T> =>
  parse<T>(path, await cmsFetchRaw(path, options))

/** `null` for a 404 (a missing optional document), every other failure still throws. */
export const cmsFetchOptional = async <T>(
  path: string,
  options: CmsFetchOptions = {},
): Promise<null | T> => {
  const raw = await cmsFetchRaw(path, options)
  if (raw.status === 404) return null
  return parse<T>(path, raw)
}

export const isLocaleServed = (site: Pick<SiteDescriptor, 'availableLocales'>, locale: string): boolean =>
  site.availableLocales.includes(locale as SiteDescriptor['availableLocales'][number])

/** Lifecycle gate: `suspended`/`archived` sites serve a holding page, never content. */
export const isSiteServing = (site: Pick<SiteDescriptor, 'status'>): boolean => site.status === 'active'

/** Stable, non-secret fingerprint used in cache tags and diagnostics. */
export const fingerprint = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12)
