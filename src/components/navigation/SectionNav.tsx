'use client'

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'

import { scrollToElement } from '@/components/motion/SmoothScroll'
import { toLocaleDigits } from '@/lib/runtime'

/**
 * In-page navigation for a long article (a project with many sets of renders).
 *
 * One list, two presentations (the stylesheet decides, see `.secnav` in components.css):
 *
 * - **Pointer devices, desktop width** — a slim rail on the right edge of the page:
 *   one short tick per section (longer for a main section, shorter for a named set
 *   inside it, solid for the one being read). Hover or keyboard focus opens it into
 *   the full list; a click scrolls to the section.
 * - **Touch and narrower screens** — no rail to hover, so a small button appears once
 *   the reader has scrolled, showing where they are (`2/6 · section name`); it opens
 *   the same list as a panel above it.
 *
 * The links are real `#section-n` anchors, so the list works without script and a
 * section can be linked to. Which section is being read is the last one whose top has
 * passed 35% of the viewport — a scroll position, not an observer, so it stays right
 * when a section is taller than the screen.
 */

export type SectionNavItem = { id: string; label: string; level: 1 | 2 }

const READING_LINE = 0.35
const SHOW_AFTER = 320

export const SectionNav = ({ items, label, locale }: { items: SectionNavItem[]; label: string; locale: string }) => {
  const [active, setActive] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const root = useRef<HTMLElement>(null)
  const listId = useId()

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const line = window.innerHeight * READING_LINE
      let current: string | undefined
      for (const item of items) {
        const element = document.getElementById(item.id)
        if (element && element.getBoundingClientRect().top <= line) current = item.id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = items.at(-1)?.id
      setActive(current)
      setScrolled(window.scrollY > SHOW_AFTER)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [items])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    // The smooth-scroll layer also listens for `#` clicks, but knows nothing of the
    // sticky navbar; this one scrolls once, clear of it.
    event.preventDefault()
    event.stopPropagation()
    const bar = document.querySelector('.navbar')
    scrollToElement(target, { offset: -((bar?.getBoundingClientRect().height ?? 0) + 16) })
    window.history.replaceState(null, '', `#${id}`)
    setActive(id)
    setOpen(false)
  }

  const position = items.findIndex((item) => item.id === active)
  const current = position >= 0 ? items[position] : undefined
  const progress = toLocaleDigits(`${Math.max(position, 0) + 1}/${items.length}`, locale)

  return (
    <nav aria-label={label} className="secnav" data-open={open} data-scrolled={scrolled} ref={root}>
      <button
        aria-controls={listId}
        aria-expanded={open}
        className="secnav__toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true" className="secnav__toggle-icon" />
        <span className="secnav__toggle-label" dir="auto">
          {current?.label ?? label}
        </span>
        <span aria-hidden="true" className="secnav__toggle-count" dir="ltr">
          {progress}
        </span>
      </button>
      <ol className="secnav__list" data-lenis-prevent="" id={listId}>
        {items.map((item) => (
          <li className="secnav__item" data-level={item.level} key={item.id}>
            <a
              aria-current={item.id === active ? 'location' : undefined}
              className="secnav__link"
              href={`#${item.id}`}
              onClick={(event) => go(event, item.id)}
            >
              <span aria-hidden="true" className="secnav__tick" />
              <span className="secnav__label" dir="auto">
                {item.label}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
