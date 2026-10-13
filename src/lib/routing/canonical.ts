import 'server-only'
import type { SiteContext } from '@/lib/cms/context'
import { getSectionRef, getPostContext } from '@/lib/cms/content'
import { getPageBySlug } from '@/lib/cms/endpoints'
import { href } from './locale'
import { THEME_ROUTES } from './paths'
import type { ResolvedRoute } from './resolve'

/** One canonical URL per document. Skipped in preview so editors can open by slug. */
export const canonicalRedirect = async (route: ResolvedRoute, ctx: SiteContext): Promise<null | string> => {
  if (ctx.draft) return null
  if (route.kind === 'page') {
    const page = await getPageBySlug(route.slug, ctx.locale, ctx.draft)
    if (!page) return null
    const id = String(page.id)
    const table: Array<[string, string]> = [
      ['home', THEME_ROUTES.home], ['about', THEME_ROUTES.about], ['contact', THEME_ROUTES.contact],
      ['careers', THEME_ROUTES.careers], ['legal', THEME_ROUTES.legal],
    ]
    for (const [section, path] of table) {
      const ref = getSectionRef(section as never, ctx)
      if (ref.by === 'binding' && ref.id === id) return href(path, ctx.locale, ctx.site)
    }
    return null
  }
  if (route.kind === 'project' || route.kind === 'object') {
    const data = await getPostContext(route.slug, ctx)
    if (!data) return null
    const canonical = data.section === 'projects'
      ? `${THEME_ROUTES.projects}/${encodeURIComponent(route.slug)}`
      : `${THEME_ROUTES.objects}/${encodeURIComponent(route.slug)}`
    if (route.kind === 'project' && data.section === 'projects') return null
    if (route.kind === 'object' && data.section === 'objects') return null
    return href(canonical, ctx.locale, ctx.site)
  }
  return null
}
