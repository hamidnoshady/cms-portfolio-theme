'use client'

import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import Link from 'next/link'
import { useEffect, useRef, type CSSProperties } from 'react'

import { PLANE, type CanvasPlan, type CanvasTile, type CanvasWork } from './canvasPlan'
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
} from './panEngine'
import { mediaAlt, mediaOriginAllowed, mediaSrcSet, mediaUrl } from '@/lib/utils/media'

gsap.registerPlugin(MotionPathPlugin)

const KEY_PAN = 140
const LINE_HEIGHT_PX = 18
const CRITICAL_MEDIA_TIMEOUT_MS = 1600
const INTRO_TOTAL_DURATION_S = 1.38

const wheelDelta = (event: WheelEvent, viewport: Vec): Vec => {
  const scale =
    event.deltaMode === 1
      ? LINE_HEIGHT_PX
      : event.deltaMode === 2
        ? Math.max(viewport.x, viewport.y)
        : 1
  return vec(event.deltaX * scale * WHEEL_SPEED, event.deltaY * scale * WHEEL_SPEED)
}

const keepsItsOwnScroll = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('[data-lenis-prevent], .bang-overlay, [role="dialog"]'))
}

const isInteractive = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('a, button, summary, input, textarea, select, [role="button"]'))
}

type MeasuredTile = {
  element: HTMLElement
  intro: HTMLElement | null
  media: HTMLElement | null
  grain: HTMLElement | null
  origin: Vec
  size: Vec
  tile: CanvasTile
}

