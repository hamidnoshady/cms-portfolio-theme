import Link from 'next/link'

import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { Logo } from '@/components/layout/Logo'
import { MobileMenu } from '@/components/layout/MobileMenu'
import type { SiteContext } from '@/lib/cms/context'
import type { NavLink } from '@/lib/routing/nav'
import type { SwitchTarget } from '@/lib/seo/translations'
import { labels as dictionary } from '@/lib/theme/labels'

/**
 * Shared corner header used by both Home and interior routes:
 * - Inline-start corner (top-right in Persian RTL, top-left in English LTR):
 *   compact/primary logo or localized display name (`Logo`).
 * - Inline-end corner (top-left in Persian RTL, top-right in English LTR):
 *   compact primary menu (`nav.bang-nav`) on desktop, and `MobileMenu` drawer on narrow viewports.
 *   Hovered and active items receive a solid black rectangular fill (`#000000`) with white text (`#ffffff`).
 */
export const SiteHeader = ({
  context,
  floating = false,
  links,
  logo,
  switchTargets,
}: {
  context: SiteContext
  floating?: boolean
  links: NavLink[]
  logo: { compact: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}) => {
  const t = dictionary(context.locale)

  return (
    <header className={floating ? 'navbar bang-top bang-top--floating' : 'navbar bang-top'}>
      <div className="navbar__inner bang-top__inner">
        <div className="navbar__identity bang-top__brand">
          <Logo context={context} mark={logo} />
        </div>

        <div className="bang-top__controls flex items-center gap-3">
          {links.length > 0 ? (
            <nav aria-label={t.menuTitle} className="bang-nav hidden md:flex">
              <ul className="flex flex-wrap items-center gap-1">
                {links.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      aria-current={item.current ? 'page' : undefined}
                      className="bang-nav__link target-standalone"
                      data-active={item.current ? 'true' : undefined}
                      data-cursor="control"
                      href={item.href}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      target={item.newTab ? '_blank' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <div className="md:hidden">
            <MobileMenu
              dir={context.dir}
              labels={{ close: t.close, menu: t.menu, menuTitle: t.menuTitle }}
              links={links}
            >
              <LanguageSwitch current={context.locale} hrefs={switchTargets} label={t.languageSwitch} />
            </MobileMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
