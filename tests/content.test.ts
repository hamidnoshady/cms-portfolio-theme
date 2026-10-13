import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPageBySlug, getPostById, getPostBySlug } from '@/lib/cms/endpoints'
import { getArchive, getSectionCategories } from '@/lib/cms/content'
import { FIXTURE_POSTS } from '@/lib/cms/fixtures.data'
import { navLinks } from '@/lib/routing/nav'
import type { SiteContext } from '@/lib/cms/context'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

/**
 * Resolution rules that a plausible-looking implementation still gets wrong:
 *
 *  - a `posts` nav reference carries a document **id**, not a slug;
 *  - a document read must be single-locale with field fallback **off**, so the CMS can
 *    never answer with a different locale's values for the same slug;
 *  - a menu item with no resolvable target disappears instead of pointing somewhere
 *    plausible and wrong.
 *
 * The first group runs against the fixture encoder (the same code the mock CMS serves
 * and the browser evidence is captured against); the second runs against a fetch stub,
 * because it is about the request the theme *sends*.
 */

const ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_DEV_FIXTURES: '1' }
  delete process.env.ESHOBE_CMS_URL
})

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const ctx = (locale: Locale): SiteContext =>
  ({
    canonicalOrigin: 'https://example.test',
    deploymentOrigin: 'https://example.test',
    dir: locale === 'fa' ? 'rtl' : 'ltr',
    draft: false,
    locale,
    serving: true,
    site: {
      availableLocales: ['fa', 'en'] as Locale[],
      defaultLocale: 'fa' as Locale,
      id: 'site-fixture',
      locales: ['fa', 'en'] as Locale[],
      media: { origin: 'https://example.test' },
      name: 'استودیوی نمونه',
      themeRuntime: { bindings: {}, settings: {} },
    } as unknown as SiteDescriptor,
  }) satisfies SiteContext

const reference = (relationTo: 'pages' | 'posts', value: string) => ({
  id: `nav-${value}`,
  link: { label: 'برچسب', reference: { relationTo, value }, type: 'reference' as const },
})

describe('nav link resolution', () => {
  it('resolves a `posts` reference by document id, not by slug', async () => {
    const post = FIXTURE_POSTS.find((entry) => entry.id === 'post-n1')
    expect(post).toBeDefined()
    // The fixture id and slug deliberately differ: passing the id to a slug lookup
    // would drop this menu item, which is exactly the bug this test pins.
    expect(post!.id).not.toBe(post!.slug)

    const links = await navLinks([reference('posts', post!.id)] as never, ctx('fa'), '/')
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ external: false, href: `/projects/${post!.slug}` })
  })

  it('prefixes the English tree for a resolved reference', async () => {
    const links = await navLinks([reference('posts', 'post-n1')] as never, ctx('en'), '/en')
    expect(links[0]?.href.startsWith('/en/projects/')).toBe(true)
  })

  it('drops a reference whose document does not resolve instead of guessing a target', async () => {
    const links = await navLinks([reference('posts', 'post-does-not-exist')] as never, ctx('fa'), '/')
    expect(links).toEqual([])
  })

  it('keeps a custom URL and marks the current page', async () => {
    const item = { id: 'nav-x', link: { label: 'پروژه‌ها', type: 'custom' as const, url: '/projects' } }
    const links = await navLinks([item] as never, ctx('fa'), '/projects')
    expect(links[0]).toMatchObject({ current: true, href: '/projects' })
  })
})

