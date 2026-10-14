import { renderToReadableStream } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SiteContext } from '@/lib/cms/context'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

/**
 * Persian ⇄ English regressions from the bilingual audit (6 October 2026):
 *
 *  - English menus showed Persian labels: `getHeader`/`getFooter` set `options.locale`
 *    but the locale never reached the upstream URL or the cache key;
 *  - the Services language switch led to `/en/en/services` (a 404): the path was
 *    prefixed twice, and the current locale's slug was reused for the other locale;
 *  - CTA buttons pointing at documents rendered `href="#"`;
 *  - English archive blocks linked into the Persian tree;
 *  - every rich-text field restarted its heading anchors at `section-1`;
 *  - 24 image triggers all had the same accessible name.
 *
 * Two kinds of test: requests the theme *sends* (fetch stub, real query serialisation)
 * and markup it *renders* (React's server renderer over the fixture CMS).
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  draftMode: async () => ({ isEnabled: false }),
  headers: async () => new Headers({ host: 'example.test', 'x-forwarded-proto': 'https' }),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
  usePathname: () => '/',
}))

const ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const ctx = (locale: Locale, bindings: Record<string, unknown> = {}): SiteContext =>
  ({
    canonicalOrigin: 'https://example.test',
    deploymentOrigin: 'https://example.test',
    dir: locale === 'fa' ? 'rtl' : 'ltr',
    draft: false,
    locale,
    serving: true,
    site: {
      availableLocales: ['fa', 'en'] as Locale[],
      blocks: ['archive', 'content', 'cta', 'gallery'],
      defaultLocale: 'fa' as Locale,
      id: 'site-fixture',
      locales: ['fa', 'en'] as Locale[],
      media: { origin: 'https://example.test' },
      name: 'arch',
      themeRuntime: { bindings, settings: {} },
    } as unknown as SiteDescriptor,
  }) satisfies SiteContext

const html = async (element: React.ReactElement): Promise<string> => {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return new Response(stream).text()
}

/** A unique CMS origin per test: the read cache is process-global and keyed by it. */
let cmsCounter = 0
const liveCms = (): string => {
  cmsCounter += 1
  const origin = `https://cms-${cmsCounter}.example.test`
  process.env = { ...ENV, ESHOBE_API_KEY: 'site-key-for-test', ESHOBE_CMS_URL: origin }
  delete process.env.ESHOBE_DEV_FIXTURES
  return origin
}

const fixtures = (): void => {
  process.env = { ...ENV, ESHOBE_DEV_FIXTURES: '1', ESHOBE_PUBLIC_ORIGIN: 'https://example.test' }
  delete process.env.ESHOBE_CMS_URL
}

describe('localized CMS reads', () => {
  const calls: URL[] = []

  /** Answers like the CMS: the menu label follows the `locale` query parameter. */
  const stubLocalizedHeader = (): void => {
    calls.length = 0
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = new URL(String(input))
      calls.push(url)
      const locale = url.searchParams.get('locale')
      const label = locale === 'en' ? 'Projects' : locale === 'fa' ? 'پروژه‌ها' : 'NO-LOCALE'
      return new Response(
        JSON.stringify({ docs: [{ id: 'header-1', navItems: [{ link: { label, type: 'custom', url: '/projects' } }] }] }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      )
    })
  }

  it('sends the locale and fallbackLocale=false for the header and footer', async () => {
    const cms = liveCms()
    stubLocalizedHeader()
    const { getFooter, getHeader } = await import('@/lib/cms/endpoints')
    await getHeader('en')
    await getFooter('en')

    expect(calls.map((url) => `${url.origin}${url.pathname}`)).toEqual([`${cms}/api/header`, `${cms}/api/footer`])
    for (const url of calls) {
      expect(url.searchParams.get('locale')).toBe('en')
      expect(url.searchParams.get('fallbackLocale')).toBe('false')
    }
  })

  it('keeps Persian and English menus apart in the shared read cache', async () => {
    liveCms()
    stubLocalizedHeader()
    const { getHeader } = await import('@/lib/cms/endpoints')
    const fa = await getHeader('fa')
    const en = await getHeader('en')
    const faAgain = await getHeader('fa')

    expect(fa?.navItems?.[0]?.link?.label).toBe('پروژه‌ها')
    expect(en?.navItems?.[0]?.link?.label).toBe('Projects')
    expect(faAgain?.navItems?.[0]?.link?.label).toBe('پروژه‌ها')
    // Two distinct upstream reads, then a cache hit for the repeated Persian one.
    expect(calls).toHaveLength(2)
  })

  it('puts the English navigation labels into the English chrome', async () => {
    liveCms()
    stubLocalizedHeader()
    const { getHeader } = await import('@/lib/cms/endpoints')
    const { navLinks } = await import('@/lib/routing/nav')
    const header = await getHeader('en')
    const links = await navLinks(header?.navItems, ctx('en'), '/projects')
    expect(links).toEqual([{ current: true, external: false, href: '/en/projects', label: 'Projects', newTab: false }])
  })

  it('refuses a read whose locale param disagrees with its locale option', async () => {
    const { localizedCmsParams } = await import('@/lib/cms/client')
    expect(() => localizedCmsParams('en', { locale: 'fa' })).toThrow(/conflicting locale/u)
    expect(localizedCmsParams('en', { depth: 1 })).toEqual({ depth: 1, fallbackLocale: false, locale: 'en' })
    expect(localizedCmsParams(undefined, { depth: 1 })).toEqual({ depth: 1 })
  })
})

