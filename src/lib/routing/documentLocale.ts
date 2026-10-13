import { dirFor } from '@/lib/runtime'

/**
 * Which language a pathname is in — the same rule the proxy applies to set
 * `x-arch-locale` for the first byte, as a pure function the browser can run too.
 *
 * The root layout is shared by the Persian and English trees, so a client navigation
 * between them keeps the `<html>` element the server rendered for the *first* page:
 * without a client-side answer, `/` → `/en` left `lang=fa dir=rtl` (and the Persian
 * type tokens, which hang off `html[lang]`) on an English page until a reload.
 */
export type DocumentLocaleConfig = { defaultLocale: string; locales: readonly string[] }

export const KNOWN_PREFIXES = ['fa', 'en'] as const

export const localeForPathname = (pathname: null | string | undefined, config: DocumentLocaleConfig): string => {
  const first = (pathname ?? '/').split('/').find(Boolean)
  if (first && (KNOWN_PREFIXES as readonly string[]).includes(first) && config.locales.includes(first)) return first
  return config.defaultLocale
}

export const documentAttributes = (
  pathname: null | string | undefined,
  config: DocumentLocaleConfig,
): { dir: 'ltr' | 'rtl'; lang: string } => {
  const lang = localeForPathname(pathname, config)
  return { dir: dirFor(lang), lang }
}

/** Platform-injected locale facts, read the way `src/proxy.ts` reads them. */
export const documentLocaleConfig = (env: Record<string, string | undefined> = process.env): DocumentLocaleConfig => {
  const raw = env.ESHOBE_LOCALES
  const parsed = (raw ? raw.split(',') : [...KNOWN_PREFIXES]).map((value) => value.trim()).filter(Boolean)
  const defaultLocale = env.ESHOBE_DEFAULT_LOCALE?.trim() || 'fa'
  return { defaultLocale, locales: parsed.length > 0 ? parsed : [...KNOWN_PREFIXES] }
}
