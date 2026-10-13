// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Pagination } from '@/components/design/Pagination'
import { Rule } from '@/components/design/Rule'
import { LanguageSwitch, oppositeTargets } from '@/components/layout/LanguageSwitch'
import { Logo } from '@/components/layout/Logo'
import { ProjectCard, ProjectFacts, projectFactPairs } from '@/components/projects/ProjectCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { SiteContext } from '@/lib/cms/context'
import type { Locale, PostDoc, SiteDescriptor } from '@/lib/cms/types'
import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * The line system's accessibility contract: decorations are never interactive, never
 * announced and never part of the layout tree that shifts; structural rules carry no
 * content of their own.
 */
describe('DecorativeMark', () => {
  it('is hidden from assistive technology and cannot be focused or clicked', () => {
    const { container } = render(<DecorativeMark variant="crosshair" />)
    const mark = container.querySelector('[data-mark="crosshair"]')
    expect(mark).not.toBeNull()
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
    expect(mark?.querySelector('svg')?.getAttribute('vector-effect')).toBe('non-scaling-stroke')
  })

  it('renders all six documented variants deterministically', () => {
    const variants = ['corner', 'crosshair', 'dash', 'offset-l', 'pair', 'tick'] as const
    for (const variant of variants) {
      const { container } = render(<DecorativeMark variant={variant} />)
      expect(container.querySelector(`[data-mark="${variant}"]`)).not.toBeNull()
    }
  })
})