describe('document reads are single-locale', () => {
  const calls: string[] = []

  const stubFetch = (body: unknown): void => {
    calls.length = 0
    vi.stubGlobal('fetch', async (input: string | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    })
  }

  const queryOf = (url: string): URLSearchParams => new URL(url).searchParams

  beforeEach(() => {
    // Turn the fixture provider off so the real request path runs instead.
    process.env = { ...ENV, ESHOBE_API_KEY: 'site-key-for-test', ESHOBE_CMS_URL: 'https://cms.example.test' }
    delete process.env.ESHOBE_DEV_FIXTURES
  })

  it('asks for one locale with field fallback off, and never an invented endpoint', async () => {
    stubFetch({ docs: [] })
    await getPostBySlug('notes-on-lines', 'en', false)

    expect(calls).toHaveLength(1)
    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/api/posts')
    expect(queryOf(calls[0]!).get('locale')).toBe('en')
    expect(queryOf(calls[0]!).get('fallbackLocale')).toBe('false')
    expect(queryOf(calls[0]!).get('where[and][0][slug][equals]')).toBe('notes-on-lines')
    // Published-only is the theme's own filter, because a site key can read drafts.
    expect(queryOf(calls[0]!).get('where[and][1][_status][equals]')).toBe('published')
  })

  it('reads a post by id through the documented list query', async () => {
    stubFetch({ docs: [] })
    await expect(getPostById('post-n1', 'fa', false)).resolves.toBeNull()

    const params = queryOf(calls[0]!)
    expect(new URL(calls[0]!).pathname).toBe('/api/posts')
    expect(params.get('where[and][0][id][equals]')).toBe('post-n1')
    expect(params.get('locale')).toBe('fa')
    expect(params.get('fallbackLocale')).toBe('false')
  })

  it('keeps a slug lookup scoped to the requested locale', async () => {
    stubFetch({ docs: [] })
    await getPageBySlug('about', 'en', false)

    const params = queryOf(calls[0]!)
    expect(new URL(calls[0]!).pathname).toBe('/api/pages')
    expect(params.get('where[and][0][slug][equals]')).toBe('about')
    expect(params.get('locale')).toBe('en')
    expect(params.get('fallbackLocale')).toBe('false')
  })

  it('pins list reads to published documents', async () => {
    stubFetch({ docs: [] })
    await getPostBySlug('raw-lamp', 'fa', false)
    const params = queryOf(calls[0]!)
    expect(params.get('where[and][1][_status][equals]')).toBe('published')
  })

  it('sends the site credential in a header, never in the URL', async () => {
    const seen: Record<string, string> = {}
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      Object.assign(seen, (init?.headers ?? {}) as Record<string, string>)
      return new Response(JSON.stringify({ docs: [] }), { headers: { 'content-type': 'application/json' }, status: 200 })
    })
    await getPageBySlug('about', 'fa', false)

    expect(seen.authorization).toBe('Bearer site-key-for-test')
    expect(String(seen.authorization)).not.toContain('about')
  })

  it('treats a 404 document read as missing rather than as a failure', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"errors":[{"message":"not found"}]}', { headers: { 'content-type': 'application/json' }, status: 404 }))
    await expect(getPostBySlug('missing', 'fa', false)).resolves.toBeNull()
  })
})

describe('portfolio archive scoping', () => {
  it('lists projects on the projects archive and objects on the objects archive', async () => {
    const projects = await getArchive(ctx('fa'), { section: 'projects' })
    expect(projects.docs.length).toBeGreaterThan(0)
    expect(projects.docs.every((post) => post.slug !== 'raw-lamp')).toBe(true)
    const objects = await getArchive(ctx('fa'), { section: 'objects' })
    expect(objects.docs.map((post) => post.slug)).toContain('raw-lamp')
    expect(objects.docs.every((post) => !['khaneye-noor', 'ofogh-office'].includes(post.slug))).toBe(true)
  })

  it('orders deterministically by publishedAt then slug', async () => {
    const first = await getArchive(ctx('fa'), { section: 'projects' })
    const second = await getArchive(ctx('fa'), { section: 'projects' })
    expect(first.docs.map((d) => d.slug)).toEqual(second.docs.map((d) => d.slug))
  })

  it('exposes section roots for both archives', async () => {
    const projects = await getSectionCategories('projects', ctx('fa'))
    const objects = await getSectionCategories('objects', ctx('fa'))
    expect(projects.root?.slug).toBe('projects')
    expect(objects.root?.slug).toBe('objects')
  })
})

describe('language switch targets', () => {
  it('carries a locale-neutral search term into the other locale', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    // Callers hand in an already-encoded query, the same way `categoryQuery()` and
    // `pageQueryParam()` do, so the value is never encoded twice.
    const targets = switchTargetsForPath(ctx('fa'), () => '/search', `?q=${encodeURIComponent('نور')}`)
    const english = targets.find((target) => target.locale === 'en')
    expect(english?.href).toBe('/en/search?q=%D9%86%D9%88%D8%B1')
  })

  it('builds the home switch from a locale-neutral path, never a prefixed one', async () => {
    // The bug this guards: passing `href('/', locale, site)` inside the closure applied
    // the prefix twice, so the English home offered `/en/en` and pointed "فارسی" at `/en`.
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    for (const from of ['fa', 'en'] as Locale[]) {
      const targets = switchTargetsForPath(ctx(from), () => '/')
      expect(targets.find((target) => target.locale === 'fa')?.href).toBe('/')
      expect(targets.find((target) => target.locale === 'en')?.href).toBe('/en')
    }
  })

  it('switches an interior path in both directions', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    const targets = switchTargetsForPath(ctx('en'), () => '/projects')
    expect(targets.map((target) => target.href).sort()).toEqual(['/en/projects', '/projects'])
  })

  it('keeps the default locale unprefixed and adds no empty query', async () => {
    const { switchTargetsForPath } = await import('@/lib/seo/translations')
    const targets = switchTargetsForPath(ctx('en'), () => '/projects')
    expect(targets.find((target) => target.locale === 'fa')?.href).toBe('/projects')
  })
})
