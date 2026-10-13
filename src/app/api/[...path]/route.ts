import { NextResponse } from 'next/server'

import { cachedCmsRead } from '@/lib/cms/cache'
import { cmsEnv, relayIdentity, requestBinaryWithHost, requestWithHost, THEME_PROXY_MARKER } from '@/lib/cms/client'
import { readBoundedText } from '@/lib/http/body'
import { publicReadSearch } from '@/lib/cms/proxyPolicy'

export const dynamic = 'force-dynamic'

/**
 * CMS-owned public paths for direct/Coolify deployments. Customer DNS terminates at the
 * theme container, so these routes are relayed to the CMS. The site is named by the
 * site key when one is configured, else by the visitor's Host (`relayIdentity`).
 * Theme-owned `/api/health` and `/api/revalidate` have concrete
 * route handlers and therefore never reach this catch-all route.
 */
const ALLOWED_EXACT = new Set([
  'categories',
  'footer',
  'forms',
  'header',
  'media',
  'pages',
  'posts',
  'products',
  'redirects',
  'search',
  'site',
  'store',
  'theme',
])

const ALLOWED_PREFIXES = ['checkout', 'media/file', 'payments']
const FORWARDED_METHODS = new Set(['GET', 'HEAD', 'POST'])

/**
 * Writes are relayed only where the public contract has a visitor write: checkout and
 * payments. A POST to a content collection (`/api/pages`, `/api/posts` …) is Payload's
 * *create*; relayed with the site key it would be the key — not the visitor — asking.
 * Form submissions have their own bounded route (`/api/form-submissions`).
 */
const WRITE_PREFIXES = ['checkout', 'payments']
const MAX_WRITE_BYTES = 64 * 1024

const isWriteAllowed = (segments: string[]): boolean => {
  const joined = segments.join('/')
  return WRITE_PREFIXES.some((prefix) => joined === prefix || joined.startsWith(`${prefix}/`))
}

const isAllowed = (segments: string[]): boolean => {
  if (segments.length === 0) return false
  const joined = segments.join('/')
  if (ALLOWED_EXACT.has(joined)) return true
  return ALLOWED_PREFIXES.some((prefix) => joined === prefix || joined.startsWith(`${prefix}/`))
}

const RELAYED_HEADERS = ['cache-control', 'content-type', 'etag', 'last-modified', 'location', 'vary']
const MEDIA_HEADERS = [...RELAYED_HEADERS, 'accept-ranges', 'content-disposition', 'content-length']

