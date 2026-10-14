import type { ReactNode } from 'react'

import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { SiteHeader } from '@/components/layout/SiteHeader'
import type { SiteContext } from '@/lib/cms/context'
import type { NavLink } from '@/lib/routing/nav'
import type { SwitchTarget } from '@/lib/seo/translations'
import { labels } from '@/lib/theme/labels'

/**
 * Shared visual shell for interior pages:
 * - Skip link to `#content`
 * - Top corner header (`SiteHeader`)
 * - Main content area (`#content`)
 * - Bottom-end corner language switch (`FA / EN`)
 */
export const InteriorShell = ({
  children,
  context,
  headerLinks,
  logo,
  switchTargets,
}: {
  children: ReactNode
  context: SiteContext
  headerLinks: NavLink[]
  logo: { compact: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}) => {
  const t = labels(context.locale)

  return (
    <div className="bang-shell flex min-h-svh flex-col">
      <a className="skip-link" href="#content">
        {t.skipToContent}
      </a>
      <SiteHeader context={context} links={headerLinks} logo={logo} switchTargets={switchTargets} />
      <main className="bang-shell__main flex-1" id="content">
        {children}
      </main>
      <div className="bang-corner-lang">
        <LanguageSwitch current={context.locale} hrefs={switchTargets} label={t.languageSwitch} />
      </div>
    </div>
  )
}
