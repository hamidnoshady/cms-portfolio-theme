import Link from 'next/link'

import type { SwitchTarget } from '@/lib/seo/translations'

/**
 * Language switch: every language the site serves, with the one you are reading marked.
 *
 * The reference's chrome is a compact pair of codes (`ENG ESP`) sitting on the edge
 * opposite the logo: the *set* of languages is part of the identity, and the current
 * one is present but inert. This component keeps that shape — one entry per available
 * locale, in the order the CMS declares them, the current one rendered as marked text
 * (`aria-current`, non-interactive) and the others as links.
 *
 * A language the document has no translation in is quiet text, never a link: `href` is
 * computed by the caller from the *translated equivalent* document, and when it is
 * `null` rendering the label as non-interactive text is honest, while fabricating a URL
 * would 404 or silently redirect to the other home page.
 *
 * `href` is a locale-neutral path; the locale prefix is applied once by the caller — a
 * caller that pre-prefixed its path produced `/en/en/services`.
 */

/** The targets a switch shows: every available locale, in declaration order. */
export const switchEntries = (targets: SwitchTarget[]): SwitchTarget[] => targets

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
  // One language is not a choice: a lone label would read as a status line.
  if (hrefs.length < 2) return null

  return (
    <nav aria-label={label} className={className} data-language-switch={current}>
      <ul className="flex items-center gap-3">
        {switchEntries(hrefs).map((entry) => {
          const isCurrent = entry.locale === current
          return (
            <li key={entry.locale}>
              {isCurrent ? (
                <span
                  aria-current="true"
                  className="type-ui lang-switch__current"
                  data-current="true"
                  lang={entry.locale}
                  title={entry.name}
                >
                  {entry.label}
                </span>
              ) : entry.href ? (
                <Link
                  aria-label={entry.name}
                  className="type-ui nav-link"
                  href={entry.href}
                  hrefLang={entry.locale}
                  lang={entry.locale}
                  title={entry.name}
                >
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
          )
        })}
      </ul>
    </nav>
  )
}
