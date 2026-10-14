'use client'

/**
 * The home canvas field.
 *
 * One element per slot, positioned from the plan in `canvasPlan.ts`; panning writes
 * two styles per frame (the world's translation and, for the tiles that cross the
 * seam, a whole-period correction). Nothing is mounted or unmounted while the visitor
 * moves: the DOM is exactly `slots` links for the entire session, which is what keeps
 * memory, paint and — more importantly — work identity stable. A tile's `href` comes
 * from its slot and never changes, so wrapping and recycling cannot send a click to
 * the wrong project.
 *
 * Interaction (all of it optional, all of it removable — see `docs/BANG-REFERENCE.md`
 * for what was observed on the reference and what was inferred):
 *
 *  - wheel / trackpad pans, with the delta falling through to the eased target, so the
 *    pointer keeps its expected relationship with the page;
 *  - pointer drag (mouse, pen and touch through one code path) moves the field 1:1 and
 *    carries its velocity into a friction decay on release;
 *  - a drag that moved more than `DRAG_SLOP` swallows the click that follows it, so
 *    panning can never open a case study by accident;
 *  - arrow keys pan when focus is not inside a control, so the canvas is navigable
 *    without a pointer;
 *  - motion stops completely when the tab is hidden or the canvas is off screen, and
 *    the `requestAnimationFrame` loop *ends* when the field settles instead of
 *    running forever.
 *
 * Accessibility: the field is a duplicate surface (slots >= works), so it is hidden
 * from assistive technology and its links are removed from the tab order — the single
 * canonical destination for every work is the selected-work index rendered by
 * `WorkIndex`, which is the next tab stop. Touch keeps pinch-zoom (`touch-action:
 * pinch-zoom`) while the drag is ours.
 *
 * Without JavaScript, or with `prefers-reduced-motion: reduce`, or when the CMS turns
 * the canvas motion off, the same server-rendered composition is shown statically and
 * the page behaves as a normal scrolling document (see the `html[data-bang-canvas]`
 * rules in `components.css`).
 */
import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'

import { CmsImage } from '@/components/media/CmsImage'
import type { CanvasPlan } from '@/components/home/canvasPlan'
import { CustomCursor } from '@/components/home/CustomCursor'
import {
  createPanState,
  DRAG_SLOP,
  panBy,
  panTo,
  periodFor,
  place,
  step,
  vec,
  WHEEL_SPEED,
  type PanState,
  type Vec,
} from '@/components/home/panEngine'

const KEY_PAN = 140

type Box = { position: Vec; size: Vec }

/** Marks the document while the canvas is the primary surface. */
export const CANVAS_MODE_ATTRIBUTE = 'bangCanvas'

/**
 * Surfaces that keep their own scrolling: the open case study, the expanded
 * selected-work panel. Wheel events over these must not pan the field.
 */
const SCROLLABLE_SELECTOR = '[data-scrollable], .bang-overlay, .bang-index__body'

const keepsItsOwnScroll = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(SCROLLABLE_SELECTOR) !== null

const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [contenteditable="true"]') !== null

/** Wheel deltas arrive in pixels, lines or pages depending on the device. */
const wheelDelta = (event: WheelEvent, viewport: Vec): Vec => {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.y : 1
  return vec(event.deltaX * scale * WHEEL_SPEED, event.deltaY * scale * WHEEL_SPEED)
}

