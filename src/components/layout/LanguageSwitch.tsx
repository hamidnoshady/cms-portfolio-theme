import Link from 'next/link'

import type { Locale } from '@/lib/cms/types'
import type { SwitchTarget } from '@/lib/seo/translations'

const SHORT_LABEL: Record<Locale, string> = {
  en: 'EN',
  fa: 'FA',
}

/** The targets a switch shows: every available locale, in declaration order. */
export const switchEntries = (targets: SwitchTarget[]): SwitchTarget[] => targets

/**
 * Compact corner language switch (`FA / EN`).
 *
 * - Renders nothing when fewer than 2 locales exist (`hrefs.length < 2`).
 * - Current locale is marked with `data-current="true"` and `aria-current="true"`.
 * - Translated target renders a `<Link>` with `hrefLang` and `lang`.
 * - Missing translation renders non-interactive text (`data-translation="missing"`, `aria-disabled="true"`).
 */
export const LanguageSwitch = ({
  className,
  current,
  hrefs,
  label,
  targets,
}: {
  className?: string
  current: string
  hrefs?: SwitchTarget[]
  label: string
  targets?: SwitchTarget[]
}) => {
  const list = switchEntries(hrefs ?? targets ?? [])
  if (list.length < 2) return null

  return (
    <nav
      aria-label={label}
      className={className ? `bang-lang ${className}` : 'bang-lang'}
      data-language-switch={current}
    >
      <ul className="flex items-center gap-1">
        {list.map((entry) => {
          const code = SHORT_LABEL[entry.locale] ?? entry.label
          const isCurrent = entry.locale === current
          return (
            <li key={entry.locale}>
              {isCurrent ? (
                <span
                  aria-current="true"
                  className="bang-lang__item lang-switch__current target-standalone"
                  data-current="true"
                  lang={entry.locale}
                  title={entry.name}
                >
                  {code}
                </span>
              ) : entry.href ? (
                <Link
                  aria-label={entry.name}
                  className="bang-lang__item bang-lang__link nav-link target-standalone"
                  data-cursor="control"
                  href={entry.href}
                  hrefLang={entry.locale}
                  lang={entry.locale}
                  title={entry.name}
                >
                  {code}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="bang-lang__item lang-switch__unavailable target-standalone"
                  data-translation="missing"
                  lang={entry.locale}
                  role="link"
                  title={entry.name}
                >
                  {code}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
