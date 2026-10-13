import { href, KNOWN_LOCALES } from './locale'

/**
 * Validation of an editor-typed URL (menus, CTA buttons, rich-text links, banners).
 * Pure and dependency-free so both server components and inline block renderers use
 * the same rule: `http(s)`, `mailto` and `tel` only; local paths normalised and placed
 * in the current locale's tree unless the editor already chose one; fragments and
 * query suffixes kept; anything else is `null`.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SCHEME = /^([a-z][a-z0-9+.-]*):/iu

/** Pure validation of an editor-typed URL. `null` when it is empty or unsafe. */
export const safeCustomUrl = (
  raw: unknown,
  locale: string,
  site: { defaultLocale: string },
): null | { external: boolean; href: string } => {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  // Control characters and whitespace inside a URL are how scheme filters get
  // bypassed (`java\tscript:`); a real URL an editor typed has neither.
  if (!url || /[\u0000-\u001f\u007f\s\\]/u.test(url)) return null

  if (url.startsWith('#') || url.startsWith('?')) return url.length > 1 ? { external: false, href: url } : null
  if (url.startsWith('//')) return { external: true, href: `https:${url}` }

  const scheme = SCHEME.exec(url)?.[1]
  if (scheme) {
    const protocol = `${scheme.toLowerCase()}:`
    if (!ALLOWED_SCHEMES.has(protocol)) return null
    if (protocol === 'http:' || protocol === 'https:') {
      try {
        const parsed = new URL(url)
        if (!parsed.hostname) return null
      } catch {
        return null
      }
    } else if (url.length <= protocol.length) {
      return null
    }
    return { external: true, href: url }
  }

  const path = url.startsWith('/') ? url : `/${url}`
  const first = path.split(/[/?#]/u)[1] ?? ''
  // An editor who already wrote `/en/...` chose the tree; never prefix it twice.
  if ((KNOWN_LOCALES as string[]).includes(first)) return { external: false, href: path }
  return { external: false, href: href(path, locale as never, site as never) }
}

