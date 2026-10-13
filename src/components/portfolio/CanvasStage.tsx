'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { CmsImage } from '@/components/media/CmsImage'
import type { Media } from '@/lib/cms/types'

export type CanvasWork = { href: string; title: string; media: Media | null }

const MAX_TILES = 8

/**
 * Bounded curated image composition. One accessible link per canonical work;
 * visual copies are decorative (aria-hidden, tabindex -1, no duplicate links).
 * Respects prefers-reduced-motion, suspends rAF when hidden/offscreen, offers
 * pause control and a static no-JS fallback list.
 */
export const CanvasStage = ({
  browseHref, browseLabel, origin, works,
}: {
  browseHref: string
  browseLabel: string
  origin: string
  works: CanvasWork[]
}) => {
  const items = works.slice(0, MAX_TILES)
  const id = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)
  const [paused, setPaused] = useState(false)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the platform reduced-motion setting once on mount; changes arrive via subscription below.
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? true), { threshold: 0.05 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (reduced || paused || !visible || document.hidden || items.length < 2) return
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      if (t - last > 6000) {
        last = t
        setActive((a) => (a + 1) % items.length)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onVis = () => { last = performance.now() }
    document.addEventListener('visibilitychange', onVis)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis) }
  }, [reduced, paused, visible, items.length])

  if (items.length === 0) {
    return (
      <div className="bang-canvas bang-canvas--empty">
        <p className="type-body">No featured work yet.</p>
        <Link className="bang-btn" href={browseHref}>{browseLabel}</Link>
      </div>
    )
  }

  return (
    <section aria-roledescription="carousel" aria-label="Featured work" className="bang-canvas" ref={stageRef}>
      <a className="skip-link" href="#content">Skip featured work</a>
      <div className="bang-canvas__stage">
        {items.map((w, i) => {
          const isActive = i === active
          return (
            <div
              aria-hidden={!isActive}
              className={isActive ? 'bang-canvas__tile is-active' : 'bang-canvas__tile'}
              key={w.href}
              inert={!isActive}
            >
              <CmsImage media={w.media} origin={origin} priority={i === 0} ratio="4 / 3" sizes="(min-width:1280px) 60vw, 90vw" alt={w.title} />
              <p aria-hidden="true" className="bang-canvas__wordmark">estudiobang</p>
            </div>
          )
        })}
      </div>
      <div className="bang-canvas__controls">
        <ul className="bang-canvas__dots" aria-label="Choose featured work">
          {items.map((w, i) => (
            <li key={w.href}>
              <button
                aria-current={i === active ? 'true' : undefined}
                aria-label={`${i + 1}: ${w.title}`}
                className={i === active ? 'bang-dot is-active' : 'bang-dot'}
                onClick={() => setActive(i)}
                type="button"
              >
                {String(i + 1).padStart(2, '0')}
              </button>
            </li>
          ))}
        </ul>
        <div className="bang-canvas__actions">
          <Link className="bang-btn" href={items[active]?.href ?? browseHref}>
            {items[active]?.title ?? browseLabel}
          </Link>
          <Link className="bang-btn bang-btn--ghost" href={browseHref}>{browseLabel}</Link>
          {!reduced ? (
            <button className="bang-btn bang-btn--ghost" onClick={() => setPaused((p) => !p)} type="button" aria-pressed={paused}>
              {paused ? 'Play' : 'Pause'}
            </button>
          ) : null}
        </div>
      </div>
      <noscript>
        <ul>
          {items.map((w) => (
            <li key={w.href}><Link href={w.href}>{w.title}</Link></li>
          ))}
        </ul>
      </noscript>
      <span className="sr-only" id={`${id}-live`} aria-live="polite">
        {items[active]?.title}
      </span>
    </section>
  )
}
