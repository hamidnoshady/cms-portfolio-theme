import { NextResponse, type NextRequest } from 'next/server'

/**
 * Request-time routing facts that must be decided **before** the app streams.
 *
 * Why a proxy and not the page: with a `loading.tsx` boundary the app flushes an HTML
 * shell (200) before the page body resolves, and a `redirect()`/`notFound()` thrown
 * afterwards can no longer change the status code. Redirects and 404s are exactly the
 * cases where the status matters, so they are decided here, in front of the renderer:
 *
 *  - the CMS's reserved `/posts…` paths redirect (307) to this theme's `/blog…`;
 *  - `/home` redirects to `/`;
 *  - a locale prefix the deployment does not serve, or a generic page slug the CMS does
 *    not know, rewrites (status 404) to the theme's own 404 route — a real status with
 *    the designed page.
 *
 * Everything else is left alone and rendered by the app, which repeats the guards as a
 * second line of defence (`src/lib/cms/pageContext.ts`).
 *
 * Locale facts come from platform-injected env (`ESHOBE_LOCALES`,
 * `ESHOBE_DEFAULT_LOCALE`) rather than from a per-request CMS call, so the proxy stays
 * cheap. The page-existence probe runs only for single-segment paths that are not
 * theme sections, and never for preview.
 */

const KNOWN_LOCALES = ['fa', 'en']
const SECTIONS = new Set(['about', 'blog', 'contact', 'education', 'projects', 'posts', 'search'])
const NOT_FOUND_ROUTE = '/arch-not-found'

const servedLocales = (): string[] => {
  const raw = process.env.ESHOBE_LOCALES
  const parsed = (raw ? raw.split(',') : KNOWN_LOCALES).map((value) => value.trim()).filter(Boolean)
  return parsed.length > 0 ? parsed : KNOWN_LOCALES
}

const defaultLocale = (): string => {
  const value = process.env.ESHOBE_DEFAULT_LOCALE?.trim()
  return value && value.length > 0 ? value : 'fa'
}

/** `null` when the CMS cannot answer (then the app decides, not the proxy). */
const pageExists = async (slug: string, locale: string): Promise<boolean | null> => {
  // Development fixtures answer without a CMS (`ESHOBE_DEV_FIXTURES=1`, never in a
  // production build) so the fixture-driven QA run also exercises real 404 statuses.
  if (process.env.NODE_ENV !== 'production' && process.env.ESHOBE_DEV_FIXTURES === '1') {
    const { FIXTURE_PAGES } = await import('@/lib/cms/fixtures.data')
    return FIXTURE_PAGES.some((page) => page.slug === slug)
  }

  const cmsUrl = (process.env.ESHOBE_CMS_URL ?? process.env.ESHOBE_API_URL ?? '').replace(/\/+$/, '')
  if (!cmsUrl) return null

  const url = new URL(`${cmsUrl}/api/pages`)
  url.searchParams.set('fallbackLocale', 'false')
  url.searchParams.set('limit', '1')
  url.searchParams.set('locale', locale)
  url.searchParams.set('where[slug][equals]', slug)

  const apiKey = process.env.ESHOBE_API_KEY ?? process.env.ESHOBE_SITE_API_KEY
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { docs?: unknown[] }
    return (body.docs?.length ?? 0) > 0
  } catch {
    return null
  }
}

const withRouteHeaders = (request: NextRequest, locale: string, pathname: string): Headers => {
  const headers = new Headers(request.headers)
  headers.set('x-arch-locale', locale)
  headers.set('x-arch-pathname', pathname)
  return headers
}

const notFound = (request: NextRequest): NextResponse => {
  const url = request.nextUrl.clone()
  url.pathname = NOT_FOUND_ROUTE
  // A real 404 status with the theme's own designed page.
  return NextResponse.rewrite(url, { status: 404 })
}

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl
  const isPreview = Boolean(process.env.ESHOBE_PREVIEW_SECRET)
  const segments = pathname.split('/').filter(Boolean)
  const [first] = segments

  const locales = servedLocales()
  const prefix = first && KNOWN_LOCALES.includes(first) ? first : null
  const locale = prefix && locales.includes(prefix) ? prefix : defaultLocale()
  const rest = prefix ? segments.slice(1) : segments

  // A locale the deployment does not serve is a 404, never a silent fallback.
  if (prefix && !locales.includes(prefix)) return notFound(request)

  const routeHeaders = (): Headers => withRouteHeaders(request, locale, pathname)

  // The CMS reserves `/posts…`; this theme's canonical blog lives at `/blog…`.
  if (rest[0] === 'posts') {
    const url = request.nextUrl.clone()
    const target = rest.slice(1).join('/')
    url.pathname = `${prefix && prefix !== defaultLocale() ? `/${prefix}` : ''}/blog${target ? `/${target}` : ''}`
    return NextResponse.redirect(url, 307)
  }

  if (rest.length === 1 && rest[0] === 'home') {
    const url = request.nextUrl.clone()
    url.pathname = prefix && prefix !== defaultLocale() ? `/${prefix}` : '/'
    return NextResponse.redirect(url, 307)
  }

  // A single unknown segment is a CMS page: verify it exists so the response is a real
  // 404 rather than a soft 200. Multi-segment unknown paths are not pages at all.
  if (rest.length === 1 && rest[0] && !SECTIONS.has(rest[0]) && !isPreview) {
    const slug = decodeURIComponent(rest[0])
    const exists = await pageExists(slug, locale)
    if (exists === false) return notFound(request)
  } else if (rest.length > 1 && !SECTIONS.has(rest[0] ?? '')) {
    return notFound(request)
  }

  return NextResponse.next({ request: { headers: routeHeaders() } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|fonts/|favicon.ico|robots.txt|sitemap.xml|qa/).*)'],
}

export default proxy
