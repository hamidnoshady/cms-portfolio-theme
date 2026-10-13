import Link from 'next/link'

import { ContentContainer, NavbarShell } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import type { SiteContext } from '@/lib/cms/context'
import type { NavLink } from '@/lib/routing/nav'
import { StudioClock } from '@/components/portfolio/StudioClock'
import { formatDate } from '@/lib/runtime'
import { labels as dictionary } from '@/lib/theme/labels'
import { brandName } from '@/lib/theme/brand'

/**
 * Footer: sparse by design — one structural rule, the footer menu, and the real site
 * name with the current Persian/English year. No newsletter, no invented columns.
 */
export const SiteFooter = ({
  context,
  links,
}: {
  context: SiteContext
  links: NavLink[]
}) => {
  const t = dictionary(context.locale)
  // The copyright year is a *date*, not a quantity: on `fa` it must be the Jalali year
  // (۱۴۰۴), never the Gregorian one digit-substituted into Persian numerals.
  const year = formatDate(new Date(), context.locale, { year: 'numeric' })
  const name = brandName(context.site)
  const settings = (context.site.themeRuntime?.settings ?? {}) as Record<string, unknown>
  const clocks = [
    {
      label: typeof settings.clockLabelA === 'string' && settings.clockLabelA ? settings.clockLabelA : 'BUE',
      zone: typeof settings.clockZoneA === 'string' && settings.clockZoneA ? settings.clockZoneA : 'America/Argentina/Buenos_Aires',
    },
    {
      label: typeof settings.clockLabelB === 'string' && settings.clockLabelB ? settings.clockLabelB : 'BCN',
      zone: typeof settings.clockZoneB === 'string' && settings.clockZoneB ? settings.clockZoneB : 'Europe/Madrid',
    },
  ]

  return (
    <footer className="mt-auto">
      <NavbarShell>
        <Rule />
      </NavbarShell>
      <ContentContainer className="py-10">
        {/* The mark's containing block is the *content* box, not the container's padding
            box: at 1440px the container touches the viewport edge, so a mark offset from
            the padding box lands outside the viewport and is clipped. */}
        <div className="bang-footer__utils relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <DecorativeMark className="top-0 -start-1 hidden md:block" variant="offset-l" />
          <p className="type-meta">{`© ${year} ${name}`}</p>
          <StudioClock clocks={clocks} />
          {links.length > 0 ? (
            <nav aria-label={t.menuTitle}>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="type-ui nav-link"
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
          ) : null}
        </div>
      </ContentContainer>
    </footer>
  )
}
