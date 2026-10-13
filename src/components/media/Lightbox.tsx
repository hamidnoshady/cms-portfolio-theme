'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import type { Locale } from '@/lib/cms/types'
import { formatNumber } from '@/lib/runtime'
import { cn } from '@/lib/utils/cn'
import type { LightboxItem } from '@/lib/utils/media'

export type { LightboxItem } from '@/lib/utils/media'

/**
 * The one lightbox.
 *
 * Every CMS content image — a gallery block, an inline media grid, a photograph in
 * the prose, the standalone media block — is a `LightboxTrigger` inside a
 * `LightboxScope`. The scope owns the item list and one Radix Dialog; a trigger only
 * says which index it is. So a project's content images open one sequence with
 * previous/next across all of them, and no view keeps a second static image
 * implementation.
 *
 * Radix supplies the dialog semantics (focus trap, Escape, scroll lock, outside
 * dismissal); Motion — the engine the home stage already uses — supplies the
 * restrained animation: a 260ms fade with a barely-there scale on open, reversed on
 * close, and a 300ms directional slide/fade between images. `prefers-reduced-motion`
 * collapses every duration and offset to zero, so the image simply changes.
 *
 * Direction is logical, not physical. "Next" advances along the reading direction,
 * so in Persian the next arrow points left and the next image arrives from the left;
 * the button label, its icon, its click, the Arrow keys and the slide all agree.
 *
 * Focus is returned by hand: Radix restores focus to a `Dialog.Trigger`, which these
 * buttons are not, so the scope remembers the element that opened it.
 */

export type LightboxLabels = { close: string; next: string; previous: string; title: string }

type LightboxState = { direction: 1 | -1; index: number; open: boolean }

type Scope = {
  items: LightboxItem[]
  open: (index: number, opener: HTMLElement | null) => void
}

const LightboxContext = createContext<Scope | null>(null)

const EASE = [0.22, 0.61, 0.36, 1] as const
/** Open/close: brief 220–300ms. */
const OPEN_SECONDS = 0.26
/** Image-to-image: brief 250–350ms. */
const SLIDE_SECONDS = 0.3
/** Horizontal travel of the image change: brief 8–16px. */
const SLIDE_PX = 14

/** Direction-aware Arrow keys: the key that advances along the reading direction. */
export const arrowAdvances = (key: string, locale: Locale): boolean | null => {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  return locale === 'fa' ? key === 'ArrowLeft' : key === 'ArrowRight'
}

export const LightboxScope = ({
  children,
  items,
  labels,
  locale,
}: {
  children: ReactNode
  items: LightboxItem[]
  labels: LightboxLabels
  locale: Locale
}) => {
  const [state, setState] = useState<LightboxState>({ direction: 1, index: 0, open: false })
  const openerRef = useRef<HTMLElement | null>(null)

  const open = useCallback(
    (index: number, opener: HTMLElement | null) => {
      if (index < 0 || index >= items.length) return
      openerRef.current = opener
      setState({ direction: 1, index, open: true })
    },
    [items.length],
  )

  const step = useCallback(
    (delta: 1 | -1) => {
      setState((current) => ({
        direction: delta,
        index: (current.index + delta + items.length) % items.length,
        open: current.open,
      }))
    },
    [items.length],
  )

  const setOpen = useCallback((next: boolean) => {
    setState((current) => (current.open === next ? current : { ...current, open: next }))
  }, [])

  const scope = useMemo<Scope>(() => ({ items, open }), [items, open])

  return (
    <LightboxContext.Provider value={scope}>
      {children}
      <Lightbox
        items={items}
        labels={labels}
        locale={locale}
        onOpenChange={setOpen}
        onStep={step}
        openerRef={openerRef}
        state={state}
      />
    </LightboxContext.Provider>
  )
}

/**
 * The clickable image. Renders a bare `<button>` around whatever is passed (a frame
 * with the image inside). Without a scope, or without an index (a medium whose URL
 * did not resolve), it degrades to a plain wrapper so the layout is unchanged and
 * nothing pretends to be interactive.
 */
export const LightboxTrigger = ({
  children,
  className,
  index,
  label,
  style,
}: {
  children: ReactNode
  className?: string
  index: number | undefined
  /** Accessible name when the content has no usable alt; defaults to the item's alt. */
  label?: string
  style?: CSSProperties
}) => {
  const scope = useContext(LightboxContext)
  const item = scope && index !== undefined ? scope.items[index] : undefined
  if (!scope || index === undefined || !item) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }
  return (
    <button
      aria-label={label ?? item.alt}
      className={cn('lightbox-trigger', className)}
      data-lightbox-index={index}
      onClick={(event) => scope.open(index, event.currentTarget)}
      style={style}
      type="button"
    >
      {children}
    </button>
  )
}

