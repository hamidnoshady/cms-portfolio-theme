import type { Locale, SiteDescriptor } from '@/lib/cms/types'
import { href } from './locale'
import { THEME_ROUTES } from './paths'
import type { ResolvedRoute } from './resolve'

export type Crumb = { current?: boolean; href?: string; label: string }

const LABELS: Record<Locale, Record<string, string>> = {
  fa: { about: 'درباره ما', objects: 'آبژه‌ها', contact: 'تماس', careers: 'همکاری', home: 'خانه', legal: 'حقوقی', projects: 'پروژه‌ها' },
  en: { about: 'About', objects: 'Objects', contact: 'Contact', careers: 'Careers', home: 'Home', legal: 'Legal', projects: 'Projects' },
}

export const sectionLabel = (key: keyof (typeof LABELS)['fa'], locale: Locale): string =>
  LABELS[locale][key] ?? String(key)

export const breadcrumbsFor = (route: ResolvedRoute, site: Pick<SiteDescriptor, 'defaultLocale'>, leaf?: null | string): Crumb[] => {
  const t = (key: string) => sectionLabel(key as keyof (typeof LABELS)['fa'], route.locale)
  const home: Crumb = { href: href(THEME_ROUTES.home, route.locale, site), label: t('home') }
  const archive = (section: 'about' | 'careers' | 'contact' | 'legal' | 'objects' | 'projects'): Crumb[] => [
    home, { current: true, label: t(section) },
  ]
  const detail = (section: 'objects' | 'projects', sectionPath: string): Crumb[] => [
    home, { href: href(sectionPath, route.locale, site), label: t(section) }, { current: true, label: leaf ?? '' },
  ]
  switch (route.kind) {
    case 'projects': return archive('projects')
    case 'project': return detail('projects', THEME_ROUTES.projects)
    case 'objects': return archive('objects')
    case 'object': return detail('objects', THEME_ROUTES.objects)
    case 'about': return archive('about')
    case 'contact': return archive('contact')
    case 'careers': return archive('careers')
    case 'legal': return archive('legal')
    case 'page': return [home, { current: true, label: leaf ?? route.slug }]
    default: return [home]
  }
}
