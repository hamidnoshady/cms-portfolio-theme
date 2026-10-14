'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { ShareButton, type ShareLabels } from './ShareButton'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Intercepted case-study overlay shell (`CaseStudyShell`).
 *
 * Isolates all background page roots (`#bang-home`, interior shell roots) with `inert`,
 * locks background scroll (`data-bang-overlay="open"` + `data-scroll-locked="true"`),
 * traps `Tab`/`Shift+Tab` inside the modal while yielding to any nested lightbox dialog,
 * closes on `Escape` or the Close button, and restores focus and title on teardown.
 */
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
  labels: ShareLabels
  shareUrl: string
  title: string
}) => {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const close = useCallback(() => {
    router.back()
  }, [router])

  useEffect(() => {
    const root = document.documentElement
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousTitle = document.title

    root.dataset.bangOverlay = 'open'
    document.body.setAttribute('data-scroll-locked', 'true')
    document.title = title
    window.dispatchEvent(new Event('bang:overlay'))

    // Mark every background sibling container inert (works from Home and from archives).
    const inerted: HTMLElement[] = []
    const home = document.getElementById('bang-home')
    if (home && (!dialog || !home.contains(dialog))) {
      home.setAttribute('inert', '')
      inerted.push(home)
    }
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue
      if (dialog && (child === dialog || child.contains(dialog))) continue
      if (child.classList.contains('bang-cursor')) continue
      if (!child.hasAttribute('inert')) {
        child.setAttribute('inert', '')
        inerted.push(child)
      }
    }

    closeRef.current?.focus()

    const hasNestedOpenDialog = () => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')]
      return dialogs.some((node) => node !== dialog && !dialog?.contains(node))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || hasNestedOpenDialog()) return

      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key === 'Tab' && dialog) {
        const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
          (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
        )
        if (focusables.length === 0) {
          event.preventDefault()
          return
        }
        const first = focusables[0]!
        const last = focusables[focusables.length - 1]!
        const active = document.activeElement as HTMLElement | null
        if (event.shiftKey) {
          if (!active || active === first || !dialog.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (!active || active === last || !dialog.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      delete root.dataset.bangOverlay
      document.body.removeAttribute('data-scroll-locked')
      for (const el of inerted) el.removeAttribute('inert')
      document.title = previousTitle
      window.dispatchEvent(new Event('bang:overlay'))
      if (opener && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [close, title])

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="bang-overlay"
      data-lenis-prevent
      dir={dir}
      ref={dialogRef}
      role="dialog"
    >
      <div className="bang-overlay__bar">
        <ShareButton labels={labels} title={title} url={shareUrl} />
        <button
          className="bang-case__action target-standalone"
          data-cursor="control"
          onClick={close}
          ref={closeRef}
          type="button"
        >
          {closeLabel}
        </button>
      </div>
      <div className="bang-overlay__body">{children}</div>
    </div>
  )
}
