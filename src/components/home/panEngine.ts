/**
 * The infinite canvas: wrapping, placement and momentum, with no DOM in sight.
 *
 * The field is a *torus*: the composition from `canvasPlan.ts` is repeated with a
 * period of `period` in both axes, and every tile's screen position is its authored
 * position wrapped into the canonical window `[-period/2, +period/2)` around the
 * viewport centre.
 *
 * Why the period is derived from the measured tiles instead of being a round number:
 * a tile may only jump from one edge to the other while it is completely outside the
 * viewport, otherwise the visitor sees a photograph teleport mid-screen. Copies of a
 * tile sit one period apart, so the guarantee is
 *
 *     period >= viewport + 2 * largestTile
 *
 * (`periodFor` below). Given that, at most one copy of any tile can intersect the
 * viewport, the jump happens strictly off-screen, and the field is continuous in both
 * directions with no end, no blank seam and no reset — while the DOM stays one element
 * per slot for the whole session.
 *
 * Distance grows without bound while panning, so `normalize` subtracts whole periods
 * from the offset once it drifts far from the origin. That is a no-op visually (the
 * field is periodic) and keeps float precision — and therefore the wrapping — exact
 * during sustained navigation.
 */

export type Vec = { x: number; y: number }

export type PanState = {
  /** Current position of the viewport's top-left corner in world px. */
  offset: Vec
  /** Where the easing is heading (wheel, keys, drag release). */
  target: Vec
  /** px per frame carried by a released drag, decayed by friction. */
  velocity: Vec
}

export const vec = (x: number, y: number): Vec => ({ x, y })

/** Friction applied to a released drag, per 16.67ms frame. */
export const FRICTION = 0.92
/** Wheel travel per notch: one wheel delta pans this fraction of itself. */
export const WHEEL_SPEED = 1
/** How much of the remaining distance an eased pan closes per frame. */
export const EASE = 0.14
/** A pointer that moved less than this (px) is a click, not a drag. */
export const DRAG_SLOP = 6
/** `normalize` kicks in past this distance from the origin (world px). */
const NORMALIZE_THRESHOLD = 1e6

export const createPanState = (): PanState => ({ offset: vec(0, 0), target: vec(0, 0), velocity: vec(0, 0) })

/**
 * Pull `value` into `[-period/2, +period/2)`. `Math.round` puts the seam exactly on
 * the window edge, which is the only place a jump is guaranteed to be invisible.
 */
export const wrapToWindow = (value: number, period: number): number =>
  period > 0 ? value - period * Math.round(value / period) : value

/**
 * The wrapping period for a measured field. `slack` keeps the seam a few px clear of
 * the tangency point (`period === viewport + 2 * tile`), where rounding could make a
 * jump flicker at the edge of the screen.
 */
export const periodFor = (viewport: Vec, largest: Vec, slack = 24): Vec =>
  vec(viewport.x + 2 * largest.x + slack, viewport.y + 2 * largest.y + slack)

export type Placement = {
  /** Offset (world px) to add to the tile so it lands inside the canonical window. */
  delta: Vec
  /** Screen position (px, origin = the viewport's top-left corner). */
  x: number
  y: number
  visible: boolean
}

/**
 * Where a tile goes on screen, given the current pan.
 *
 * `delta` is a whole number of periods, which is why it can be handed to a CSS
 * transform without ever changing the *composition* — the pattern the visitor sees is
 * always the same pattern, just shifted and wrapped.
 *
 * The canonical window is centred on the viewport, not on its top-left corner: that is
 * what makes both of its edges sit outside the screen (left edge at
 * `viewport/2 - period/2 <= -largestTile`, right edge at `viewport/2 + period/2 >=
 * viewport`), which in turn is what makes the jump invisible. See `periodFor`.
 */
export const place = (position: Vec, size: Vec, offset: Vec, viewport: Vec, period: Vec): Placement => {
  const rawX = position.x - offset.x
  const rawY = position.y - offset.y
  const delta = vec(
    -period.x * Math.round((rawX - viewport.x / 2) / period.x),
    -period.y * Math.round((rawY - viewport.y / 2) / period.y),
  )
  const x = rawX + delta.x
  const y = rawY + delta.y
  return {
    delta,
    visible: x < viewport.x && x + size.x > 0 && y < viewport.y && y + size.y > 0,
    x,
    y,
  }
}

/** Move the field by `delta` px (wheel, keys). Drag accumulates into the target too. */
export const panBy = (state: PanState, delta: Vec): PanState => ({
  offset: state.offset,
  target: vec(state.target.x + delta.x, state.target.y + delta.y),
  velocity: vec(0, 0),
})

/** Point the viewport at an absolute world position (a drag, which follows 1:1). */
export const panTo = (state: PanState, offset: Vec, velocity: Vec = vec(0, 0)): PanState => ({
  offset,
  target: offset,
  velocity,
})

/**
 * One animation frame. Eased pans close a fraction of the remaining distance (a
 * smooth, natural decelerate); a released drag keeps its velocity and bleeds it off by
 * friction. The returned `settled` flag is what lets the component stop its
 * `requestAnimationFrame` loop entirely instead of running one forever.
 */
export const step = (
  state: PanState,
  dtMs: number,
  options: { ease?: number; friction?: number; period?: Vec } = {},
): PanState & { settled: boolean } => {
  const ease = options.ease ?? EASE
  const friction = options.friction ?? FRICTION
  const frames = dtMs > 0 ? dtMs / (1000 / 60) : 0

  const velocity = vec(state.velocity.x * friction ** frames, state.velocity.y * friction ** frames)
  const target = vec(state.target.x + velocity.x * frames, state.target.y + velocity.y * frames)

  const next = vec(
    state.offset.x + (target.x - state.offset.x) * (1 - (1 - ease) ** frames),
    state.offset.y + (target.y - state.offset.y) * (1 - (1 - ease) ** frames),
  )

  const moving =
    Math.abs(target.x - next.x) > 0.05 ||
    Math.abs(target.y - next.y) > 0.05 ||
    Math.abs(velocity.x) > 0.05 ||
    Math.abs(velocity.y) > 0.05

  const settledState: PanState = moving
    ? { offset: next, target, velocity }
    : { offset: target, target, velocity: vec(0, 0) }

  return { ...(options.period ? normalize(settledState, options.period) : settledState), settled: !moving }
}

/**
 * Wrap the pan into the first period. Visually identical (the field is periodic) and
 * it is what keeps `place` exact during a long session on the canvas.
 */
export const normalize = (state: PanState, period: Vec): PanState => {
  if (Math.abs(state.offset.x) < NORMALIZE_THRESHOLD && Math.abs(state.offset.y) < NORMALIZE_THRESHOLD) return state
  const shift = vec(
    period.x > 0 ? period.x * Math.round(state.offset.x / period.x) : 0,
    period.y > 0 ? period.y * Math.round(state.offset.y / period.y) : 0,
  )
  return {
    offset: vec(state.offset.x - shift.x, state.offset.y - shift.y),
    target: vec(state.target.x - shift.x, state.target.y - shift.y),
    velocity: state.velocity,
  }
}
