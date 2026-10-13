/**
 * One canonical route builder for the portfolio theme.
 * Used by navigation, archives, related work, language switch, metadata, sitemap,
 * previews and redirects.
 */

export const THEME_ROUTES = {
  home: '/',
  about: '/about',
  projects: '/projects',
  objects: '/objects',
  contact: '/contact',
  careers: '/careers',
  legal: '/legal',
} as const

export type PortfolioSection = 'objects' | 'projects'

export const archivePath = (section: PortfolioSection): string =>
  section === 'projects' ? THEME_ROUTES.projects : THEME_ROUTES.objects

export const detailPath = (section: PortfolioSection, slug: string): string =>
  `${archivePath(section)}/${encodeURIComponent(slug)}`

export const projectsPath = (): string => THEME_ROUTES.projects
export const objectsPath = (): string => THEME_ROUTES.objects
export const projectPath = (slug: string): string => detailPath('projects', slug)
export const objectPath = (slug: string): string => detailPath('objects', slug)

/** Legacy Bang URL: objects were once served under /projects/*. Redirect explicitly. */
export const legacyObjectRedirects: Record<string, string> = {
  '/projects/raw': '/objects/raw',
}

export const pageQueryParam = (page: number): string => (page > 1 ? `?page=${page}` : '')
