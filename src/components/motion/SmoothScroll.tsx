'use client'

import Lenis from 'lenis'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Site-wide smooth scrolling (Lenis) — one instance per tab.
 *
 * - Wheel and trackpad only. Touch keeps the platform's own scrolling (`syncTouch`
 *   off), which is already smooth and which users expect to feel native.
 * - Off entirely under `prefers-reduced-motion`: the page scrolls natively and every
 *   `scrollToElement()` jumps.
 * - Paused while a Radix dialog/sheet holds the scroll lock (`data-scroll-locked` on
 *   `<body>`), so the drawer and the lightbox never scroll the page behind them.
 *   Scrollable regions inside overlays also carry `data-lenis-prevent`.
 * - Route changes start at the top without an animated jump.
 */

type LenisWindow = Window & { __archLenis?: Lenis }

export const scrollToElement = (element: HTMLElement, options: { offset?: number } = {}): void => {
  const lenis = (window as LenisWindow).__archLenis
  if (lenis) {
    lenis.scrollTo(element, { duration: 1.1, offset: options.offset ?? 0 })
    return
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = element.getBoundingClientRect().top + window.scrollY + (options.offset ?? 0)
  window.scrollTo({ behavior: reduced ? 'auto' : 'smooth', top })
}

export const SmoothScroll = () => {
  const pathname = usePathname()

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: Lenis | null = null
    let observer: MutationObserver | null = null

    const start = () => {
      if (media.matches || lenis) return
      lenis = new Lenis({ anchors: true, autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false })
      ;(window as LenisWindow).__archLenis = lenis
      observer = new MutationObserver(() => {
        if (document.body.hasAttribute('data-scroll-locked')) lenis?.stop()
        else lenis?.start()
      })
      observer.observe(document.body, { attributeFilter: ['data-scroll-locked', 'style'], attributes: true })
    }
    const stop = () => {
      observer?.disconnect()
      observer = null
      lenis?.destroy()
      lenis = null
      delete (window as LenisWindow).__archLenis
    }
    const onChange = () => (media.matches ? stop() : start())

    start()
    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
      stop()
    }
  }, [])

  useEffect(() => {
    // A new page starts at its top; the in-page hash (if any) is honoured by Lenis' anchors.
    if (window.location.hash) return
    ;(window as LenisWindow).__archLenis?.scrollTo(0, { immediate: true })
  }, [pathname])

  return null
}
