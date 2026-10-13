'use client'

/**
 * The custom cursor.
 *
 * A small square that replaces the system pointer on hover-capable devices, grows into
 * a hairline frame carrying the hovered work's own title, and shrinks to a solid dot
 * over controls. It is a *visual state of the same pointer*: the element is
 * `aria-hidden`, `pointer-events: none` and never moved into the hit-testing path, so
 * it cannot swallow a click, and the label it shows is CMS content (the work's title),
 * never invented interface copy.
 *
 * It is deliberately not offered everywhere:
 *
 *  - coarse pointers (`(pointer: coarse)`, no mouse) keep the system cursor — a custom
 *    cursor that lags a finger is worse than none;
 *  - `prefers-reduced-motion: reduce` keeps the system cursor, because the follow
 *    animation is exactly the kind of motion the preference asks us to drop
 *    (`halo` → the tile's hover state in CSS still marks a work as interactive);
 *  - while a case study is open (`html[data-bang-overlay='open']`) the reading surface
 *    gets the system cursor back, and the cursor is re-enabled on close.
 *
 * The loop follows the pointer by easing a fraction of the remaining distance per
 * frame and *stops* when it arrives, so an idle pointer costs nothing.
 */
import { useEffect, useRef, useState } from 'react'

export type CursorMode = 'control' | 'default' | 'work'

/** Elements that take the "control" state: anything a click activates. */
const CONTROL_SELECTOR =
  'a[href], button, summary, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"]'
const FOLLOW = 0.24
const OVERLAY_STATE = 'bangOverlay'
/** `data-cursor` values the field annotates tiles with. */
const MODES = new Set<CursorMode>(['control', 'default', 'work'])

const modeOf = (target: EventTarget | null): { label: string; mode: CursorMode } => {
  if (!(target instanceof Element)) return { label: '', mode: 'default' }
  const annotated = target.closest<HTMLElement>('[data-cursor]')
  if (annotated) {
    const value = annotated.dataset.cursor as CursorMode | undefined
    return {
      label: annotated.dataset.cursorLabel?.trim() ?? '',
      mode: value && MODES.has(value) ? value : 'default',
    }
  }
  return { label: '', mode: target.closest(CONTROL_SELECTOR) ? 'control' : 'default' }
}

export const CustomCursor = () => {
  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<{ label: string; mode: CursorMode }>({ label: '', mode: 'default' })
  const rootRef = useRef<HTMLDivElement>(null)
  const pointRef = useRef({ x: -200, y: -200, tx: -200, ty: -200 })
  const frameRef = useRef<null | number>(null)
  const hiddenRef = useRef(true)

  useEffect(() => {
    const document_ = document.documentElement
    const fine = window.matchMedia('(pointer: fine)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const apply = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      const point = pointRef.current
      const element = rootRef.current
      if (!element) return
      element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
    }

    const follow = () => {
      frameRef.current = null
      const point = pointRef.current
      const dx = point.tx - point.x
      const dy = point.ty - point.y
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
        point.x = point.tx
        point.y = point.ty
        apply()
        return
      }
      point.x += dx * FOLLOW
      point.y += dy * FOLLOW
      apply()
      frameRef.current = requestAnimationFrame(follow)
    }

    const kick = () => {
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(follow)
    }

    /** The overlay marks the document itself, so the cursor can never be stale. */
    const overlayOpen = () => document_.dataset[OVERLAY_STATE] === 'open'

    const sync = () => {
      const on = fine.matches && !motion.matches && !overlayOpen()
      document_.dataset.bangCursor = on ? 'on' : 'off'
      setEnabled((current) => (current === on ? current : on))
      if (!on) apply()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!fine.matches || motion.matches || overlayOpen()) return
      const point = pointRef.current
      point.tx = event.clientX
      point.ty = event.clientY
      if (hiddenRef.current) {
        hiddenRef.current = false
        point.x = event.clientX
        point.y = event.clientY
      }
      kick()
    }

    const onPointerOver = (event: PointerEvent) => {
      if (overlayOpen()) return
      const next = modeOf(event.target)
      setState((current) =>
        current.mode === next.mode && current.label === next.label ? current : next,
      )
    }

    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return
      hiddenRef.current = true
      rootRef.current?.setAttribute('data-hidden', '')
    }

    const onPointerIn = () => {
      rootRef.current?.removeAttribute('data-hidden')
    }

    const onKeyDown = () => {
      // A keyboard visitor is not pointing anywhere; park the cursor until they move
      // the pointer again instead of leaving a stray square on the page.
      hiddenRef.current = true
      rootRef.current?.setAttribute('data-hidden', '')
    }

    apply()
    sync()
    fine.addEventListener('change', sync)
    motion.addEventListener('change', sync)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerover', onPointerOver, { passive: true })
    window.addEventListener('pointerout', onPointerOut, { passive: true })
    window.addEventListener('pointerin', onPointerIn, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('bang:overlay', sync)
    return () => {
      fine.removeEventListener('change', sync)
      motion.removeEventListener('change', sync)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerover', onPointerOver)
      window.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('pointerin', onPointerIn)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('bang:overlay', sync)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      delete document_.dataset.bangCursor
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="bang-cursor"
      data-enabled={enabled ? '' : undefined}
      data-mode={state.mode}
      ref={rootRef}
    >
      <span className="bang-cursor__mark" />
      {state.mode === 'work' && state.label ? <span className="bang-cursor__label">{state.label}</span> : null}
    </div>
  )
}
