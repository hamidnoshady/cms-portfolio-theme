import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import { getHeader } from '@/lib/cms/endpoints'
import { brandLogo, navLinks, type NavLink } from '@/lib/routing/nav'
import { switchTargets, switchTargetsForPath, type SwitchTarget, type TranslatedDoc } from '@/lib/seo/translations'

/**
 * Page chrome (navigation, logo, language switch), assembled once per render.
 * Footer navigation is retired across the theme so `getFooter` is not fetched.
 */
export type Chrome = {
  headerLinks: NavLink[]
  /** `home` is the dedicated home mark when the customer uploaded one (`brandLogo`). */
  logo: { compact: null | string; home: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}

export const getChrome = async (
  ctx: SiteContext,
  currentPath: string,
  currentDoc?: TranslatedDoc,
  /** Locale-neutral query (e.g. `?q=…`) kept by a path-based language switch. */
  switchQuery = '',
): Promise<Chrome> => {
  const header = await getHeader(ctx.locale, ctx.draft)
  const headerLinks = await navLinks(header?.navItems, ctx, currentPath)

  return {
    headerLinks,
    logo: brandLogo(ctx),
    switchTargets: currentDoc
      ? await switchTargets(ctx, currentDoc)
      : switchTargetsForPath(ctx, () => currentPath, switchQuery),
  }
}