const Lightbox = ({
  items,
  labels,
  locale,
  onOpenChange,
  onStep,
  openerRef,
  state,
}: {
  items: LightboxItem[]
  labels: LightboxLabels
  locale: Locale
  onOpenChange: (open: boolean) => void
  onStep: (delta: 1 | -1) => void
  openerRef: RefObject<HTMLElement | null>
  state: LightboxState
}) => {
  const reduced = useReducedMotion() ?? false
  const rtl = locale === 'fa'
  // +1 moves along the reading direction: rightwards in LTR, leftwards in RTL.
  const sign = rtl ? -1 : 1
  const many = items.length > 1
  const active = items[state.index]
  const position = `${formatNumber(state.index + 1, locale)} / ${formatNumber(items.length, locale)}`

  const fade = { duration: reduced ? 0 : OPEN_SECONDS, ease: EASE }
  const slide = { duration: reduced ? 0 : SLIDE_SECONDS, ease: EASE }
  const travel = reduced ? 0 : SLIDE_PX
  const lift = reduced ? 0 : 6
  const scale = reduced ? 1 : 0.98
  // Reduced motion mounts everything already settled (`initial={false}`): a zero-length
  // animation would still paint one frame of the start state first.
  const hidden = reduced ? false : { opacity: 0 }
  const lifted = reduced ? false : { opacity: 0, scale, y: lift }

  // The incoming image enters from the side it is "coming from" and the outgoing one
  // leaves the other way; `custom` carries the direction of the last step.
  const variants = {
    center: { opacity: 1, x: 0 },
    enter: (direction: 1 | -1) => ({ opacity: 0, x: direction * sign * travel }),
    exit: (direction: 1 | -1) => ({ opacity: 0, x: -direction * sign * travel }),
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!many) return
    const forward = arrowAdvances(event.key, locale)
    if (forward === null) return
    event.preventDefault()
    onStep(forward ? 1 : -1)
  }

  // A click on the stage's empty surface (not the image, not a control) closes: the
  // content layer fills the viewport, so this is the backdrop as the visitor sees it.
  const onStageClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) onOpenChange(false)
  }

  const PreviousIcon = rtl ? ChevronRight : ChevronLeft
  const NextIcon = rtl ? ChevronLeft : ChevronRight

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={state.open}>
      <AnimatePresence>
        {state.open && active ? (
          // `forceMount` + AnimatePresence: Radix would unmount instantly; Motion keeps
          // the layer until the exit animation has played.
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                animate={{ opacity: 1 }}
                className="lightbox__overlay"
                exit={{ opacity: 0 }}
                initial={hidden}
                transition={fade}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              aria-describedby={undefined}
              asChild
              dir={rtl ? 'rtl' : 'ltr'}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                openerRef.current?.focus()
              }}
              onKeyDown={onKeyDown}
            >
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="lightbox"
                data-reduced-motion={reduced ? 'true' : undefined}
                exit={{ opacity: 0, scale, y: lift }}
                initial={lifted}
                transition={fade}
              >
                <DialogPrimitive.Title className="sr-only">{`${labels.title} — ${position}`}</DialogPrimitive.Title>
                <div
                  className="lightbox__stage"
                  data-direction={state.direction === 1 ? 'forward' : 'back'}
                  onClick={onStageClick}
                >
                  <AnimatePresence custom={state.direction} initial={false}>
                    <motion.img
                      alt={active.alt}
                      animate="center"
                      className="lightbox__image"
                      custom={state.direction}
                      draggable={false}
                      exit="exit"
                      height={active.height}
                      initial={reduced ? false : 'enter'}
                      key={`${active.id}-${state.index}`}
                      sizes="100vw"
                      src={active.src}
                      srcSet={active.srcSet}
                      transition={slide}
                      variants={variants}
                      width={active.width}
                    />
                  </AnimatePresence>
                </div>
                <div className="lightbox__bar">
                  {many ? (
                    <button
                      aria-label={labels.previous}
                      className="btn btn--square"
                      data-step="previous"
                      onClick={() => onStep(-1)}
                      type="button"
                    >
                      <PreviousIcon aria-hidden="true" size={18} strokeWidth={1.5} />
                    </button>
                  ) : null}
                  <span aria-live="polite" className="lightbox__counter type-meta">
                    {position}
                  </span>
                  {many ? (
                    <button
                      aria-label={labels.next}
                      className="btn btn--square"
                      data-step="next"
                      onClick={() => onStep(1)}
                      type="button"
                    >
                      <NextIcon aria-hidden="true" size={18} strokeWidth={1.5} />
                    </button>
                  ) : null}
                  <DialogPrimitive.Close aria-label={labels.close} className="btn btn--square" type="button">
                    <X aria-hidden="true" size={18} strokeWidth={1.5} />
                  </DialogPrimitive.Close>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
