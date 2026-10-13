import Link from 'next/link'

import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * Language switch: names only the **other** language.
 *
 * A Persian page offers «English», an English page offers «فارسی» — the current
 * language is never listed as a second visible option, because a switch that shows
 * both reads as a status line, not a control. The rule is the same wherever the
 * switch appears (desktop header, mobile drawer, home entrance), because all three
 * render this one component.
 *
 * `href` is computed by the caller from the *translated equivalent* document — when
 * a document has no translation in the other locale the caller passes `null` and
 * the switch renders the label as quiet, non-interactive text rather than
 * fabricating a URL that would 404 or redirecting to the other home page.
 */

/** The targets a switch shows: every available locale except the one being read. */
export const oppositeTargets = (targets: SwitchTarget[], current: string): SwitchTarget[] =>
  targets.filter((entry) => entry.locale !== current)

export const LanguageSwitch = ({
  className,
  current,
  hrefs,
  label,
}: {
  className?: string
  current: string
  hrefs: SwitchTarget[]
  label: string
}) => {
  const targets = oppositeTargets(hrefs, current)
  if (targets.length === 0) return null

  return (
    <nav aria-label={label} className={className} data-language-switch={current}>
      <ul className="flex items-center gap-3">
        {targets.map((entry) => (
          <li key={entry.locale}>
            {entry.href ? (
              <Link className="type-ui nav-link" href={entry.href} hrefLang={entry.locale} lang={entry.locale}>
                {entry.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="type-ui lang-switch__unavailable"
                data-translation="missing"
                lang={entry.locale}
                role="link"
              >
                {entry.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
