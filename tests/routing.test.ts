import { describe, expect, it } from 'vitest'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href, splitLocale } from '@/lib/routing/locale'
import { detailPath, objectPath, projectPath, THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute, resolveThemeRoute } from '@/lib/routing/resolve'
import type { Locale, SiteDescriptor } from '@/lib/cms/types'

const site = {
  availableLocales: ['fa', 'en'] as Locale[],
  defaultLocale: 'fa' as Locale,
} as unknown as Pick<SiteDescriptor, 'availableLocales' | 'defaultLocale'>

describe('locale splitting', () => {
  it('treats the default locale as unprefixed', () => {
    expect(splitLocale(['projects', 'masjed'], site)).toEqual({ explicit: false, locale: 'fa', rest: ['projects', 'masjed'] })
  })
  it('recognises a served locale prefix', () => {
    expect(splitLocale(['en', 'projects'], site)).toEqual({ explicit: true, locale: 'en', rest: ['projects'] })
  })
  it('refuses a locale the site does not serve', () => {
    const persianOnly = { availableLocales: ['fa'] as Locale[], defaultLocale: 'fa' as Locale }
    expect('unsupported' in splitLocale(['en', 'projects'], persianOnly)).toBe(true)
    expect(resolveThemeRoute(['en', 'projects'], persianOnly as never)).toMatchObject({ kind: 'notFound', reason: 'unsupported-locale' })
  })
})

describe('route resolution', () => {
  it('maps the empty path to home', () => {
    expect(resolveThemeRoute([], site).kind).toBe('home')
  })
  it('maps portfolio sections, details and static pages', () => {
    expect(resolveThemeRoute(['about'], site).kind).toBe('about')
    expect(resolveThemeRoute(['contact'], site).kind).toBe('contact')
    expect(resolveThemeRoute(['careers'], site).kind).toBe('careers')
    expect(resolveThemeRoute(['legal'], site).kind).toBe('legal')
    expect(resolveThemeRoute(['projects'], site).kind).toBe('projects')
    expect(resolveThemeRoute(['projects', 'x'], site).kind).toBe('project')
    expect(resolveThemeRoute(['objects'], site).kind).toBe('objects')
    expect(resolveThemeRoute(['objects', 'x'], site).kind).toBe('object')
  })
  it('resolves the English tree with the locale carried on the route', () => {
    const route = resolveThemeRoute(['en', 'projects'], site)
    expect(route.kind).toBe('projects')
    expect(route.locale).toBe('en')
  })
  it('aliases the CMS-reserved /posts paths onto the portfolio projects route', () => {
    expect(resolveThemeRoute(['posts'], site)).toMatchObject({ kind: 'alias', to: '/projects' })
    expect(resolveThemeRoute(['posts', 'raw-lamp'], site)).toMatchObject({ kind: 'alias', to: '/projects/raw-lamp' })
  })

  it('treats an unknown single segment as a CMS page and longer paths as not found', () => {
    expect(resolveThemeRoute(['our-studio'], site)).toMatchObject({ kind: 'page', slug: 'our-studio' })
    expect(resolveThemeRoute(['our', 'studio'], site).kind).toBe('notFound')
  })
  it('decodes percent-encoded slugs exactly once', () => {
    const encoded = encodeURIComponent('پروژه-ی-نور')
    expect(resolveThemeRoute(['projects', encoded], site)).toMatchObject({ kind: 'project', slug: 'پروژه-ی-نور' })
  })
  it('reads pagination and ignores nonsense', () => {
    expect(resolveThemeRoute(['projects'], site, { page: '3' })).toMatchObject({ kind: 'projects', page: 3 })
    expect(resolveThemeRoute(['projects'], site, { page: '-2' })).toMatchObject({ kind: 'projects', page: 1 })
  })
})

describe('locale-aware route resolution for views', () => {
  it('keeps breadcrumb labels and parent links in the page locale', () => {
    const route = resolveLocaleRoute(['projects', 'casa'], 'en', site)
    expect(route).toMatchObject({ explicitLocale: true, kind: 'project', locale: 'en' })
    const crumbs = breadcrumbsFor(route, site, 'Casa')
    expect(crumbs.map((c) => c.label)).toEqual(['Home', 'Projects', 'Casa'])
    expect(crumbs[1]?.href).toBe('/en/projects')
  })
  it('adds no prefix for the default locale', () => {
    expect(resolveLocaleRoute(['objects'], 'fa', site)).toMatchObject({ explicitLocale: false, kind: 'objects', locale: 'fa' })
  })
  it('preserves the current entity when switching languages', () => {
    const faRoute = resolveThemeRoute(['projects', 'cortaderas'], site)
    const enRoute = resolveThemeRoute(['en', 'projects', 'cortaderas'], site)
    expect(faRoute).toMatchObject({ kind: 'project', slug: 'cortaderas', locale: 'fa' })
    expect(enRoute).toMatchObject({ kind: 'project', slug: 'cortaderas', locale: 'en' })
  })
})

describe('URL builders', () => {
  it('prefixes only non-default locales', () => {
    expect(href('/projects', 'fa', site)).toBe('/projects')
    expect(href('/projects', 'en', site)).toBe('/en/projects')
  })
  it('builds canonical archive and detail paths from one builder', () => {
    expect(projectPath('نور')).toBe('/projects/%D9%86%D9%88%D8%B1')
    expect(objectPath('raw')).toBe('/objects/raw')
    expect(detailPath('projects', 'a b')).toBe('/projects/a%20b')
    expect(THEME_ROUTES.careers).toBe('/careers')
    expect(THEME_ROUTES.legal).toBe('/legal')
  })
})

describe('breadcrumbs', () => {
  it('always starts at home and marks the leaf aria-current', () => {
    const crumbs = breadcrumbsFor(resolveThemeRoute(['projects', 'x'], site), site, 'پروژه')
    expect(crumbs[0]?.label).toBe('خانه')
    expect(crumbs.at(-1)).toEqual({ current: true, label: 'پروژه' })
    expect(crumbs.length).toBe(3)
  })
  it('localises objects labels per locale', () => {
    const crumbs = breadcrumbsFor(resolveThemeRoute(['en', 'objects', 'x'], site), site, 'Lamp')
    expect(crumbs.map((c) => c.label)).toEqual(['Home', 'Objects', 'Lamp'])
    expect(crumbs[1]?.href).toBe('/en/objects')
  })
})
