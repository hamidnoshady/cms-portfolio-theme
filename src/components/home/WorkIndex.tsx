'use client'

/**
 * The canonical destination for every work on the home page.
 *
 * The canvas draws the same work more than once across its field (cells >= works) and
 * wraps those copies forever, so the field itself is hidden from assistive technology
 * and taken out of the tab order — otherwise a screen-reader or keyboard visitor would
 * meet the same project repeatedly, and a copy could be announced with the wrong
 * position. This index is the one place each work appears as a *destination*: real
 * links, in publishing order, with the facts that identify them.
 *
 * It is a section first and a disclosure second. The server renders the list in the
 * document flow, which is what a visitor without a script — or with
 * `prefers-reduced-motion`, or on a tenant that turned the canvas motion off — keeps:
 * there is no control to press, so nothing is hidden behind a script that never runs.
 * The button only appears once the canvas presentation has actually taken over, and
 * then the stylesheet folds the list behind it (`html[data-bang-index]`), the same
 * attribute pattern the custom cursor and the case-study overlay use.
 *
 * No JavaScript therefore never leaves a control that does nothing, and the states
 * cannot disagree: `data-bang-index` records the visitor's explicit choice, and its
 * absence means "whatever the presentation implies".
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { CanvasWork } from '@/components/home/canvasPlan'

const canvasIsLive = (): boolean => document.documentElement.dataset.bangCanvas === 'pan'

const explicitlyOpen = (): boolean => document.documentElement.dataset.bangIndex === 'open'

export const WorkIndex = ({
  browseHref,
  browseLabel,
  labels,
  works,
}: {
  browseHref: string
  browseLabel: string
  labels: { count: string; index: string }
  works: CanvasWork[]
}) => {
  /** The server renders the open section; the canvas presentation folds it on arrival. */
  const [expanded, setExpanded] = useState(true)
  /** Whether the canvas presentation owns the disclosure at all. */
  const [toggleable, setToggleable] = useState(false)

  /**
   * The canvas mode lives on the root element (set by `CanvasField`), so this follows
   * it from there instead of duplicating the media-query and pointer logic. An
   * observer, not a prop: the mode can change while the page is open (a reduced-motion
   * toggle, a pointer that appears), and the disclosure has to keep up.
   */
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      const live = canvasIsLive()
      setToggleable(live)
      setExpanded(!live || explicitlyOpen())
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributeFilter: ['data-bang-canvas', 'data-bang-index'] })
    return () => observer.disconnect()
  }, [])

  const toggle = () => {
    const root = document.documentElement
    if (!canvasIsLive()) return
    const next = !explicitlyOpen()
    if (next) root.dataset.bangIndex = 'open'
    else delete root.dataset.bangIndex
    // The attribute is the state the stylesheet reads; this keeps the button's own
    // `aria-expanded` in step with it in the same frame (the observer above covers
    // changes that come from anywhere else).
    setExpanded(next)
  }

  const label = (
    <>
      <span className="type-label">{labels.index}</span>
      <span aria-hidden="true" className="bang-index__count type-meta">
        {labels.count}
      </span>
    </>
  )

  return (
    <section aria-label={labels.index} className="bang-index" data-work-index="" id="bang-works">
      {toggleable ? (
        <button
          aria-controls="bang-works-list"
          aria-expanded={expanded}
          className="bang-index__summary bang-index__toggle"
          onClick={toggle}
          type="button"
        >
          {label}
        </button>
      ) : (
        <p className="bang-index__summary bang-index__label">{label}</p>
      )}
      <div className="bang-index__body" id="bang-works-list">
        <ol className="bang-index__list">
          {works.map((work, index) => (
            <li className="bang-index__item" key={work.id}>
              <Link className="bang-index__link" data-cursor="control" href={work.href}>
                <span aria-hidden="true" className="bang-index__number type-meta">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="bang-index__title">{work.title}</span>
                {work.meta ? <span className="bang-index__meta type-meta">{work.meta}</span> : null}
              </Link>
            </li>
          ))}
        </ol>
        <p className="bang-index__actions">
          <Link className="link-inline type-ui target-standalone" data-cursor="control" href={browseHref}>
            {browseLabel}
          </Link>
        </p>
      </div>
    </section>
  )
}