describe('language switch for documents with localized slugs', () => {
  /** A page whose slug differs per locale, like Services (`khadamat` / `services`). */
  const stubPage = (byLocale: Record<string, null | { _status?: string; slug: string; title: string }>): void => {
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = new URL(String(input))
      const doc = byLocale[url.searchParams.get('locale') ?? '']
      if (doc === undefined) return new Response('{}', { status: 404 })
      return new Response(JSON.stringify({ id: 'pg-services', ...(doc ?? { slug: 'services', title: '' }) }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    })
  }

  it('links to the destination locale’s own slug with exactly one prefix', async () => {
    liveCms()
    stubPage({ en: { slug: 'services', title: 'Services' }, fa: { slug: 'khadamat', title: 'خدمات' } })
    const { pagePath } = await import('@/lib/runtime')
    const { switchTargets } = await import('@/lib/seo/translations')

    const fromPersian = await switchTargets(ctx('fa'), { id: 'pg-services', kind: 'page', pathFor: pagePath })
    expect(fromPersian.find((target) => target.locale === 'en')?.href).toBe('/en/services')

    const fromEnglish = await switchTargets(ctx('en'), { id: 'pg-services', kind: 'page', pathFor: pagePath })
    expect(fromEnglish.find((target) => target.locale === 'fa')?.href).toBe('/khadamat')
    for (const target of [...fromPersian, ...fromEnglish]) expect(target.href ?? '').not.toMatch(/^\/en\/en(\/|$)/u)
  })

  it('reports an untranslated or unpublished translation as unavailable instead of guessing', async () => {
    liveCms()
    stubPage({ en: null, fa: { slug: 'khadamat', title: 'خدمات' } })
    const { pagePath } = await import('@/lib/runtime')
    const { switchTargets } = await import('@/lib/seo/translations')
    const targets = await switchTargets(ctx('fa'), { id: 'pg-services', kind: 'page', pathFor: pagePath })
    expect(targets.find((target) => target.locale === 'en')?.href).toBeNull()

    liveCms()
    stubPage({ en: { _status: 'draft', slug: 'services', title: 'Services' }, fa: { slug: 'khadamat', title: 'خدمات' } })
    const drafts = await switchTargets(ctx('fa'), { id: 'pg-services', kind: 'page', pathFor: pagePath })
    expect(drafts.find((target) => target.locale === 'en')?.href).toBeNull()
  })

  it('builds hreflang alternates from each locale’s slug', async () => {
    liveCms()
    stubPage({ en: { slug: 'services', title: 'Services' }, fa: { slug: 'khadamat', title: 'خدمات' } })
    const { pagePath } = await import('@/lib/runtime')
    const { documentLanguages } = await import('@/lib/seo/translations')
    await expect(documentLanguages(ctx('en'), { id: 'pg-services', kind: 'page', pathFor: pagePath })).resolves.toEqual({
      en: 'https://example.test/en/services',
      'fa-IR': 'https://example.test/khadamat',
    })
  })
})

