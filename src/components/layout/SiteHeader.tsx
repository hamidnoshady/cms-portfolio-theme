import Link from 'next/link'

import { NavbarShell } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { Logo } from '@/components/layout/Logo'
import { MobileMenu } from '@/components/layout/MobileMenu'
import type { SiteContext } from '@/lib/cms/context'
import type { SwitchTarget } from '@/lib/seo/translations'
import type { NavLink } from '@/lib/routing/nav'
import { labels as dictionary } from '@/lib/theme/labels'

/**
 * Interior navbar: full viewport width with its own edge gutters (the content below
 * is capped at 1440px, so the two intentionally do **not** align). The customer
 * identity sits on the leading edge — right in Persian, left in English — which falls
 * out of the logical properties rather than a per-locale branch.
 */
export const SiteHeader = ({
  context,
  links,
  logo,
  switchTargets,
}: {
  context: SiteContext
  links: NavLink[]
  logo: { compact: null | string; primary: null | string }
  switchTargets: SwitchTarget[]
}) => {
  const t = dictionary(context.locale)

  return (
    <header className="navbar">
      <NavbarShell>
        <div className="navbar__inner">
          <div className="navbar__identity">
            <Logo context={context} mark={logo} />
          </div>

          <nav aria-label={t.menuTitle} className="navbar__nav hidden md:flex">
            <ul className="navbar__list">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    aria-current={link.current ? 'page' : undefined}
                    className={link.current ? 'nav-link active-underline' : 'nav-link'}
                    href={link.href}
                    rel={link.external ? 'noreferrer' : undefined}
                    target={link.newTab ? '_blank' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <LanguageSwitch
              className="hidden md:block"
              current={context.locale}
              hrefs={switchTargets}
              label={t.languageSwitch}
            />
            {/* Only plain strings cross the server/client boundary — the labels
                dictionary also contains a `readingTime` function, which React refuses
                to serialise (and which the drawer does not need). */}
            <MobileMenu
              dir={context.dir}
              labels={{ close: t.close, menu: t.menu, menuTitle: t.menuTitle }}
              links={links}
            >
              <LanguageSwitch current={context.locale} hrefs={switchTargets} label={t.languageSwitch} />
            </MobileMenu>
          </div>
        </div>
      </NavbarShell>
      <NavbarShell className="relative">
        <Rule />
        <DecorativeMark className="end-6 -bottom-1" variant="pair" />
      </NavbarShell>
    </header>
  )
}
