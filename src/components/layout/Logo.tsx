import Link from 'next/link'
import type { CSSProperties } from 'react'

import type { SiteContext } from '@/lib/cms/context'
import type { Media } from '@/lib/cms/types'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { cn } from '@/lib/utils/cn'
import { brandName } from '@/lib/theme/brand'

/**
 * Customer identity in the chrome.
 *
 * The logo is an uploaded file rendered with `<img>` — never inlined markup, so a
 * scripted SVG that slipped past the CMS allowlist still cannot execute. When the
 * customer has uploaded nothing, the theme falls back to the site's real name as a
 * wordmark; it never ships bundled artwork or an invented brand.
 *
 * Scale is the design system's, not the file's: `.navbar__logo` sizes the mark by
 * height from the chrome tokens (42 → 46 → 52px across the breakpoints) with
 * `width: auto` and `object-fit: contain`, so there is no hard-coded pixel height in
 * the markup. The **primary** asset is preferred on desktop; the compact mark serves
 * phones and tablets, where the centre navigation and the controls need the room.
 * When the customer uploaded only one asset, `brandLogo` resolves both slots to it
 * and a single `<img>` is rendered.
 */
export type LogoMark = { compact: null | string; primary: null | string }

/** The desktop breakpoint of the design system (`64rem`): where the primary mark takes over. */
const PRIMARY_MEDIA_QUERY = '(min-width: 64rem)'

const ratioOf = (media: Media | null | undefined): CSSProperties | undefined =>
  media?.width && media?.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined

export const Logo = ({
  className,
  context,
  mark,
  wordmark = false,
}: {
  className?: string
  context: SiteContext
  /** Resolved URLs from `brandLogo(context)`. */
  mark: LogoMark
  wordmark?: boolean
}) => {
  const name = brandName(context.site)
  const primary = mark.primary ?? mark.compact
  const compact = mark.compact ?? mark.primary
  const branding = context.site.branding
  const primaryMedia = branding?.primaryLogo ?? branding?.logo ?? null
  const compactMedia = branding?.compactLogo ?? branding?.logoCompact ?? null

  return (
    <Link
      aria-label={name}
      className={cn('flex items-center gap-3', className)}
      href={href(THEME_ROUTES.home, context.locale, context.site)}
    >
      {!wordmark && primary ? (
        // `data-logo` is a QA hook: the "customer has no logo" case must be provable
        // negatively (no mark element at all), not by eyeballing a screenshot.
        compact && compact !== primary ? (
          <picture>
            <source media={PRIMARY_MEDIA_QUERY} srcSet={primary} />
            <img alt={name} className="navbar__logo" data-logo="mark" decoding="async" src={compact} />
          </picture>
        ) : (
          <img
            alt={name}
            className="navbar__logo"
            data-logo="mark"
            decoding="async"
            src={primary}
            style={ratioOf(primary === mark.primary ? primaryMedia : compactMedia)}
          />
        )
      ) : (
        <span className="navbar__wordmark" data-logo="wordmark">
          {name}
        </span>
      )}
    </Link>
  )
}