describe('one safe link resolver', () => {
  beforeEach(fixtures)

  it('validates custom URLs and places local paths in the current locale once', async () => {
    const { safeCustomUrl } = await import('@/lib/routing/safeUrl')
    const site = { defaultLocale: 'fa' }
    expect(safeCustomUrl('/projects', 'en', site)).toEqual({ external: false, href: '/en/projects' })
    expect(safeCustomUrl('projects?category=a#top', 'en', site)).toEqual({ external: false, href: '/en/projects?category=a#top' })
    expect(safeCustomUrl('/en/projects', 'en', site)).toEqual({ external: false, href: '/en/projects' })
    expect(safeCustomUrl('/projects', 'fa', site)).toEqual({ external: false, href: '/projects' })
    expect(safeCustomUrl('#team', 'en', site)).toEqual({ external: false, href: '#team' })
    expect(safeCustomUrl('https://example.org/a', 'fa', site)).toEqual({ external: true, href: 'https://example.org/a' })
    expect(safeCustomUrl('mailto:studio@example.org', 'fa', site)?.external).toBe(true)
    for (const unsafe of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '', '#', '  ', 'https://', '/\\evil.example']) {
      expect(safeCustomUrl(unsafe, 'fa', site)).toBeNull()
    }
  })

  it('resolves page and post references, bound section pages and missing targets', async () => {
    const { resolveCmsLink } = await import('@/lib/routing/links')
    const bound = { about: { id: 'pg-about', slug: 'about-us', title: null } }
    const reference = (relationTo: 'pages' | 'posts', value: unknown) => ({ reference: { relationTo, value }, type: 'reference' })

    await expect(resolveCmsLink(reference('pages', 'pg-about'), ctx('en', bound))).resolves.toMatchObject({ href: '/en/about' })
    // Populated (depth ≥ 1) and id-only references resolve alike.
    await expect(resolveCmsLink(reference('pages', { id: 'pg-services', slug: 'stale' }), ctx('en'))).resolves.toMatchObject({
      href: '/en/services',
    })
    await expect(resolveCmsLink(reference('posts', 'post-p7'), ctx('en'))).resolves.toMatchObject({ href: '/en/projects/villa-398' })
    await expect(resolveCmsLink(reference('pages', 'pg-missing'), ctx('en'))).resolves.toBeNull()
    await expect(resolveCmsLink({ newTab: true, type: 'custom', url: 'https://example.org' }, ctx('fa'))).resolves.toEqual({
      external: true,
      href: 'https://example.org',
      newTab: true,
    })
    await expect(resolveCmsLink({ type: 'custom', url: 'javascript:alert(1)' }, ctx('fa'))).resolves.toBeNull()
  })
})

