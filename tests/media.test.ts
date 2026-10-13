import { describe, expect, it } from 'vitest'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { CmsImage } from '@/components/media/CmsImage'
import {
  absoluteMediaUrl,
  aspectRatio,
  frameRatio,
  mediaPresentation,
  ratioNumber,
  frameRatioFor,
  mediaAlt,
  mediaOriginAllowed,
  mediaSrcSet,
  mediaUrl,
  objectPosition,
  orientationOf,
  sizeUrl,
} from '@/lib/utils/media'
import { compactStrings, readingMinutes, truncate } from '@/lib/utils/text'
import { collectMedia, lexicalText } from '@/lib/utils/lexical'
import type { Media } from '@/lib/cms/types'

const origin = 'https://cms.example.com'

const media: Media = {
  alt: '  عکس نما  ',
  focalX: 30,
  focalY: 70,
  height: 1200,
  id: 'm1',
  mimeType: 'image/jpeg',
  sizes: {
    large: { height: 800, url: '/api/media/file/photo-1400.jpg', width: 1400 },
    small: { height: 400, url: '/api/media/file/photo-600.jpg', width: 600 },
  },
  url: '/api/media/file/photo.jpg',
  width: 2000,
}

describe('media URLs', () => {
  it('keeps CMS upload URLs relative so the rendering host serves them', () => {
    expect(mediaUrl(media, origin)).toBe('/api/media/file/photo.jpg')
  })

  it('reduces an absolute URL on the declared origin to the same relative path', () => {
    // A preview deployment must never load images from the production domain.
    const production = 'https://arch.eshobe.com'
    expect(mediaUrl({ url: `${production}/api/media/file/photo.jpg?v=2` }, production)).toBe('/api/media/file/photo.jpg?v=2')
    expect(mediaUrl({ url: 'https://elsewhere.example/photo.jpg' }, production)).toBe('https://elsewhere.example/photo.jpg')
  })

  it('resolves to an absolute URL only from the deployment origin', () => {
    expect(absoluteMediaUrl('/api/media/file/photo.jpg', 'https://abc-preview.theme.eshobe.com')).toBe(
      'https://abc-preview.theme.eshobe.com/api/media/file/photo.jpg',
    )
    expect(absoluteMediaUrl(null, 'https://abc-preview.theme.eshobe.com')).toBeNull()
  })

  it('returns null for a missing url or an unparsable origin', () => {
    expect(mediaUrl({ url: null }, origin)).toBeNull()
    expect(mediaUrl(null, origin)).toBeNull()
    expect(mediaUrl({ url: '/a.jpg' }, 'not a url')).toBeNull()
  })

  it('picks a named size and falls back to the original', () => {
    expect(sizeUrl(media, 'small', origin)).toBe('/api/media/file/photo-600.jpg')
    // Not a CMS upload path: nothing on this deployment serves it, so it stays on the CMS origin.
    expect(sizeUrl({ id: 'x', url: '/a.jpg' }, 'large', origin)).toBe(`${origin}/a.jpg`)
  })

  it('builds a srcset with real widths and skips SVGs', () => {
    expect(mediaSrcSet(media, origin)).toBe(
      '/api/media/file/photo-600.jpg 600w, /api/media/file/photo-1400.jpg 1400w, /api/media/file/photo.jpg 2000w',
    )
    expect(mediaSrcSet({ ...media, mimeType: 'image/svg+xml' }, origin)).toBeUndefined()
  })

  it('only accepts origins on the allowlist', () => {
    expect(mediaOriginAllowed(`${origin}/x.jpg`, [origin])).toBe(true)
    expect(mediaOriginAllowed('/api/media/file/x.jpg', [origin])).toBe(true)
    expect(mediaOriginAllowed('https://evil.example.com/x.jpg', [origin])).toBe(false)
    expect(mediaOriginAllowed('javascript:alert(1)', [origin])).toBe(false)
    expect(mediaOriginAllowed('/relative.jpg', [origin])).toBe(false)
  })
})

describe('media on a preview host', () => {
  it('renders relative media URLs even though the descriptor names the production domain', () => {
    const html = renderToStaticMarkup(createElement(CmsImage, { media, origin: 'https://arch.eshobe.com' }))
    expect(html).toContain('src="/api/media/file/photo.jpg"')
    expect(html).not.toContain('arch.eshobe.com')
  })
})