describe('structural rules', () => {
  it('are presentational only', () => {
    const { container } = render(<Rule />)
    const rule = container.querySelector('.rule-h')
    expect(rule).not.toBeNull()
    expect(rule?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.rule-h--emphasis')).toBeNull()
    const { container: emphasised } = render(<Rule tone="emphasis" />)
    expect(emphasised.querySelector('.rule-h--emphasis')).not.toBeNull()
  })
})

describe('Skeleton', () => {
  it('hides placeholder geometry from screen readers', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />)
    const skeleton = container.querySelector('.skeleton')
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Pagination', () => {
  it('keeps the localized base path when paging an English archive', () => {
    const { container } = render(
      <Pagination
        basePath="/en/projects"
        currentPage={1}
        label="Pagination"
        labels={{ next: 'Next', previous: 'Previous' }}
        locale="en"
        totalPages={3}
      />,
    )
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    // Every control — first page, page numbers and next — stays under the English tree.
    expect(hrefs.every((href) => href?.startsWith('/en/projects'))).toBe(true)
    expect(hrefs).toContain('/en/projects?page=2')
    expect(hrefs).toContain('/en/projects?page=3')
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination')
  })

  it('formats page numbers in the locale digits and preserves the filter query', () => {
    const { container } = render(
      <Pagination
        basePath="/projects"
        currentPage={1}
        label="صفحه‌بندی"
        labels={{ next: 'بعدی', previous: 'پیشین' }}
        locale="fa"
        query="?category=residential"
        totalPages={3}
      />,
    )
    const next = container.querySelector('a[href="/projects?category=residential&page=2"]')
    expect(next?.textContent).toBe('۲')
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('صفحه‌بندی')
  })
})

/**
 * Chrome components that the UI/UX refactor pinned down: the language switch names
 * only the other language and never fabricates a link; the logo is sized by the
 * design system, not by a hard-coded pixel height; the project facts block renders
 * exactly the fields the CMS returned.
 */
const siteContext = (locale: Locale, branding?: Record<string, unknown>): SiteContext =>
  ({
    canonicalOrigin: 'https://example.test',
    deploymentOrigin: 'https://example.test',
    dir: locale === 'fa' ? 'rtl' : 'ltr',
    draft: false,
    locale,
    serving: true,
    site: {
      availableLocales: ['fa', 'en'] as Locale[],
      branding: branding ?? null,
      defaultLocale: 'fa' as Locale,
      id: 'site-fixture',
      locales: ['fa', 'en'] as Locale[],
      media: { origin: 'https://example.test' },
      name: 'استودیوی نمونه',
      themeRuntime: { bindings: {}, settings: {} },
    } as unknown as SiteDescriptor,
  }) satisfies SiteContext

describe('LanguageSwitch', () => {
  const targets: SwitchTarget[] = [
    { href: '/projects/villa', label: 'فارسی', locale: 'fa' },
    { href: '/en/projects/villa', label: 'English', locale: 'en' },
  ]

  it('offers only the other language on a Persian page', () => {
    const { container } = render(<LanguageSwitch current="fa" hrefs={targets} label="زبان" />)
    const links = [...container.querySelectorAll('a')]
    expect(links.map((link) => link.textContent)).toEqual(['English'])
    expect(links[0]?.getAttribute('href')).toBe('/en/projects/villa')
    expect(links[0]?.getAttribute('hreflang')).toBe('en')
    expect(container.textContent).not.toContain('فارسی')
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('زبان')
  })

  it('offers only Persian on an English page', () => {
    const { container } = render(<LanguageSwitch current="en" hrefs={targets} label="Language" />)
    expect([...container.querySelectorAll('a')].map((link) => link.textContent)).toEqual(['فارسی'])
    expect(container.textContent).not.toContain('English')
  })

  it('shows a missing translation as quiet text, never as a link or a redirect home', () => {
    const { container } = render(
      <LanguageSwitch
        current="fa"
        hrefs={[
          { href: '/projects/villa', label: 'فارسی', locale: 'fa' },
          { href: null, label: 'English', locale: 'en' },
        ]}
        label="زبان"
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    const unavailable = container.querySelector('[data-translation="missing"]')
    expect(unavailable?.textContent).toBe('English')
    expect(unavailable?.getAttribute('aria-disabled')).toBe('true')
    expect(unavailable?.getAttribute('lang')).toBe('en')
    expect(container.textContent).not.toContain('/en')
  })

  it('renders nothing when the site serves a single language', () => {
    const { container } = render(<LanguageSwitch current="fa" hrefs={[targets[0]!]} label="زبان" />)
    expect(container.firstChild).toBeNull()
  })

  it('filters by locale, not by label', () => {
    // The old implementation compared `entry.label === current`, which never matched.
    expect(oppositeTargets(targets, 'fa').map((entry) => entry.locale)).toEqual(['en'])
    expect(oppositeTargets(targets, 'en').map((entry) => entry.locale)).toEqual(['fa'])
  })
})

describe('Logo', () => {
  const media = (id: string) => ({ height: 64, id, mimeType: 'image/svg+xml', url: `/media/${id}.svg`, width: 64 })

  it('is sized by the design system class, not a hard-coded 32px height', () => {
    const context = siteContext('fa', { logo: media('logo') })
    const { container } = render(<Logo context={context} mark={{ compact: 'https://example.test/media/logo.svg', primary: 'https://example.test/media/logo.svg' }} />)
    const img = container.querySelector('img[data-logo="mark"]')
    expect(img).not.toBeNull()
    expect(img?.classList.contains('navbar__logo')).toBe(true)
    expect(img?.className).not.toMatch(/\bh-8\b/u)
    expect(img?.getAttribute('height')).toBeNull()
    expect(img?.getAttribute('width')).toBeNull()
    // One asset → one image; no `<picture>` pretending there are two.
    expect(container.querySelector('picture')).toBeNull()
  })

  it('prefers the primary mark on desktop and the compact mark where space is limited', () => {
    const context = siteContext('en', { compactLogo: media('compact'), primaryLogo: media('primary') })
    const { container } = render(
      <Logo context={context} mark={{ compact: 'https://example.test/media/compact.svg', primary: 'https://example.test/media/primary.svg' }} />,
    )
    const source = container.querySelector('picture > source')
    expect(source?.getAttribute('media')).toBe('(min-width: 64rem)')
    expect(source?.getAttribute('srcset')).toBe('https://example.test/media/primary.svg')
    expect(container.querySelector('picture > img')?.getAttribute('src')).toBe('https://example.test/media/compact.svg')
    expect(container.querySelector('picture > img')?.classList.contains('navbar__logo')).toBe(true)
  })

  it('falls back to the site name as a wordmark with no mark element at all', () => {
    const { container } = render(<Logo context={siteContext('fa')} mark={{ compact: null, primary: null }} />)
    expect(container.querySelector('[data-logo="mark"]')).toBeNull()
    expect(container.querySelector('[data-logo="wordmark"]')?.textContent).toBe('استودیوی نمونه')
  })
})

describe('ProjectFacts', () => {
  const post = (projectMetadata: PostDoc['projectMetadata']): PostDoc =>
    ({ content: null, id: 'post-1', projectMetadata, slug: 'villa', title: 'ویلا' }) as unknown as PostDoc

  it('renders only the fields the CMS returned, as a compact facts block rather than a table', () => {
    const { container } = render(
      <ProjectFacts
        context={siteContext('fa')}
        post={post({ additionalFacts: [{ label: 'معمار', value: 'استودیو' }, { label: '', value: 'x' }], area: '۳۲۰ متر مربع', client: '  ', location: 'تهران', status: null })}
      />,
    )
    const labels = [...container.querySelectorAll('dt')].map((dt) => dt.textContent)
    expect(labels).toEqual(['مکان', 'مساحت', 'معمار'])
    const values = [...container.querySelectorAll('dd')].map((dd) => dd.textContent)
    expect(values).toEqual(['تهران', '۳۲۰ متر مربع', 'استودیو'])
    expect(container.querySelector('section')?.classList.contains('facts')).toBe(true)
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('مشخصات پروژه')
    expect(container.querySelector('dl')?.classList.contains('facts__list')).toBe(true)
    expect(container.querySelector('table')).toBeNull()
    expect(container.innerHTML).not.toContain('md:grid-cols-3')
    expect(container.querySelector('dd')?.getAttribute('dir')).toBe('auto')
  })

  it('renders nothing when the CMS returned no usable facts', () => {
    expect(render(<ProjectFacts context={siteContext('en')} post={post(null)} />).container.firstChild).toBeNull()
    expect(render(<ProjectFacts context={siteContext('en')} post={post({ client: ' ', location: '' })} />).container.firstChild).toBeNull()
  })

  it('shows the date as month and year, never the day', () => {
    const pairs = projectFactPairs(post({ date: '۱ بهمن ۱۴۰۴' }), 'fa')
    expect(pairs).toEqual([{ label: 'تاریخ', value: 'بهمن ۱۴۰۴' }])
    expect(projectFactPairs(post({ date: '2024-03-12' }), 'en')).toEqual([{ label: 'Date', value: 'March 2024' }])
  })

  it('labels in the page language', () => {
    expect(projectFactPairs(post({ location: 'Tehran', status: 'Built' }), 'en')).toEqual([
      { label: 'Location', value: 'Tehran' },
      { label: 'Status', value: 'Built' },
    ])
  })
})

describe('ProjectCard', () => {
  const card = (heroImage: unknown, projectMetadata: PostDoc['projectMetadata'] = { date: '۱ بهمن ۱۴۰۴', location: 'رشت' }) =>
    render(
      <ProjectCard
        context={siteContext('fa')}
        href="/projects/villa"
        post={{ heroImage, id: 'p1', projectMetadata, slug: 'villa', title: 'ویلا ۳۹۸' } as unknown as PostDoc}
      />,
    )
  const picture = (width: number, height: number) => ({ alt: 'x', height, id: `m${width}`, url: '/qa/media/x.jpg', width })

  it('gives every project the same 4:5 frame, whatever the photograph', () => {
    for (const [width, height] of [[1600, 1067], [1200, 1600], [1000, 1000], [3000, 900]] as const) {
      const { container, unmount } = card(picture(width, height))
      expect(container.querySelector('.pcard__frame')?.getAttribute('style') ?? '').toBe('')
      expect(container.querySelector('img')?.getAttribute('style')).toContain('aspect-ratio: 4 / 5')
      unmount()
    }
    const { container } = card(null)
    expect(container.querySelector('.skeleton')?.getAttribute('style')).toContain('aspect-ratio: 4 / 5')
  })

  it('is a title block: title and year on one line, the location beneath, one link', () => {
    const { container } = card(picture(1600, 1067))
    const caption = container.querySelector('.pcard__caption')!
    expect([...caption.children].map((child) => child.className)).toEqual(['pcard__title', 'pcard__year', 'pcard__place'])
    expect(caption.querySelector('.pcard__title')?.textContent).toBe('ویلا ۳۹۸')
    expect(caption.querySelector('.pcard__year')?.textContent).toBe('۱۴۰۴')
    expect(caption.querySelector('.pcard__place')?.textContent).toBe('رشت')
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/projects/villa')
  })

  it('shows only what the CMS returned', () => {
    const { container } = card(picture(1600, 1067), { location: '  ' })
    expect(container.querySelector('.pcard__year')).toBeNull()
    expect(container.querySelector('.pcard__place')).toBeNull()
    expect(container.querySelector('.pcard__title')).not.toBeNull()
  })
})
