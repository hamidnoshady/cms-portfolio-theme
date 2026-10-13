import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Decorative drafting marks — the ornament half of the line system.
 *
 * Server-rendered SVG with no client state: no effect per mark, no animation loop, no
 * canvas, and no randomness (placement is deterministic from the variant + the
 * wrapper's class). Wrappers position it absolutely, so a mark never participates in
 * layout sizing and cannot push text; it is `aria-hidden` and `pointer-events: none`.
 *
 * Lengths follow the design brief: dashes 12–24px, corner arms 10–18px, ticks 8–16px.
 * Density scales down on mobile via the wrapper (`mark--desktop-only`) rather than by
 * re-rendering a different tree.
 */

export type MarkVariant =
  | 'corner'          // two arms, for the inside corner of a framed image
  | 'crosshair'       // small plus, near a page title
  | 'dash'            // short horizontal dash
  | 'offset-l'        // asymmetric elbow, for desktop whitespace
  | 'pair'            // two parallel dashes, beside a filter label
  | 'tick'            // short vertical tick

const paths: Record<MarkVariant, { d: string; height: number; width: number }> = {
  corner: { d: 'M0.5 12V0.5H12', height: 12, width: 12 },
  crosshair: { d: 'M6 0.5V11.5M0.5 6H11.5', height: 12, width: 12 },
  dash: { d: 'M0.5 0.5H20', height: 1, width: 20 },
  'offset-l': { d: 'M0.5 0V14M0.5 14H14', height: 14, width: 14 },
  pair: { d: 'M0.5 0.5H14M0.5 5.5H8', height: 6, width: 14 },
  tick: { d: 'M0.5 0V12', height: 12, width: 1 },
}

export const DecorativeMark = ({
  className,
  style,
  variant = 'dash',
}: {
  className?: string
  style?: CSSProperties
  variant?: MarkVariant
}) => {
  const shape = paths[variant]
  return (
    <span aria-hidden="true" className={cn('mark', className)} data-mark={variant} style={style}>
      <svg
        fill="none"
        height={shape.height}
        stroke="currentColor"
        // The decorative width token, not a literal: one variable tunes every mark.
        style={{ strokeWidth: 'var(--line-w-decor)' }}
        vectorEffect="non-scaling-stroke"
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        width={shape.width}
      >
        <path d={shape.d} />
      </svg>
    </span>
  )
}