const waitForCriticalMedia = (container: HTMLElement, timeoutMs = CRITICAL_MEDIA_TIMEOUT_MS): Promise<void> =>
  new Promise((resolve) => {
    const imgs = [...container.querySelectorAll<HTMLImageElement>('[data-primary-tile="true"] img')].slice(0, 4)
    const pending = imgs.filter((img) => !img.complete)
    if (pending.length === 0) {
      resolve()
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(finish, timeoutMs)
    let remaining = pending.length
    const onOne = () => {
      remaining -= 1
      if (remaining <= 0) finish()
    }
    for (const img of pending) {
      img.addEventListener('load', onOne, { once: true })
      img.addEventListener('error', onOne, { once: true })
    }
  })

export const CanvasField = ({
  brand = '',
  deploymentOrigin,
  mediaOrigin = '',
  motionEnabled = true,
  plan,
  works,
}: {
  brand?: string
  deploymentOrigin?: string
  mediaOrigin?: string
  motionEnabled?: boolean
  plan: CanvasPlan
  works: CanvasWork[]
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const tileRef = useRef<Map<string, HTMLElement>>(new Map())
  const introPlayedRef = useRef(false)
  const introActiveRef = useRef(false)

  const stateRef = useRef<PanState>(createPanState())
  const measuredRef = useRef<MeasuredTile[]>([])
  const viewportRef = useRef<Vec>(vec(0, 0))
  const periodRef = useRef<Vec>(vec(0, 0))
  const rafRef = useRef<null | number>(null)
  const lastFrameRef = useRef<number>(0)
  const liveRef = useRef<boolean>(false)
  const draggedRef = useRef<boolean>(false)
  const dragRef = useRef<null | {
    captured: boolean
    id: number
    moved: number
    origin: Vec
    pointer: Vec
    samples: { t: number; x: number; y: number }[]
  }>(null)

  useEffect(() => {
    const stage = stageRef.current
    const world = worldRef.current
    if (!stage || !world || typeof window === 'undefined') return

    const measure = () => {
      const s = stageRef.current
      const w = worldRef.current
      if (!s || !w) return

      const viewport = vec(s.clientWidth, s.clientHeight)
      const worldSize = vec(w.offsetWidth, w.offsetHeight)
      const tiles: MeasuredTile[] = []
      let largestX = 0
      let largestY = 0

      for (const tile of plan.tiles) {
        const element = tileRef.current.get(tile.key)
        if (!element) continue
        const size = vec(element.offsetWidth, element.offsetHeight)
        const origin = vec(tile.x * worldSize.x, tile.y * worldSize.y)
        largestX = Math.max(largestX, size.x)
        largestY = Math.max(largestY, size.y)
        tiles.push({
          element,
          grain: element.querySelector<HTMLElement>('[data-tile-grain]'),
          intro: element.querySelector<HTMLElement>('[data-tile-intro]'),
          media: element.querySelector<HTMLElement>('[data-tile-media]'),
          origin,
          size,
          tile,
        })
      }

      measuredRef.current = tiles
      viewportRef.current = viewport
      const plane = plan.plane ?? PLANE
      periodRef.current =
        plane > 1
          ? vec(
              Math.max(worldSize.x, viewport.x + 2 * largestX + 24),
              Math.max(worldSize.y, viewport.y + 2 * largestY + 24),
            )
          : periodFor(viewport, vec(largestX, largestY))
    }

    const layout = () => {
      const w = worldRef.current
      const period = periodRef.current
      const viewport = viewportRef.current
      const state = stateRef.current
      if (!w || viewport.x === 0 || viewport.y === 0) return

      w.style.transform = `translate3d(${-state.offset.x}px, ${-state.offset.y}px, 0)`

      for (const item of measuredRef.current) {
        const placed = place(item.origin, item.size, state.offset, viewport, period)
        item.element.style.transform =
          placed.delta.x === 0 && placed.delta.y === 0
            ? 'translate3d(0, 0, 0)'
            : `translate3d(${placed.delta.x}px, ${placed.delta.y}px, 0)`
        item.element.style.visibility = placed.visible ? 'visible' : 'hidden'
      }
    }

    const root = document.documentElement
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let dispose: (() => void) | null = null

    const run = () => {
      liveRef.current = true
      stateRef.current = createPanState()
      measure()
      layout()

      let introCtx: gsap.Context | null = null
      let hoverCleanup: (() => void)[] = []

      const attachHoverTimelines = () => {
        hoverCleanup.forEach((fn) => fn())
        hoverCleanup = []
        for (const item of measuredRef.current) {
          const { element, media, grain } = item
          if (!media) continue
          const onEnter = () => {
            if (introActiveRef.current || dragRef.current?.captured) return
            gsap.to(media, {
              duration: 0.42,
              ease: 'power2.out',
               overwrite: 'auto',
              scale: 1.035,
            })
            if (grain) {
              gsap.fromTo(
                grain,
                { opacity: 0.34 },
                { duration: 0.48, ease: 'power2.out', opacity: 0.12, overwrite: 'auto' },
              )
            }
          }
          const onLeave = () => {
            gsap.to(media, {
              duration: 0.36,
              ease: 'power2.out',
              overwrite: 'auto',
              scale: 1,
            })
            if (grain) {
              gsap.to(grain, { duration: 0.3, ease: 'power2.out', opacity: 0, overwrite: 'auto' })
            }
          }
          element.addEventListener('pointerenter', onEnter)
          element.addEventListener('pointerleave', onLeave)
          element.addEventListener('focus', onEnter)
          element.addEventListener('blur', onLeave)
          hoverCleanup.push(() => {
            element.removeEventListener('pointerenter', onEnter)
            element.removeEventListener('pointerleave', onLeave)
            element.removeEventListener('focus', onEnter)
            element.removeEventListener('blur', onLeave)
          })
        }
      }

      attachHoverTimelines()

      const startInteractiveMode = () => {
        introActiveRef.current = false
        root.dataset.bangCanvas = 'pan'
      }

      const finishIntro = () => {
        if (!introActiveRef.current) return
        introCtx?.revert()
        introCtx = null
        const wordmarks = document.querySelectorAll<HTMLElement>('[data-wordmark-layer]')
        const loader = loaderRef.current
        for (const item of measuredRef.current) {
          if (item.intro) {
            gsap.set(item.intro, { clearProps: 'x,y,scale,clipPath,opacity' })
          }
        }
        if (wordmarks.length > 0) {
          gsap.set(wordmarks, { clearProps: 'clipPath,scale,opacity' })
        }
        if (loader) {
          gsap.set(loader, { autoAlpha: 0 })
        }
        startInteractiveMode()
      }

      if (!introPlayedRef.current && measuredRef.current.length > 0 && root.dataset.bangOverlay !== 'open') {
        introPlayedRef.current = true
        introActiveRef.current = true
        root.dataset.bangCanvas = 'intro'

        const viewport = viewportRef.current
        const vcx = viewport.x / 2
        const vcy = viewport.y / 2

        introCtx = gsap.context(() => {
          const loader = loaderRef.current
          const wordmarks = document.querySelectorAll<HTMLElement>('[data-wordmark-layer]')

          for (const item of measuredRef.current) {
            if (!item.intro) continue
            const placed = place(item.origin, item.size, stateRef.current.offset, viewport, periodRef.current)
            if (placed.visible) {
              const tileCx = placed.x + item.size.x / 2
              const tileCy = placed.y + item.size.y / 2
              const dx = vcx - tileCx
              const dy = vcy - tileCy
              gsap.set(item.intro, {
                clipPath: 'circle(0% at 50% 50%)',
                opacity: 0,
                scale: 0.72,
                x: dx * 0.78,
                y: dy * 0.78,
              })
            } else {
              gsap.set(item.intro, { opacity: 0 })
            }
          }

          if (wordmarks.length > 0) {
            gsap.set(wordmarks, {
              clipPath: 'circle(14% at 50% 50%)',
              opacity: 0,
              scale: 0.94,
            })
          }
          if (loader) {
            gsap.set(loader, { autoAlpha: 1 })
          }

          void waitForCriticalMedia(stage, 320).then(() => {
            if (!liveRef.current) return
            const tl = gsap.timeline({
              defaults: { ease: 'power3.out' },
              onComplete: () => {
                for (const item of measuredRef.current) {
                  if (item.intro) {
                    gsap.set(item.intro, { clearProps: 'x,y,scale,clipPath,opacity' })
                  }
                }
                if (wordmarks.length > 0) {
                  gsap.set(wordmarks, { clearProps: 'clipPath,scale,opacity' })
                }
                if (loader) {
                  gsap.set(loader, { autoAlpha: 0 })
                }
                startInteractiveMode()
              },
            })

            if (loader) {
              tl.to(loader, { autoAlpha: 0, duration: 0.28, ease: 'power2.inOut' }, 0.16)
            }

            if (wordmarks.length > 0) {
              tl.to(
                wordmarks,
                {
                  clipPath: 'circle(125% at 50% 50%)',
                  duration: 0.52,
                  ease: 'expo.out',
                  opacity: 1,
                  scale: 1,
                },
                0.14,
              )
            }

            let visibleIndex = 0
            for (const item of measuredRef.current) {
              if (!item.intro) continue
              const placed = place(item.origin, item.size, stateRef.current.offset, viewport, periodRef.current)
              if (placed.visible) {
                const tileCx = placed.x + item.size.x / 2
                const tileCy = placed.y + item.size.y / 2
                const dx = vcx - tileCx
                const dy = vcy - tileCy
                const dist = Math.hypot(dx, dy) || 1
                const perpX = (-dy / dist) * item.tile.arc.bend * Math.min(viewport.x, viewport.y) * 0.24
                const perpY = (dx / dist) * item.tile.arc.bend * Math.min(viewport.x, viewport.y) * 0.24
                const startX = dx * 0.78
                const startY = dy * 0.78
                const midX = dx * 0.34 + perpX
                const midY = dy * 0.34 + perpY
                const delay = 0.26 + Math.min(visibleIndex, 7) * 0.065

                tl.to(
                  item.intro,
                  {
                    clipPath: 'circle(100% at 50% 50%)',
                    duration: 0.92,
                    ease: 'expo.out',
                    motionPath: {
                      curviness: 1.35,
                      path: [
                        { x: startX, y: startY },
                        { x: midX, y: midY },
                        { x: 0, y: 0 },
                      ],
                    },
                    opacity: 1,
                    scale: 1,
                  },
                  delay,
                )
                visibleIndex += 1
              } else {
                tl.to(item.intro, { duration: 0.4, opacity: 1 }, 0.85)
              }
            }

            tl.totalDuration(Math.min(tl.totalDuration(), INTRO_TOTAL_DURATION_S))
          })
        }, stage)
      } else {
        startInteractiveMode()
      }

      const tick = (now: number) => {
        rafRef.current = null
        if (!liveRef.current) return
        if (document.documentElement.dataset.bangOverlay === 'open') {
          lastFrameRef.current = 0
          stateRef.current = panTo(stateRef.current, stateRef.current.offset)
          return
        }
        const dt = lastFrameRef.current ? Math.min(64, now - lastFrameRef.current) : 16.67
        lastFrameRef.current = now
        const next = step(stateRef.current, dt, { period: periodRef.current })
        stateRef.current = next
        layout()
        if (!next.settled) rafRef.current = requestAnimationFrame(tick)
        else lastFrameRef.current = 0
      }

      const kick = () => {
        if (rafRef.current === null && liveRef.current) {
          lastFrameRef.current = 0
          rafRef.current = requestAnimationFrame(tick)
        }
      }

      const onResize = () => {
        measure()
        layout()
      }
      const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
      resize?.observe(stage)
      resize?.observe(world)

      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || keepsItsOwnScroll(event.target)) return
        if (document.documentElement.dataset.bangOverlay === 'open') return
        if (introActiveRef.current) finishIntro()
        event.preventDefault()
        stateRef.current = panBy(stateRef.current, wheelDelta(event, viewportRef.current))
        kick()
      }

      const releaseDrag = (pointerId: number) => {
        const drag = dragRef.current
        dragRef.current = null
        stage.removeAttribute('data-dragging')
        if (!drag || drag.id !== pointerId) return
        if (drag.captured && stage.hasPointerCapture?.(pointerId)) {
          stage.releasePointerCapture(pointerId)
        }
        if (drag.moved > DRAG_SLOP) {
          draggedRef.current = true
          const samples = drag.samples.slice(-3)
          const first = samples[0]
          const last = samples[samples.length - 1]
          const span = first && last ? last.t - first.t : 0
          const velocity =
            first && last && span > 0
              ? vec(((last.x - first.x) / span) * -16.7, ((last.y - first.y) / span) * -16.7)
              : vec(0, 0)
          stateRef.current = panTo(stateRef.current, stateRef.current.offset, velocity)
          kick()
        }
      }

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (introActiveRef.current) finishIntro()
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

      const onPointerMove = (event: PointerEvent) => {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        const dx = event.clientX - drag.pointer.x
        const dy = event.clientY - drag.pointer.y
        drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.origin.x, event.clientY - drag.origin.y))
        drag.pointer = vec(event.clientX, event.clientY)
        if (!drag.captured && drag.moved > DRAG_SLOP) {
          drag.captured = true
          stage.setAttribute('data-dragging', 'true')
          stage.setPointerCapture?.(event.pointerId)
        }
        drag.samples = [...drag.samples.slice(-4), { t: event.timeStamp, x: event.clientX, y: event.clientY }]
        stateRef.current = panTo(stateRef.current, vec(stateRef.current.offset.x - dx, stateRef.current.offset.y - dy))
        layout()
      }

      const onPointerUp = (event: PointerEvent) => releaseDrag(event.pointerId)
      const onPointerCancel = (event: PointerEvent) => releaseDrag(event.pointerId)

      const onClickCapture = (event: MouseEvent) => {
        if (!draggedRef.current) {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = null
          lastFrameRef.current = 0
          stateRef.current = panTo(stateRef.current, stateRef.current.offset)
          layout()
          return
        }
        draggedRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }

      const onOverlay = () => {
        if (document.documentElement.dataset.bangOverlay === 'open') {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = null
          lastFrameRef.current = 0
          stateRef.current = panTo(stateRef.current, stateRef.current.offset)
          layout()
        }
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
        if (isInteractive(event.target) || introActiveRef.current) return
        if (document.documentElement.dataset.bangOverlay === 'open') return
        const deltas: Record<string, Vec> = {
          ArrowDown: vec(0, KEY_PAN),
          ArrowLeft: vec(-KEY_PAN, 0),
          ArrowRight: vec(KEY_PAN, 0),
          ArrowUp: vec(0, -KEY_PAN),
        }
        const delta = deltas[event.key]
        if (!delta) return
        event.preventDefault()
        stateRef.current = panBy(stateRef.current, delta)
        kick()
      }

      const onTileFocusIn = (event: FocusEvent) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const tileEl = target.closest<HTMLElement>('[data-primary-tile="true"]')
        if (!tileEl) return
        const item = measuredRef.current.find((entry) => entry.element === tileEl)
        if (!item) return
        const viewport = viewportRef.current
        const placed = place(item.origin, item.size, stateRef.current.offset, viewport, periodRef.current)
        const marginX = Math.min(80, viewport.x * 0.1)
        const marginY = Math.min(72, viewport.y * 0.1)
        let dx = 0
        let dy = 0
        if (placed.x < marginX) dx = placed.x - marginX
        else if (placed.x + item.size.x > viewport.x - marginX) dx = placed.x + item.size.x - (viewport.x - marginX)
        if (placed.y < marginY) dy = placed.y - marginY
        else if (placed.y + item.size.y > viewport.y - marginY) dy = placed.y + item.size.y - (viewport.y - marginY)
        if (dx !== 0 || dy !== 0) {
          stateRef.current = panBy(stateRef.current, vec(dx, dy))
          kick()
        }
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

      const onDragStart = (event: DragEvent) => event.preventDefault()

      window.addEventListener('wheel', onWheel, { passive: false })
      stage.addEventListener('dragstart', onDragStart)
      stage.addEventListener('pointerdown', onPointerDown)
      stage.addEventListener('pointermove', onPointerMove)
      stage.addEventListener('pointerup', onPointerUp)
      stage.addEventListener('pointercancel', onPointerCancel)
      stage.addEventListener('click', onClickCapture, true)
      stage.addEventListener('focusin', onTileFocusIn)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('bang:overlay', onOverlay)
      document.addEventListener('visibilitychange', onVisibility)

      return () => {
        liveRef.current = false
        introActiveRef.current = false
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        introCtx?.revert()
        hoverCleanup.forEach((fn) => fn())
        resize?.disconnect()
        window.removeEventListener('wheel', onWheel)
        stage.removeEventListener('dragstart', onDragStart)
        stage.removeEventListener('pointerdown', onPointerDown)
        stage.removeEventListener('pointermove', onPointerMove)
        stage.removeEventListener('pointerup', onPointerUp)
        stage.removeEventListener('pointercancel', onPointerCancel)
        stage.removeEventListener('click', onClickCapture, true)
        stage.removeEventListener('focusin', onTileFocusIn)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('bang:overlay', onOverlay)
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
      delete root.dataset.bangCanvas
    }

    sync()
    motionQuery.addEventListener('change', sync)
    return () => {
      motionQuery.removeEventListener('change', sync)
      if (dispose) dispose()
      delete root.dataset.bangCanvas
    }
  }, [motionEnabled, plan])

  const eager = new Set(plan.tiles.slice(0, 4).map((tile) => tile.key))

  return (
    <div
      className="bang-canvas"
      data-canvas-field=""
      data-plane={plan.plane ?? PLANE}
      id="bang-works"
      ref={stageRef}
      style={{ '--bang-plane': plan.plane ?? PLANE } as CSSProperties}
    >
      <svg aria-hidden="true" className="bang-canvas__svg-defs" focusable="false">
        <defs>
          <filter id="bang-grain-filter" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              baseFrequency="0.8"
              numOctaves="2"
              result="noise"
              seed="7"
              stitchTiles="stitch"
              type="fractalNoise"
            />
            <feColorMatrix
              in="noise"
              result="monoNoise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.14 0"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
               result="displaced"
              scale="3"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feBlend in="displaced" in2="monoNoise" mode="multiply" />
          </filter>
        </defs>
      </svg>

      {brand ? (
        <div aria-hidden="true" className="bang-loader" ref={loaderRef}>
          <span className="bang-loader__mark">{brand}</span>
        </div>
      ) : null}

      <div className="bang-canvas__world" ref={worldRef}>
        {plan.tiles.map((tile) => {
          const work = works[tile.work]
          if (!work) return null
          const isPrimary = tile.primary
          const isEager = eager.has(tile.key)
          const src = mediaUrl(work.media, mediaOrigin)
          const allowed = [mediaOrigin, deploymentOrigin].filter((v): v is string => Boolean(v))
          const validSrc = src && mediaOriginAllowed(src, allowed) ? src : null
          const srcSet = validSrc ? mediaSrcSet(work.media, mediaOrigin) : undefined
          const altText = isPrimary ? mediaAlt(work.media, work.title) : ''

          return (
            <Link
              aria-hidden={isPrimary ? undefined : 'true'}
              aria-label={isPrimary ? work.title : undefined}
              className="bang-canvas__tile"
              data-cursor="work"
              data-cursor-label={work.title}
              data-primary-tile={isPrimary ? 'true' : undefined}
              data-slot={tile.slot}
              data-tile={tile.key}
              data-work={tile.work}
              data-zone={tile.zone ? 'true' : undefined}
              href={work.href}
              key={tile.key}
              prefetch={false}
              ref={(el) => {
                if (el) tileRef.current.set(tile.key, el)
                else tileRef.current.delete(tile.key)
              }}
              style={
                {
                  '--tile-ratio': tile.ratio,
                  '--tile-rotate': tile.rotate,
                  '--tile-w': tile.width,
                  '--tile-x': tile.x,
                  '--tile-y': tile.y,
                  '--tile-z': tile.z,
                } as CSSProperties
              }
              tabIndex={isPrimary ? undefined : -1}
            >
              <span className="bang-canvas__intro" data-tile-intro>
                <span className="bang-canvas__frame">
                  {validSrc ? (
                    <img
                      alt={altText}
                      className="bang-canvas__img"
                      data-tile-media
                      decoding={isEager ? 'sync' : 'async'}
                      draggable={false}
                      fetchPriority={isEager ? 'high' : 'auto'}
                      height={work.media?.height ?? undefined}
                      loading={isEager ? 'eager' : 'lazy'}
                      sizes="(min-width: 1024px) 26vw, (min-width: 640px) 42vw, 62vw"
                      src={validSrc}
                      srcSet={srcSet}
                      width={work.media?.width ?? undefined}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bang-canvas__placeholder media-missing"
                      data-media-state="missing"
                      data-tile-media
                    />
                  )}
                  <span aria-hidden="true" className="bang-canvas__grain" data-tile-grain />
                </span>
                <span className="bang-canvas__caption" dir="auto">
                  <span className="bang-canvas__title">{work.title}</span>
                  {work.meta ? <span className="bang-canvas__meta">{work.meta}</span> : null}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
