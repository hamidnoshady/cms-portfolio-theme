'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect } from 'react'

import { documentAttributes, type DocumentLocaleConfig } from '@/lib/routing/documentLocale'

/**
 * Keeps `<html lang dir>` equal to the language of the URL being shown.
 *
 * The server sets both attributes from the proxy's `x-arch-locale` for the first
 * paint. After that the root layout is never re-rendered by a client navigation, so
 * this component owns the attributes: it runs in a layout effect — after the new
 * route's DOM is committed, before the browser paints it — on every pathname change,
 * which covers links, the language switch, `loading.tsx` fallbacks (the pathname
 * changes when the fallback commits) and back/forward. Everything that follows the
 * document direction (type tokens on `html[lang]`, logical spacing, arrows, the
 * drawer's entry edge, portalled overlays) is therefore right on the first painted
 * frame, with no flash of the previous language's direction.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export const DocumentLocale = ({ config }: { config: DocumentLocaleConfig }) => {
  const pathname = usePathname()
  const { defaultLocale, locales } = config
  const localeKey = locales.join(',')

  useIsomorphicLayoutEffect(() => {
    const { dir, lang } = documentAttributes(pathname, { defaultLocale, locales: localeKey.split(',') })
    const root = document.documentElement
    if (root.lang !== lang) root.lang = lang
    if (root.dir !== dir) root.dir = dir
  }, [pathname, defaultLocale, localeKey])

  return null
}
