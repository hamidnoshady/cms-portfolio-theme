'use client'

/**
 * A case study opened *over* the page it was opened from.
 *
 * Why this exists: the reference opens a work in place — the canvas stays where the
 * visitor left it, and closing returns to exactly that spot. In Next's App Router that
 * is an intercepted route rendered into a parallel slot (`src/app/@overlay`), so the
 * home route is never unmounted and the canvas keeps its position, its DOM and its
 * pan state; a direct visit or a refresh still renders the full server-rendered case
 * study page (`src/app/projects/[slug]/page.tsx`), which keeps URLs, metadata,
 * sitemap entries and sharing intact. Closing pops the history entry the open pushed,
 * so Back and Forward work without any bespoke state.
 *
 * The shell owns the things an overlay must not forget: `role="dialog"` +
 * `aria-modal`, focus moved into the panel, Escape to close, the page behind it marked
 * `inert` (so keyboard and assistive-technology users cannot wander into the canvas
 * underneath), the document scroll locked, and the custom cursor switched off for a
 * reading surface.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { ShareButton } from '@/components/portfolio/ShareButton'

export const CaseStudyShell = ({
  children,
  closeLabel,
  dir,
  labels,
  shareUrl,
  title,
}: {
  children: ReactNode
  closeLabel: string
  dir: 'ltr' | 'rtl'
  labels: { copied: string; copyLink: string; done: string; failed: string; share: string }
  shareUrl: string
  title: string
}) => {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  const close = useCallback(() => {
    // `back()` unwinds the navigation that opened the overlay — including a chain of
    // related works — and lands the visitor on the canvas they left, unchanged.
    router.back()
  }, [router])

  useEffect(() => {
    openerRef.current = document.activeElement
    const html = document.documentElement
    const home = document.getElementById('bang-home')
    html.dataset.bangOverlay = 'open'
    home?.setAttribute('inert', '')
    /**
     * The tab follows the open work. Next applies the metadata of the page that matched
     * the *primary* route, and this overlay is a parallel slot, so the server-rendered
     * `<title>` under it is still the canvas' own — the one thing a visitor cannot see
     * for themselves while a work fills the screen. Setting it here keeps the tab, the
     * dialog's name and the direct visit's title the same string, and closing puts the
     * canvas' title back.
     */
    const previousTitle = document.title
    if (title) document.title = title
    // Let the custom cursor hand the system cursor back (see `CustomCursor`).
    window.dispatchEvent(new Event('bang:overlay'))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown)

    // Move focus in without scrolling the panel's own content.
    panelRef.current?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.title = previousTitle
      delete html.dataset.bangOverlay
      home?.removeAttribute('inert')
      window.dispatchEvent(new Event('bang:overlay'))
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [close, title])

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="bang-overlay"
      data-overlay=""
      dir={dir}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="bang-overlay__bar">
        <button className="bang-btn bang-btn--ghost" data-cursor="control" onClick={close} type="button">
          {closeLabel}
        </button>
        <ShareButton labels={labels} title={title} url={shareUrl} />
      </div>
      <div className="bang-overlay__body">{children}</div>
    </div>
  )
}
