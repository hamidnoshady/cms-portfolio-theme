'use client'

import { useEffect, useRef } from 'react'

/**
 * Shared custom cursor — a filled black square across Home and interior routes.
 *
 * - Default state: filled black square (`9px × 9px`, `#000000`, `0px` radius).
 * - Control state (`a`, `button`, `[role="button"]`, `[data-cursor="control"]`):
 *   larger filled black square (`17px × 17px`, `#000000`).
 * - Work state (`[data-cursor="work"]`): larger filled black square (`17px × 17px`)
 *   paired with the hovered work's title label, clamped inside the viewport.
 * - Text input state (`input`, `textarea`, `select`, `[contenteditable]`): hides the
 *   custom mark and yields to the native text caret.
 * - Disabled on coarse pointers (`(pointer: fine)` false), under
 *   `prefers-reduced-motion: reduce`, and while a case-study overlay dialog is open.
 */

const INTERACTIVE = 'a[href], button, summary, [role="button"], [data-cursor="control"]'
const TEXT_INPUT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'
const FOLLOW = 0.34
const EPSILON = 0.2

type CursorMode = 'control' | 'default' | 'input' | 'work'

const contextFor = (target: EventTarget | null): { label: string; mode: CursorMode } => {
  if (!(target instanceof Element)) return { label: '', mode: 'default' }
  if (target.closest(TEXT_INPUT)) return { label: '', mode: 'input' }
  const work = target.closest<HTMLElement>('[data-cursor="work"]')
  if (work) return { label: work.dataset.cursorLabel ?? '', mode: 'work' }
  if (target.closest(INTERACTIVE)) return { label: '', mode: 'control' }
  return { label: '', mode: 'default' }
}

export const CustomCursor = () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const node = ref.current
    const label = labelRef.current
    if (!node || !label) return

    const finePointer = window.matchMedia('(pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = document.documentElement
    let enabled: boolean | null = null
    let frame = 0
    let targetX = -100
    let targetY = -100
    let x = -100
    let y = -100
    let visible = false

    const clampLabelShift = (px: number, py: number) => {
      if (node.dataset.mode !== 'work' || !label.textContent) {
        label.style.removeProperty('--cursor-label-x')
        label.style.removeProperty('--cursor-label-y')
        return
      }
      const vw = window.innerWidth || 1440
      const vh = window.innerHeight || 900
      const labelWidth = Math.max(label.offsetWidth || 160, 120)
      const labelHeight = Math.max(label.offsetHeight || 28, 24)
      const flipX = px + 24 + labelWidth > vw - 12
      const flipY = py + labelHeight / 2 > vh - 12 || py - labelHeight / 2 < 12
      label.style.setProperty('--cursor-label-x', flipX ? 'calc(-100% - 16px)' : '16px')
      label.style.setProperty(
        '--cursor-label-y',
        flipY ? `${Math.min(Math.max(12 - py, -24), 24)}px` : '-50%',
      )
    }

    const paint = () => {
      frame = 0
      x += (targetX - x) * FOLLOW
      y += (targetY - y) * FOLLOW
      if (Math.hypot(targetX - x, targetY - y) > EPSILON) {
        frame = window.requestAnimationFrame(paint)
      } else {
        x = targetX
        y = targetY
      }
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      clampLabelShift(x, y)
    }

    const applyContext = (target: EventTarget | null) => {
      const next = contextFor(target)
      node.dataset.mode = next.mode
      if (label.textContent !== next.label) label.textContent = next.label
      if (next.mode === 'input') {
        node.dataset.hidden = 'true'
        root.dataset.bangCursor = 'input'
      } else if (enabled) {
        root.dataset.bangCursor = 'on'
        if (visible) delete node.dataset.hidden
      }
      clampLabelShift(x, y)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      targetX = event.clientX
      targetY = event.clientY
      if (!visible) {
        x = targetX
        y = targetY
        visible = true
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
      applyContext(event.target)
      if (!frame) frame = window.requestAnimationFrame(paint)
    }

    const onOver = (event: PointerEvent) => {
      applyContext(event.target)
    }

    const onLeave = (event: MouseEvent | PointerEvent) => {
      if ('relatedTarget' in event && event.relatedTarget !== null) return
      visible = false
      node.dataset.hidden = 'true'
    }

    const sync = () => {
      const next =
        finePointer.matches &&
        !reducedMotion.matches &&
        root.dataset.bangOverlay !== 'open'
      if (next === enabled) return
      enabled = next
      if (enabled) {
        node.dataset.enabled = 'true'
        node.dataset.mode = 'default'
        node.dataset.hidden = 'true'
        root.dataset.bangCursor = 'on'
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('pointerover', onOver, { passive: true })
        window.addEventListener('pointerout', onLeave, { passive: true })
        document.addEventListener('mouseleave', onLeave)
      } else {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        visible = false
        delete node.dataset.enabled
        node.dataset.hidden = 'true'
        root.dataset.bangCursor = 'off'
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerover', onOver)
        window.removeEventListener('pointerout', onLeave)
        document.removeEventListener('mouseleave', onLeave)
      }
    }

    sync()
    finePointer.addEventListener('change', sync)
    reducedMotion.addEventListener('change', sync)
    window.addEventListener('bang:overlay', sync)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      finePointer.removeEventListener('change', sync)
      reducedMotion.removeEventListener('change', sync)
      window.removeEventListener('bang:overlay', sync)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerout', onLeave)
      document.removeEventListener('mouseleave', onLeave)
      delete root.dataset.bangCursor
    }
  }, [])

  return (
    <div aria-hidden="true" className="bang-cursor" data-hidden="true" data-mode="default" ref={ref}>
      <span className="bang-cursor__mark" data-cursor-square="true" />
      <span className="bang-cursor__label" dir="auto" ref={labelRef} />
    </div>
  )
}
