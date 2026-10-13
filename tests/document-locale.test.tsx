// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `<html lang dir>` after client navigation.
 *
 * The root layout is shared by both trees and is not re-rendered by a client
 * navigation, so `/` → `/en` used to keep `lang=fa dir=rtl` on the English page (and
 * `/en/about` → `/about` the reverse) until a reload. The synchroniser must flip both
 * attributes on every pathname change, in both directions, and in the commit that
 * shows the new route — before paint, so there is no frame in the old direction.
 */

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const config = { defaultLocale: 'fa', locales: ['fa', 'en'] }

beforeEach(() => {
  pathname = '/'
  document.documentElement.lang = 'fa'
  document.documentElement.dir = 'rtl'
})

afterEach(() => {
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('dir')
})

describe('document locale', () => {
  it('maps pathnames to the language the proxy serves them in', async () => {
    const { documentAttributes, documentLocaleConfig, localeForPathname } = await import('@/lib/routing/documentLocale')
    expect(localeForPathname('/', config)).toBe('fa')
    expect(localeForPathname('/en', config)).toBe('en')
    expect(localeForPathname('/en/projects/yuka', config)).toBe('en')
    expect(localeForPathname('/english-page', config)).toBe('fa')
    // A prefix the deployment does not serve is not a language switch.
    expect(localeForPathname('/en/about', { defaultLocale: 'fa', locales: ['fa'] })).toBe('fa')
    expect(documentAttributes('/en', config)).toEqual({ dir: 'ltr', lang: 'en' })
    expect(documentLocaleConfig({ ESHOBE_DEFAULT_LOCALE: 'en', ESHOBE_LOCALES: 'en, fa' })).toEqual({
      defaultLocale: 'en',
      locales: ['en', 'fa'],
    })
  })

  it('follows FA → EN → FA client navigation without a reload, including history', async () => {
    const { DocumentLocale } = await import('@/components/layout/DocumentLocale')
    const view = render(<DocumentLocale config={config} />)
    expect(document.documentElement.lang).toBe('fa')
    expect(document.documentElement.dir).toBe('rtl')

    for (const [path, lang, dir] of [
      ['/en', 'en', 'ltr'],
      ['/en/projects', 'en', 'ltr'],
      ['/about', 'fa', 'rtl'],
      ['/services', 'fa', 'rtl'],
      // Back to English (history navigation is just another pathname change).
      ['/en/about', 'en', 'ltr'],
    ] as const) {
      pathname = path
      act(() => view.rerender(<DocumentLocale config={config} />))
      expect([path, document.documentElement.lang, document.documentElement.dir]).toEqual([path, lang, dir])
    }
  })

  it('updates the attributes in the same commit, before the browser can paint', async () => {
    const React = await import('react')
    const { DocumentLocale } = await import('@/components/layout/DocumentLocale')
    const seen: string[] = []
    // Layout effects run after the DOM commit and before the browser paints. A
    // sibling's layout effect therefore sees what the first painted frame will show:
    // the document must already be English there (a passive `useEffect` would not be).
    const Probe = () => {
      React.useLayoutEffect(() => {
        seen.push(`${document.documentElement.lang}/${document.documentElement.dir}`)
      })
      return null
    }
    pathname = '/en'
    render(
      <>
        <DocumentLocale config={config} />
        <Probe />
      </>,
    )
    expect(seen).toEqual(['en/ltr'])
  })
})