describe('blocks', () => {
  beforeEach(fixtures)

  const cta = (link: Record<string, unknown>, id = 'cta-row') => ({
    blockType: 'cta',
    id,
    links: [{ link: { label: 'Our services', ...link } }],
    richText: { root: { children: [], direction: 'ltr' } },
  })

  it('renders a CTA reference as a link to the document, never `#`', async () => {
    const { Blocks } = await import('@/components/blocks/Blocks')
    const markup = await html(
      <Blocks blocks={[cta({ reference: { relationTo: 'pages', value: 'pg-services' }, type: 'reference' })] as never} context={ctx('en')} />,
    )
    expect(markup).toContain('href="/en/services"')
    expect(markup).not.toContain('href="#"')
  })

  it('leaves out a CTA whose target does not resolve rather than linking nowhere', async () => {
    const { Blocks } = await import('@/components/blocks/Blocks')
    const markup = await html(
      <Blocks
        blocks={[cta({ reference: { relationTo: 'pages', value: 'pg-missing' }, type: 'reference' }), cta({ type: 'custom', url: 'javascript:alert(1)' }, 'cta-2')] as never}
        context={ctx('en')}
      />,
    )
    expect(markup).not.toContain('Our services')
    expect(markup).not.toContain('href="#"')
    expect(markup).not.toContain('javascript:')
  })

  it('keeps English archive links in the English tree', async () => {
    const { Blocks } = await import('@/components/blocks/Blocks')
    const archive = { blockType: 'archive', id: 'archive-row', limit: 24, populateBy: 'collection' }
    const english = await html(<Blocks blocks={[archive] as never} context={ctx('en')} />)
    const hrefs = [...english.matchAll(/href="([^"]+)"/gu)].map((match) => match[1]!)
    expect(hrefs.length).toBeGreaterThan(0)
    for (const target of hrefs) expect(target).toMatch(/^\/en\/(projects|objects)\//u)

    const persian = await html(<Blocks blocks={[archive] as never} context={ctx('fa')} />)
    for (const [, target] of persian.matchAll(/href="([^"]+)"/gu)) expect(target).toMatch(/^\/(projects|objects)\//u)
  })

  it('gives every heading on the page a unique anchor id', async () => {
    const { Blocks } = await import('@/components/blocks/Blocks')
    const heading = (value: string) => ({ children: [{ text: value, type: 'text', version: 1 }], tag: 'h2', type: 'heading', version: 1 })
    const column = (title: string) => ({ richText: { root: { children: [heading(title)], direction: 'ltr' } }, size: 'half' })
    const markup = await html(
      <Blocks
        blocks={[
          { blockType: 'content', columns: [column('Approach'), column('Approach')], id: 'row-a' },
          { blockType: 'content', columns: [column('Process')], id: 'row-b' },
          // No row id: the field's content hash still keeps it apart.
          { blockType: 'content', columns: [column('Studio')] },
        ] as never}
        context={ctx('en')}
      />,
    )
    const ids = [...markup.matchAll(/ id="([^"]+)"/gu)].map((match) => match[1]!)
    expect(ids.length).toBe(4)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('section-row-a-c0-1')
    expect(ids).toContain('section-row-a-c1-1')
  })

  it('names images without a description distinctly, in the visitor’s digits', async () => {
    const { Blocks } = await import('@/components/blocks/Blocks')
    const image = (id: string) => ({ height: 800, id, mimeType: 'image/jpeg', url: `/qa/media/${id}.jpg`, width: 1200 })
    const gallery = { blockType: 'gallery', id: 'gallery-row', images: [image('a'), image('b'), { ...image('c'), alt: 'Lobby at dusk' }] }

    const persian = await html(<Blocks blocks={[gallery] as never} context={ctx('fa')} />)
    const names = [...persian.matchAll(/aria-label="([^"]+)"/gu)].map((match) => match[1]!)
    expect(names).toEqual(expect.arrayContaining(['تصویر ۱ از ۳', 'تصویر ۲ از ۳', 'Lobby at dusk']))

    const english = await html(<Blocks blocks={[gallery] as never} context={ctx('en')} />)
    expect(english).toContain('aria-label="Photograph 1 of 3"')
    expect(english).toContain('aria-label="Photograph 2 of 3"')
  })
})

describe('rich text anchors and links', () => {
  beforeEach(fixtures)

  it('scopes anchors per field and keeps the primary narrative on `section-n`', async () => {
    const { contentOutline } = await import('@/lib/utils/lexical')
    const content = { root: { children: [{ children: [{ text: 'A', type: 'text' }], tag: 'h2', type: 'heading' }] } }
    expect(contentOutline(content as never).map((item) => item.id)).toEqual(['section-1'])
    expect(contentOutline(content as never, 'hero').map((item) => item.id)).toEqual(['section-hero-1'])
  })

  it('resolves a rich-text document link and renders an unresolved one as plain text', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const link = (fields: Record<string, unknown>, label: string) => ({
      children: [{ text: label, type: 'text', version: 1 }],
      fields,
      type: 'link',
      version: 1,
    })
    const content = {
      root: {
        children: [
          {
            children: [
              link({ doc: { relationTo: 'posts', value: { id: 'post-p7' } }, linkType: 'internal' }, 'Villa'),
              link({ doc: { relationTo: 'pages', value: 'pg-missing' }, linkType: 'internal' }, 'Gone'),
              link({ linkType: 'custom', url: 'javascript:alert(1)' }, 'Bad'),
            ],
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr' as const,
      },
    }
    const markup = await html(<RichText content={content} context={ctx('en')} fallbackDir="ltr" />)
    expect(markup).toContain('href="/en/projects/villa-398"')
    expect(markup).toContain('Gone')
    expect(markup).toContain('Bad')
    expect(markup).not.toContain('href="#"')
    expect(markup).not.toContain('javascript:')
  })
})

describe('contact readiness', () => {
  it('distinguishes a missing configuration from an unavailable form', async () => {
    const { contactFormReadiness } = await import('@/views/ContactView')
    expect(contactFormReadiness({ form: null, formId: null })).toEqual({ form: 'form-unconfigured' })
    expect(contactFormReadiness({ form: null, formId: 'form-1' })).toEqual({ form: 'form-unavailable' })
    expect(contactFormReadiness({ form: { id: 'form-1' }, formId: 'form-1' })).toEqual({ form: 'form-ready' })
  })
})

describe('brand name', () => {
  it('uses the configured display name, not the internal site name', async () => {
    const { brandName } = await import('@/lib/theme/brand')
    expect(brandName({ branding: { displayName: 'Studio Eshobe' } as never, name: 'arch' })).toBe('Studio Eshobe')
    expect(brandName({ branding: { displayName: '  ' } as never, name: 'arch' })).toBe('arch')
    expect(brandName({ branding: null as never, name: 'arch' })).toBe('arch')
  })
})

describe('case study close href, localized facts, and block heading deduplication', () => {
  it('localizes the case study Close link for both fa and en in projects and objects', async () => {
    const { closeHrefForCaseStudy } = await import('@/views/CaseStudyView')
    expect(closeHrefForCaseStudy('projects', 'fa', { defaultLocale: 'fa' })).toBe('/projects')
    expect(closeHrefForCaseStudy('projects', 'en', { defaultLocale: 'fa' })).toBe('/en/projects')
    expect(closeHrefForCaseStudy('objects', 'fa', { defaultLocale: 'fa' })).toBe('/objects')
    expect(closeHrefForCaseStudy('objects', 'en', { defaultLocale: 'fa' })).toBe('/en/objects')
  })

  it('localizes canonical fact labels and deduplicates repeated additionalFacts', async () => {
    const { buildCaseStudyFacts } = await import('@/views/CaseStudyView')
    const { toCaseStudy } = await import('@/domain/portfolio')
    const post = {
      heroImage: null,
      id: 'p1',
      projectMetadata: {
        additionalFacts: [
          { label: 'Location', value: 'Dup Location' },
          { label: 'مکان', value: 'تهران تکراری' },
          { label: 'Year', value: '2024' },
          { label: 'سازه', value: 'بتن نمایان' },
        ],
        area: '۴۵۰ متر مربع',
        client: 'کارفرمای نمونه',
        date: '2024-05-01',
        location: 'تهران',
        status: 'ساخته‌شده',
      },
      slug: 'sample',
      title: 'نمونه',
    }
    const cs = toCaseStudy(post as never)
    const faFacts = buildCaseStudyFacts(cs, post.projectMetadata, 'fa')
    expect(faFacts).toEqual([
      { label: 'مکان', value: 'تهران' },
      { label: 'وضعیت', value: 'ساخته‌شده' },
      { label: 'مساحت', value: '۴۵۰ متر مربع' },
      { label: 'همکاران', value: 'کارفرمای نمونه' },
      { label: 'تاریخ', value: '۲۰۲۴' },
      { label: 'سازه', value: 'بتن نمایان' },
    ])

    const enFacts = buildCaseStudyFacts(cs, post.projectMetadata, 'en')
    expect(enFacts[0]).toEqual({ label: 'Location', value: 'تهران' })
    expect(enFacts[1]).toEqual({ label: 'Status', value: 'ساخته‌شده' })
  })

  it('suppresses duplicate first-block heading matching the page h1 title', async () => {
    const { isDuplicatePageHeading } = await import('@/components/blocks/Blocks')
    expect(isDuplicatePageHeading('تماس — نمونه', 'تماس')).toBe(true)
    expect(isDuplicatePageHeading('Services (Sample)', 'Services')).toBe(true)
    expect(isDuplicatePageHeading('Different Heading', 'Services')).toBe(false)
  })

  it('parses archive page query parameter safely', async () => {
    const { parseArchivePage } = await import('@/views/PortfolioArchiveView')
    expect(parseArchivePage(undefined)).toBe(1)
    expect(parseArchivePage('2')).toBe(2)
    expect(parseArchivePage(['3'])).toBe(3)
    expect(parseArchivePage('-5')).toBe(1)
    expect(parseArchivePage('abc')).toBe(1)
  })
})

