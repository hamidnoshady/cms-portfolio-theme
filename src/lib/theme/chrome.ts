import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import { getFooter, getHeader } from '@/lib/cms/endpoints'
import { navLinks, brandLogo, type NavLink } from '@/lib/routing/nav'
import { switchTargetsForPath, switchTargets, type SwitchTarget, type TranslatedDoc } from '@/lib/seo/translations'

/**
 * Page chrome (navigation, footer, logo, language switch), assembled once per render.
 * Every interior view calls this; the home stage uses only the header links, because it
 * has no navbar or footer.
 */
export type Chrome = {
  footerLinks: NavLink[]
  headerLinks: NavLink[]
  logo: { compact: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}

export const getChrome = async (
  ctx: SiteContext,
  currentPath: string,
  currentDoc?: TranslatedDoc,
  /** Locale-neutral query (e.g. `?q=…`) kept by a path-based language switch. */
  switchQuery = '',
): Promise<Chrome> => {
  const [header, footer] = await Promise.all([
    getHeader(ctx.locale, ctx.draft),
    getFooter(ctx.locale, ctx.draft),
  ])

  const [headerLinks, footerLinks] = await Promise.all([
    navLinks(header?.navItems, ctx, currentPath),
    navLinks(footer?.navItems, ctx, currentPath),
  ])

  return {
    footerLinks,
    headerLinks,
    logo: brandLogo(ctx),
    switchTargets: currentDoc
      ? await switchTargets(ctx, currentDoc)
      : switchTargetsForPath(ctx, () => currentPath, switchQuery),
  }
}