describe('media geometry', () => {
  it('keeps real orientation instead of cropping everything to one ratio', () => {
    expect(orientationOf({ height: 800, id: 'a', width: 1200 })).toBe('landscape')
    expect(orientationOf({ height: 1200, id: 'a', width: 800 })).toBe('portrait')
    expect(orientationOf({ height: 1000, id: 'a', width: 1000 })).toBe('square')
    expect(frameRatioFor({ height: 1200, id: 'a', width: 800 })).toBe('3 / 4')
    expect(frameRatioFor({ height: 800, id: 'a', width: 1200 })).toBe('3 / 2')
  })

  it('falls back safely when dimensions are unknown', () => {
    expect(aspectRatio(null)).toBe('4 / 3')
    expect(orientationOf(null)).toBe('landscape')
  })

  it('exposes focal points as object-position only when supplied', () => {
    expect(objectPosition(media)).toBe('30% 70%')
    expect(objectPosition({ height: 10, id: 'x', width: 10 })).toBeUndefined()
  })

  it('uses alt text when present and a supplied fallback otherwise', () => {
    expect(mediaAlt(media)).toBe('عکس نما')
    expect(mediaAlt({ id: 'x' }, 'پروژه نور')).toBe('پروژه نور')
  })
})

describe('honest text metrics', () => {
  it('counts reading minutes from the real word count and never invents content', () => {
    expect(readingMinutes('')).toBe(0)
    expect(readingMinutes('یک')).toBe(1)
    expect(readingMinutes(Array.from({ length: 400 }, () => 'واژه').join(' '))).toBe(2)
  })

  it('truncates on a character boundary and marks the cut', () => {
    expect(truncate('کوتاه', 10)).toBe('کوتاه')
    expect(truncate('متن طولانی برای بازبینی', 8)).toMatch(/…$/u)
  })

  it('drops empty values when deciding whether metadata is redundant', () => {
    expect(compactStrings([' a ', null, '', undefined, 'b'])).toEqual(['a', 'b'])
  })
})

describe('lexical helpers', () => {
  const content = {
    root: {
      children: [
        { children: [{ text: 'سلام' }], type: 'paragraph' },
        {
          children: [],
          fields: { media: { alt: 'نما', height: 800, id: 'm9', url: '/api/media/file/x.jpg', width: 1200 } },
          type: 'block',
        },
        { fields: {}, type: 'upload', value: { height: 400, id: 'm10', url: '/api/media/file/y.jpg', width: 600 } },
      ],
    },
  }

  it('flattens a tree for reading time', () => {
    expect(lexicalText(content)).toBe('سلام')
  })

  it('collects inline and block media that actually has a URL', () => {
    const found = collectMedia(content)
    expect(found.map((entry) => entry.id)).toEqual(['m9', 'm10'])
  })
})

describe('frame sizing rule', () => {
  const photo = (width: number, height: number) => ({ height, id: 'm', url: '/x.jpg', width })

  it('buckets by orientation instead of using the exact pixel ratio', () => {
    expect(frameRatio(photo(1080, 1350))).toBe('3 / 4')
    expect(frameRatio(photo(1500, 1000))).toBe('3 / 2')
    expect(frameRatio(photo(1920, 1080))).toBe('16 / 9')
    expect(frameRatio(photo(1000, 1000))).toBe('1 / 1')
  })

  it('honours an editor choice, and "original" only when dimensions exist', () => {
    expect(frameRatio(photo(1080, 1350), '16/9')).toBe('16 / 9')
    expect(frameRatio(photo(1080, 1350), 'original')).toBe('1080 / 1350')
    expect(frameRatio({ id: 'm', url: '/x.jpg' }, 'original')).toBe('3 / 2')
  })

  it('validates CMS presentation fields and falls back safely', () => {
    expect(mediaPresentation({ aspect: '4/5', caption: '  نمای شمالی ', size: 'wide' })).toEqual({
      aspect: '4/5',
      caption: 'نمای شمالی',
      size: 'wide',
    })
    expect(mediaPresentation({ aspect: '7/3', caption: 3, size: 'giant' })).toEqual({
      aspect: 'auto',
      caption: null,
      size: 'content',
    })
  })

  it('converts a ratio string to the number the height cap multiplies', () => {
    expect(ratioNumber('3 / 4')).toBeCloseTo(0.75)
    expect(ratioNumber('nonsense')).toBe(1.5)
  })
})