export const CanvasField = ({
  motionEnabled,
  plan,
  mediaOrigin,
  works,
}: {
  motionEnabled: boolean
  plan: CanvasPlan
  mediaOrigin: string
  works: { href: string; id: string; media: Parameters<typeof CmsImage>[0]['media']; title: string }[]
}) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<PanState>(createPanState())
  const boxesRef = useRef(new Map<string, Box>())
  const periodRef = useRef<Vec>(vec(0, 0))
  const viewportRef = useRef<Vec>(vec(0, 0))
  const rafRef = useRef<null | number>(null)
  const dragRef = useRef<null | {
    /** Whether this gesture has become a pan and taken the pointer. */
    captured: boolean
    id: number
    moved: number
    origin: Vec
    pointer: Vec
    samples: Array<{ t: number; x: number; y: number }>
  }>(null)
  /** True from the moment a gesture starts moving the field, so its click is ignored. */
  const draggedRef = useRef(false)
  const liveRef = useRef(false)

  /** Tile elements by slot key, so the frame loop never queries the DOM. */
  const tileRef = useRef(new Map<string, HTMLElement>())

  const layout = useCallback(() => {
    const world = worldRef.current
    const period = periodRef.current
    const viewport = viewportRef.current
    const state = stateRef.current
    if (!world || period.x <= 0) return
    world.style.transform = `translate3d(${-state.offset.x}px, ${-state.offset.y}px, 0)`
    for (const [key, element] of tileRef.current) {
      const box = boxesRef.current.get(key)
      if (!box) continue
      const { delta, visible } = place(box.position, box.size, state.offset, viewport, period)
      element.style.transform = delta.x === 0 && delta.y === 0 ? '' : `translate3d(${delta.x}px, ${delta.y}px, 0)`
      element.style.visibility = visible ? '' : 'hidden'
    }
  }, [])

  /** Measure the real boxes: percentages in CSS, pixels in the wrapping math. */
  const measure = useCallback(() => {
    const stage = stageRef.current
    const world = worldRef.current
    if (!stage || !world) return
    const rect = stage.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    viewportRef.current = vec(rect.width, rect.height)
    let largest = vec(0, 0)
    for (const [key, element] of tileRef.current) {
      const box = {
        position: vec(element.offsetLeft, element.offsetTop),
        size: vec(element.offsetWidth, element.offsetHeight),
      }
      boxesRef.current.set(key, box)
      largest = vec(Math.max(largest.x, box.size.x), Math.max(largest.y, box.size.y))
    }
    /**
     * The period is the plane itself (`.bang-canvas__world`, `--bang-plane` viewports
     * across): the composition is laid out in that element, so wrapping by one period
     * lands a tile exactly on its own copy. Measuring it — rather than assuming a round
     * number — keeps that true through zoom, a breakpoint change and the phone scale.
     */
    periodRef.current = vec(world.offsetWidth, world.offsetHeight)
    if (process.env.NODE_ENV !== 'production') {
      // `place` only jumps a tile while it is off screen when the period is at least
      // `viewport + 2 * largestTile`; the field sizes itself so that always holds, and
      // a warning here is cheaper than a teleport nobody can reproduce.
      const budget = periodFor(viewportRef.current, largest, 0)
      if (budget.x > periodRef.current.x || budget.y > periodRef.current.y) {
        console.warn(
          `[theme] home canvas: a ${largest.x.toFixed(0)}x${largest.y.toFixed(0)}px tile needs a ${budget.x.toFixed(0)}x${budget.y.toFixed(0)}px period, but the plane is ${periodRef.current.x}x${periodRef.current.y}px — check --bang-plane, MAX_WIDTH and the phone scale together.`,
        )
      }
    }
  }, [])

  /** Install the field's own listeners; all of them are removed on teardown. */
  useEffect(() => {
    const stage = stageRef.current
    const root = document.documentElement
    if (!stage) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    /** Null while the canvas is live (see `liveRef`), a teardown when it is static. */
    let dispose: (() => void) | null = null

    const run = () => {
      liveRef.current = true
      root.dataset[CANVAS_MODE_ATTRIBUTE] = 'pan'
      measure()
      layout()

      /**
       * The animation loop, declared in the effect so it is created and torn down with
       * the listeners. It ends the moment the field settles, which is what keeps an
       * idle canvas free of a permanent `requestAnimationFrame`.
       */
      let last = 0
      function tick(time: number) {
        rafRef.current = null
        const dt = last === 0 ? 16.7 : Math.min(48, time - last)
        last = time
        const next = step(stateRef.current, dt, { period: periodRef.current })
        stateRef.current = next
        layout()
        if (!next.settled && liveRef.current) rafRef.current = requestAnimationFrame(tick)
      }

      /** True while a work is open over the canvas (see the observer below). */
      const overlayPaused = () => document.documentElement.dataset.bangOverlay === 'open'

      const kick = () => {
        if (!liveRef.current || rafRef.current !== null || overlayPaused()) return
        last = 0
        rafRef.current = requestAnimationFrame(tick)
      }

      // Both observers are feature-detected: a browser without them (and the jsdom
      // suite) simply pans without pausing or re-measuring, which is still correct.
      const observer =
        typeof IntersectionObserver === 'undefined'
          ? null
          : new IntersectionObserver(
              (entries) => {
                const onScreen = entries.some((entry) => entry.isIntersecting)
                if (onScreen === liveRef.current) return
                liveRef.current = onScreen
                if (onScreen) {
                  measure()
                  layout()
                  kick()
                } else if (rafRef.current !== null) {
                  cancelAnimationFrame(rafRef.current)
                  rafRef.current = null
                  stateRef.current = panTo(stateRef.current, stateRef.current.offset)
                }
              },
              { threshold: 0.01 },
            )
      observer?.observe(stage)

      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
        measure()
        layout()
      })
      resize?.observe(stage)

      /**
       * A work opened over the canvas freezes it. The case study is a reading surface,
       * and the field behind it must not keep gliding out from under it — "closing
       * restores the canvas context" is only true if nothing moved meanwhile. The field
       * keeps its position (nothing is reset) and carries on from there when the
       * overlay closes.
       */
      const overlayObserver =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver(() => {
              if (!overlayPaused()) {
                measure()
                layout()
                kick()
                return
              }
              if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
              rafRef.current = null
              stateRef.current = panTo(stateRef.current, stateRef.current.offset)
              layout()
            })
      overlayObserver?.observe(document.documentElement, { attributeFilter: ['data-bang-overlay'] })

      /**
       * Bound to the window, not to the field: the reference's home page *is* the
       * canvas, so a wheel anywhere on it — over the chrome, the wordmark or the
       * footer — moves the field, and nothing else on the page scrolls. Panels that
       * do have their own scroll (the open case study, the expanded index) are left
       * alone, as is a pinch-zoom gesture.
       */
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || keepsItsOwnScroll(event.target)) return
        if (document.documentElement.dataset.bangOverlay === 'open') return
        event.preventDefault()
        stateRef.current = panBy(stateRef.current, wheelDelta(event, viewportRef.current))
        kick()
      }

      const releaseDrag = (pointerId: number) => {
        const drag = dragRef.current
        dragRef.current = null
        if (!drag || drag.id !== pointerId) return
        if (drag.captured && stage.hasPointerCapture?.(pointerId)) stage.releasePointerCapture(pointerId)
        if (drag.moved > DRAG_SLOP) {
          // A pan, not a click: the click the browser is about to dispatch belongs to
          // this gesture and is swallowed in `onClickCapture` below. No timer decides
          // it — the next gesture clears the flag, so a tap that follows a pan always
          // opens its work.
          draggedRef.current = true
          const samples = drag.samples.slice(-3)
          const first = samples[0]
          const last = samples[samples.length - 1]
          const span = first && last ? last.t - first.t : 0
          const velocity =
            first && last && span > 0 ? vec(((last.x - first.x) / span) * -16.7, ((last.y - first.y) / span) * -16.7) : vec(0, 0)
          stateRef.current = panTo(stateRef.current, stateRef.current.offset, velocity)
          kick()
        }
      }

      /**
       * The pointer is *not* captured here. Capturing on `pointerdown` would retarget
       * the click that follows a plain press, and a project image would stop being a
       * link: a click has to be able to open a work. The capture is taken by
       * `onPointerMove`, once the gesture has actually started panning.
       */
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        // A new gesture can always click: only the gesture that panned is suppressed.
        draggedRef.current = false
        dragRef.current = {
          captured: false,
          id: event.pointerId,
          moved: 0,
          origin: vec(event.clientX, event.clientY),
          pointer: vec(event.clientX, event.clientY),
          samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
        }
      }

      /**
       * The drag is the source of truth: the field follows the pointer 1:1 (no easing,
       * so it feels attached to the hand) and the samples kept here become the release
       * velocity. The browser's own click still fires afterwards — `onClickCapture`
       * is what stops a pan from opening a work.
       */
      const onPointerMove = (event: PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        const dx = event.clientX - drag.pointer.x
        const dy = event.clientY - drag.pointer.y
        drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.origin.x, event.clientY - drag.origin.y))
        drag.pointer = vec(event.clientX, event.clientY)
        if (!drag.captured && drag.moved > DRAG_SLOP) {
          // Now it is a pan, not a press: keep receiving moves even if the pointer
          // leaves the field, and take the click away in `onClickCapture`.
          drag.captured = true
          stage.setPointerCapture?.(event.pointerId)
        }
        drag.samples = [...drag.samples.slice(-4), { t: event.timeStamp, x: event.clientX, y: event.clientY }]
        stateRef.current = panTo(stateRef.current, vec(stateRef.current.offset.x - dx, stateRef.current.offset.y - dy))
        layout()
      }

      const onPointerUp = (event: PointerEvent) => releaseDrag(event.pointerId)
      const onPointerCancel = (event: PointerEvent) => releaseDrag(event.pointerId)

      const onClickCapture = (event: MouseEvent) => {
        if (!draggedRef.current) return
        draggedRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
        if (isInteractive(event.target)) return
        if (document.documentElement.dataset.bangOverlay === 'open') return
        const deltas: Record<string, Vec> = {
          ArrowDown: vec(0, KEY_PAN),
          ArrowLeft: vec(KEY_PAN, 0),
          ArrowRight: vec(-KEY_PAN, 0),
          ArrowUp: vec(0, -KEY_PAN),
        }
        const delta = deltas[event.key]
        if (!delta) return
        event.preventDefault()
        stateRef.current = panBy(stateRef.current, delta)
        kick()
      }

      const onVisibility = () => {
        if (document.hidden) {
          liveRef.current = false
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = null
          stateRef.current = panTo(stateRef.current, stateRef.current.offset)
        } else {
          liveRef.current = true
          measure()
          layout()
        }
      }

      /** A native image drag would cancel the gesture the visitor started. */
      const onDragStart = (event: DragEvent) => event.preventDefault()

      window.addEventListener('wheel', onWheel, { passive: false })
      stage.addEventListener('dragstart', onDragStart)
      stage.addEventListener('pointerdown', onPointerDown)
      stage.addEventListener('pointermove', onPointerMove)
      stage.addEventListener('pointerup', onPointerUp)
      stage.addEventListener('pointercancel', onPointerCancel)
      stage.addEventListener('click', onClickCapture, true)
      window.addEventListener('keydown', onKeyDown)
      document.addEventListener('visibilitychange', onVisibility)

      return () => {
        liveRef.current = false
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        observer?.disconnect()
        overlayObserver?.disconnect()
        resize?.disconnect()
        window.removeEventListener('wheel', onWheel)
        stage.removeEventListener('dragstart', onDragStart)
        stage.removeEventListener('pointerdown', onPointerDown)
        stage.removeEventListener('pointermove', onPointerMove)
        stage.removeEventListener('pointerup', onPointerUp)
        stage.removeEventListener('pointercancel', onPointerCancel)
        stage.removeEventListener('click', onClickCapture, true)
        window.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }

    const sync = () => {
      const shouldRun = motionEnabled && !motionQuery.matches
      if (shouldRun && !dispose) {
        dispose = run()
        return
      }
      if (shouldRun) return
      // Static presentation: the composition is served as-is, the document scrolls
      // normally and the selected-work index is an ordinary section in the flow.
      if (dispose) {
        dispose()
        dispose = null
        liveRef.current = false
        worldRef.current?.style.removeProperty('transform')
        for (const element of tileRef.current.values()) {
          element.style.removeProperty('transform')
          element.style.removeProperty('visibility')
        }
      }
      delete root.dataset[CANVAS_MODE_ATTRIBUTE]
    }

    sync()
    motionQuery.addEventListener('change', sync)
    return () => {
      motionQuery.removeEventListener('change', sync)
      if (dispose) dispose()
      delete root.dataset[CANVAS_MODE_ATTRIBUTE]
    }
  }, [layout, measure, motionEnabled])

  // Only the first tiles are eagerly loaded: they are the ones above the fold.
  const eager = new Set(plan.tiles.slice(0, 4).map((tile) => tile.key))

  return (
    <>
      <div
        aria-hidden="true"
        className="bang-canvas"
        data-canvas-field=""
        ref={stageRef}
        style={{ touchAction: 'pinch-zoom' }}
      >
        <div className="bang-canvas__world" ref={worldRef}>
          {plan.tiles.map((tile) => {
            const work = works[tile.work]
            if (!work) return null
            return (
              <Link
                className="bang-canvas__tile"
                data-cursor="work"
                data-cursor-label={work.title}
                data-tile={tile.key}
                data-zone={tile.zone ? '' : undefined}
                href={work.href}
                key={tile.key}
                // A canvas click is a *client* navigation: it is what lets the case
                // study open over the field (the intercepted route in
                // `src/app/@overlay`) instead of replacing the page and losing the
                // visitor's place on it. Prefetching is off because the field holds a
                // bounded but repeated set of the same few works.
                prefetch={false}
                ref={(element) => {
                  if (element) tileRef.current.set(tile.key, element)
                  else tileRef.current.delete(tile.key)
                }}
                style={
                  {
                    '--tile-ratio': String(tile.ratio),
                    '--tile-rotate': String(tile.rotate),
                    '--tile-w': String(tile.width),
                    '--tile-x': String(tile.x),
                    '--tile-y': String(tile.y),
                    zIndex: tile.z,
                  } as React.CSSProperties
                }
                tabIndex={-1}
              >
                <CmsImage
                  alt=""
                  className="bang-canvas__image"
                  media={work.media}
                  origin={mediaOrigin}
                  priority={eager.has(tile.key)}
                  ratio={String(tile.ratio)}
                  sizes="(min-width: 1024px) 40vw, 60vw"
                />
              </Link>
            )
          })}
        </div>
      </div>
      <CustomCursor />
    </>
  )
}
