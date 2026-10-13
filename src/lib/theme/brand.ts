import type { SiteDescriptor } from '@/lib/cms/types'

/**
 * The customer's public name, everywhere it is shown or announced: the logo
 * wordmark, the footer, `<title>`, `og:site_name`. It is the CMS's branding
 * `displayName`; the descriptor's `name` is the internal site name (e.g. `arch`) and
 * is only the fallback when no display name was configured. The theme never
 * translates or rewrites a brand name — a per-language name is CMS data.
 */
export const brandName = (site: Pick<SiteDescriptor, 'branding' | 'name'>): string =>
  site.branding?.displayName?.trim() || site.name
