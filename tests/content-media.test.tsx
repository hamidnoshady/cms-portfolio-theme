import { renderToReadableStream } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SiteContext } from '@/lib/cms/context'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

/**
 * CMS content images render **once**, where the editor put them, and every one of
 * them is a trigger of the field's single lightbox: `upload` nodes, the inline
 * `mediaBlock`, every cell of a `mediaGrid`. The project page therefore has no second
 * auto-generated gallery of the same media below the narrative.
 *
 * Rendered with React's own server renderer (the views are async server
 * components); Next's request APIs are stubbed and the CMS is the fixture encoder.
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

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_DEV_FIXTURES: '1', ESHOBE_PUBLIC_ORIGIN: 'https://example.test' }
  delete process.env.ESHOBE_CMS_URL
})

afterEach(() => {
  process.env = { ...ENV }
})

const html = async (element: React.ReactElement): Promise<string> => {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return new Response(stream).text()
}

const count = (markup: string, needle: RegExp): number => (markup.match(needle) ?? []).length

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

const picture = (file: string, width = 1600, height = 1067) => ({
  alt: `تصویر ${file}`,
  height,
  id: `media-${file}`,
  mimeType: 'image/jpeg',
  url: `/qa/media/${file}`,
  width,
})

const text = (value: string) => ({ children: [{ text: value, type: 'text', version: 1 }], type: 'paragraph', version: 1 })
const upload = (value: unknown) => ({ children: [], fields: {}, relationTo: 'media', type: 'upload', value, version: 1 })
const block = (fields: Record<string, unknown>) => ({ fields, type: 'block', version: 1 })

describe('rich text media', () => {
  it('renders every content image once, each as a trigger of one lightbox, in document order', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = {
      root: {
        children: [
          text('متن آغازین'),
          upload(picture('one.jpg')),
          block({ blockType: 'mediaGrid', columns: '2', images: [picture('two.jpg', 1000, 1500), picture('three.jpg')] }),
          text('متن میانی'),
          block({ blockType: 'mediaBlock', caption: 'زیرنویس', media: picture('four.jpg') }),
          upload(picture('five.jpg')),
        ],
        direction: 'rtl' as const,
      },
    }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)

    // Five photographs → five triggers, indexed 0…4 in reading order, and five images.
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(5)
    expect([...markup.matchAll(/data-lightbox-index="(\d)"/gu)].map((match) => match[1])).toEqual(['0', '1', '2', '3', '4'])
    for (const file of ['one', 'two', 'three', 'four', 'five']) {
      expect(count(markup, new RegExp(`src="https://example.test/qa/media/${file}.jpg"`, 'gu'))).toBe(1)
    }

    // The inline grid is the shared 2/2/3 media grid with the editor's desktop choice,
    // not a private list class of its own.
    expect(markup).toContain('class="grid-media grid-media--2"')
    expect(markup).not.toContain('media-grid__list')
    // The lightbox itself is closed: no dialog markup is sent with the page.
    expect(markup).not.toContain('role="dialog"')
    expect(markup).not.toContain('lightbox__overlay')
  })

  it('leaves prose without photographs free of any lightbox trigger', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const markup = await html(
      <RichText content={{ root: { children: [text('فقط متن')], direction: 'rtl' as const } }} context={ctx('fa')} fallbackDir="rtl" />,
    )
    expect(markup).not.toContain('lightbox-trigger')
    expect(markup).toContain('فقط متن')
  })

  it('keeps an image whose file did not resolve as a plain, non-interactive frame', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = {
      root: {
        children: [upload({ ...picture('one.jpg'), url: undefined }), upload(picture('two.jpg'))],
        direction: 'rtl' as const,
      },
    }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(1)
    expect(markup).toContain('data-lightbox-index="0"')
    expect(markup).toContain('src="https://example.test/qa/media/two.jpg"')
  })
})

describe('named media grid', () => {
  const grid = (extra: Record<string, unknown> = {}, name?: string) =>
    block({ blockType: 'mediaGrid', images: [picture('a.jpg'), picture('b.jpg'), picture('c.jpg')], ...(name ? { blockName: name } : {}), ...extra })

  it('shows the CMS block name as the grid label with a two-digit count', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = { root: { children: [grid({}, 'طبقه همکف و لابی')], direction: 'rtl' as const } }
    const markup = await html(<RichText anchorScope={null} content={content} context={ctx('fa')} fallbackDir="rtl" />)

    expect(markup).toContain('class="media-grid__head"')
    expect(markup).toContain('طبقه همکف و لابی')
    expect(markup).toContain('۰۳')
    // The figure is named by its label, and there is exactly one label row.
    // A named grid is part of the field's outline, so it is also the navigation's anchor.
    expect(markup).toContain('<figure aria-labelledby="section-1-label" class="media-grid" id="section-1">')
    expect(markup).toContain('id="section-1-label"')
    expect(count(markup, /class="media-grid__head"/gu)).toBe(1)
  })

  it('renders no label row for an unnamed grid, and keeps the caption below the cells', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = { root: { children: [grid({ caption: 'زیرنویس' })], direction: 'rtl' as const } }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)

    expect(markup).not.toContain('media-grid__head')
    expect(markup).not.toContain('aria-labelledby')
    expect(markup).toContain('زیرنویس')
  })

  it('keeps the label in Latin digits for an English page', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = { root: { children: [grid({}, 'Ground floor')], direction: 'ltr' as const } }
    const markup = await html(<RichText content={content} context={ctx('en')} fallbackDir="ltr" />)
    expect(markup).toContain('Ground floor')
    expect(markup).toContain('>03<')
  })
})

describe('named single image', () => {
  const single = (blockName?: string, extra: Record<string, unknown> = {}) =>
    block({ blockType: 'mediaBlock', media: picture('plan.jpg', 1542, 1080), ...(blockName ? { blockName } : {}), ...extra })

  it('gets the same label row as a set of images, without a count', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = { root: { children: [single('پلان', { caption: 'زیرنویس' })], direction: 'rtl' as const } }
    const markup = await html(<RichText anchorScope={null} content={content} context={ctx('fa')} fallbackDir="rtl" />)

    // A named block is part of the field's outline, so it is also an anchor.
    expect(markup).toContain('<div aria-labelledby="section-1-label" class="media-titled media-titled--content" id="section-1" role="group">')
    expect(markup).toContain('<span class="media-grid__title" dir="auto">پلان</span>')
    expect(markup).not.toContain('media-grid__count')
    // The frame is still a lightbox trigger and keeps its caption.
    expect(count(markup, /class="lightbox-trigger/gu)).toBe(1)
    expect(markup).toContain('زیرنویس')
    expect(markup.indexOf('media-grid__head')).toBeLessThan(markup.indexOf('lightbox-trigger'))
  })

  it('stays a bare figure when the block has no name', async () => {
    const { RichText } = await import('@/components/blocks/RichText')
    const content = { root: { children: [single()], direction: 'rtl' as const } }
    const markup = await html(<RichText content={content} context={ctx('fa')} fallbackDir="rtl" />)
    expect(markup).not.toContain('media-grid__head')
    expect(markup).not.toContain('media-titled')
  })
})

describe('case-study page (projects + objects share one implementation)', () => {
  it('renders a readable H1 with decorative repeat hidden from assistive tech', async () => {
    const { CaseStudyView } = await import('@/views/CaseStudyView')
    const markup = await html(await CaseStudyView({ locale: 'fa', section: 'projects', slug: 'khaneye-noor' }))
    expect(markup).toMatch(/<h1[^>]*class="bang-case__title"/u)
    expect(markup).toContain('aria-hidden="true" class="bang-case__repeat"')
  })

  it('renders facts only from CMS metadata and offers share + inquiry', async () => {
    const { CaseStudyView } = await import('@/views/CaseStudyView')
    const markup = await html(await CaseStudyView({ locale: 'fa', section: 'projects', slug: 'khaneye-noor' }))
    expect(markup).toContain('class="bang-facts"')
    expect(markup).toContain('اشتراک‌گذاری')
  })

  it('renders an object through the same view at /objects/[slug]', async () => {
    const { CaseStudyView } = await import('@/views/CaseStudyView')
    const markup = await html(await CaseStudyView({ locale: 'fa', section: 'objects', slug: 'raw-lamp' }))
    expect(markup).toMatch(/<h1[^>]*class="bang-case__title"/u)
    expect(markup).toContain('چراغ RAW')
  })
})
