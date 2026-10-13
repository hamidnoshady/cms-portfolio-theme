import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import type { SiteContext } from '@/lib/cms/context'
import { labels } from '@/lib/theme/labels'
import type { NavLink } from '@/lib/routing/nav'
import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * Every interior page composes this shell. The home stage deliberately does not: it
 * renders its own full-viewport entrance with no navbar, no footer and no interior
 * sections.
 */
export const InteriorShell = ({
  children,
  context,
  footerLinks,
  headerLinks,
  logo,
  switchTargets,
}: {
  children: ReactNode
  context: SiteContext
  footerLinks: NavLink[]
  headerLinks: NavLink[]
  logo: { compact: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}) => (
  <div className="flex min-h-svh flex-col">
    {/* First tab stop on every interior page: a keyboard visitor can leave the navbar
        without walking through the whole menu. Visually hidden until focused. */}
    <a className="skip-link" href="#content">
      {labels(context.locale).skipToContent}
    </a>
    <SiteHeader context={context} links={headerLinks} logo={logo} switchTargets={switchTargets} />
    <main className="flex-1" id="content">
      {children}
    </main>
    <SiteFooter context={context} links={footerLinks} />
  </div>
)