const responseHeaders = (upstream: Headers, names: readonly string[] = RELAYED_HEADERS): Headers => {
  const headers = new Headers()
  for (const name of names) {
    const value = upstream.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('x-content-type-options', 'nosniff')
  return headers
}

const forward = async (request: Request, segments: string[]): Promise<Response> => {
  const env = cmsEnv()
  if (!env.cmsUrl) return NextResponse.json({ error: 'cms-unconfigured' }, { status: 503 })
  if (!FORWARDED_METHODS.has(request.method)) {
    return NextResponse.json({ error: 'method-not-allowed' }, { status: 405 })
  }
  if (!isAllowed(segments)) {
    return NextResponse.json({ error: 'path-not-proxied' }, { status: 403 })
  }
  if (request.method === 'POST' && !isWriteAllowed(segments)) {
    return NextResponse.json({ error: 'method-not-allowed' }, { headers: { allow: 'GET, HEAD' }, status: 405 })
  }

  const cms = new URL(env.cmsUrl)
  const incoming = new URL(request.url)
  // Our own marker on an incoming request means a proxy routed our CMS request back
  // here: fail now with a clear error instead of looping until the timeout.
  if (cms.host === incoming.host || request.headers.get(THEME_PROXY_MARKER)) {
    console.error(`[cms-proxy] recursion refused for /api/${segments.join('/')}: ESHOBE_CMS_URL routes back to this theme`)
    return NextResponse.json({ error: 'proxy-recursion-refused' }, { status: 508 })
  }

  const path = `/api/${segments.join('/')}`
  const target = new URL(`${cms.origin}${path}`)
  // Reads go out with the site key, so their query is the theme's to police; checkout
  // and payment writes keep the query their public contract defines.
  const search = request.method === 'POST' ? incoming.search : publicReadSearch(incoming.search, segments[0] ?? '')
  target.search = search
  const host = request.headers.get('host')
  const relay = relayIdentity(env, host)
  // Cache GET only: a HEAD response has no body and must never populate a later GET.
  const isRead = request.method === 'GET'
  let body: string | undefined
  if (request.method === 'POST') {
    const bounded = await readBoundedText(request, MAX_WRITE_BYTES)
    if (!bounded.ok) return NextResponse.json({ error: 'payload-too-large' }, { status: 413 })
    body = bounded.text
  }
  const requestHeaders = {
    accept: request.headers.get('accept') ?? 'application/json',
    ...(request.headers.get('content-type') ? { 'content-type': request.headers.get('content-type') as string } : {}),
    ...relay.headers,
  }

  /** Upstream errors keep their status (403/404 …); only a network failure is a 503. */
  const logStatus = (status: number) => {
    if (status >= 400) console.warn(`[cms-proxy] CMS answered ${status} for ${request.method} ${path}`)
  }
  const unavailable = (error: unknown) => {
    console.error(`[cms-proxy] CMS unreachable for ${request.method} ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }

  /**
   * Media files are bytes: relayed as a Buffer and never put in the process-local read
   * cache, which stores text (and 512 photographs would be the whole heap). The CMS's
   * own `cache-control`/`etag` reach the browser, which is the cache that matters.
   */
  if (segments[0] === 'media' && segments[1] === 'file') {
    try {
      const mediaHeaders = {
        accept: request.headers.get('accept') ?? '*/*',
        ...(request.headers.get('if-none-match') ? { 'if-none-match': request.headers.get('if-none-match') as string } : {}),
        ...(request.headers.get('if-modified-since')
          ? { 'if-modified-since': request.headers.get('if-modified-since') as string }
          : {}),
        ...relay.headers,
      }
      const upstream = relay.host
        ? await requestBinaryWithHost(target.toString(), relay.host, { headers: mediaHeaders, method: request.method })
        : await fetch(target, {
            cache: 'no-store',
            headers: mediaHeaders,
            method: request.method,
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
          }).then(async (response) => ({
            body: Buffer.from(await response.arrayBuffer()),
            headers: response.headers,
            status: response.status,
          }))
      logStatus(upstream.status)
      const bytes = request.method === 'HEAD' || upstream.status === 304 ? null : new Uint8Array(upstream.body)
      return new NextResponse(bytes, { headers: responseHeaders(upstream.headers, MEDIA_HEADERS), status: upstream.status })
    } catch (error) {
      unavailable(error)
      return NextResponse.json({ error: 'cms-unavailable' }, { status: 503 })
    }
  }

  const load = async () => {
    try {
      // Undici deliberately derives Host from the URL and ignores a `fetch` Host
      // header. Use node:http(s) for the key-less mode, where the visitor's Host is the
      // tenant authority the CMS reads.
      if (relay.host) {
        const upstream = await requestWithHost(target.toString(), relay.host, {
          body,
          headers: requestHeaders,
          method: request.method,
        })
        logStatus(upstream.status)
        return { body: upstream.body, headers: responseHeaders(upstream.headers), status: upstream.status }
      }

      const upstream = await fetch(target, {
        body,
        cache: 'no-store',
        headers: requestHeaders,
        method: request.method,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
      logStatus(upstream.status)
      return { body: await upstream.text(), headers: responseHeaders(upstream.headers), status: upstream.status }
    } catch (error) {
      unavailable(error)
      return {
        body: JSON.stringify({ error: 'cms-unavailable' }),
        headers: new Headers({ 'content-type': 'application/json' }),
        status: 503,
      }
    }
  }

  const upstream = isRead
    ? await cachedCmsRead({
        key: `proxy:${cms.origin}:${host ?? 'no-host'}:${path}${search}`,
        load,
        path,
        tags: [`proxy:${host ?? 'no-host'}:${segments[0] ?? 'api'}`],
      })
    : await load()

  return new NextResponse(request.method === 'HEAD' ? null : upstream.body, {
    headers: upstream.headers,
    status: upstream.status,
  })
}

type Context = { params: Promise<{ path?: string[] }> }

export const GET = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}

export const HEAD = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const { path = [] } = await context.params
  return forward(request, path)
}
