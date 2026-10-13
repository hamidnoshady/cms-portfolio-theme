/**
 * The home canvas composition.
 *
 * The reference home page is not a slider: several works are visible at once,
 * scattered around a central wordmark, at different sizes, crops and depths, and the
 * page never ends when you keep moving it. This module is the *only* thing that
 * decides where a tile sits, and it is deliberately pure, deterministic and free of
 * DOM access so that:
 *
 *  - the server can place the tiles in CSS percentages (the composition exists before
 *    any JavaScript runs, and a no-JS or reduced-motion visitor gets the same field);
 *  - a rerender cannot move a tile ("do not reposition tiles on every render") —
 *    every value here is derived from the work's stable identity, never from
 *    `Math.random()`, a timestamp or the order in which a query answered;
 *  - the wrapping math in `panEngine.ts` can be unit-tested without a browser.
 *
 * ## One plane, one period
 *
 * The canvas is a torus: the composition repeats with a period of exactly one *plane*
 * — the element the tiles are laid out in (`.bang-canvas__world` in `components.css`,
 * which is `PLANE` viewports wide and tall). Because the period *is* the plane, a tile
 * that wraps by one period lands precisely on its own copy, so a wrap can never change
 * what the visitor sees.
 *
 * That is also why the composition has to cover the whole plane, and not just one
 * screenful. A composition that only filled the first screen looks complete at rest and
 * then leaves an empty frame the moment the visitor pans — the "blank seam" the
 * reference never shows. Coverage is not a happy accident here: the tiles sit in a
 * *filled* lattice of cells smaller than the viewport, jittered off the grid so the
 * field never reads as a grid, and `tests/home-canvas.test.ts` sweeps real offsets
 * through `place()` and asserts that a photograph is visible at every one of them.
 *
 * ## Why the sizes are what they are
 *
 * A tile may only jump while it is completely outside the viewport; `panEngine`'s
 * guarantee is `period >= viewport + 2 * largestTile`. With the period equal to the
 * plane that becomes a budget on the largest tile:
 *
 *     PLANE >= 1 + 2 * MAX_WIDTH * MOBILE_TILE_SCALE      (2 >= 1 + 2 * 0.19 * 1.2)
 *
 * `MAX_WIDTH` therefore stays well below a third of the plane even though the field
 * scales tiles up on phones (`--tile-scale` in the stylesheet, mirrored by
 * `MOBILE_TILE_SCALE`). Changing one of those numbers without the other reintroduces
 * teleports — which is exactly what the "no tile teleports while it is on screen" test
 * checks.
 *
 * Tiles repeat when there are fewer works than cells (the reference repeats its project
 * images across the canvas as well). A tile's identity comes from its slot and never
 * changes, so a repeated or recycled tile cannot open another work.
 */
import type { Media } from '@/lib/cms/types'

export type CanvasWork = {
  href: string
  id: string
  media: Media | null
  /** Short "year · type" line for the accessible index; never invented. */
  meta?: string
  title: string
}

export type CanvasTile = {
  /** Stable DOM key: slot order is fixed, so React never shuffles identities. */
  key: string
  /** Index into the works array — the tile's one true destination. */
  work: number
  /** Aspect ratio (inline / block) the frame is cropped to. */
  ratio: number
  /** Inline size, as a fraction of the plane. */
  width: number
  /** Left edge, as a fraction of the plane. */
  x: number
  /** Top edge, as a fraction of the plane. */
  y: number
  /** Paint order inside the canvas (1 = furthest back). */
  z: number
}

export type CanvasPlan = { tiles: CanvasTile[] }

/* --- stable hashing ------------------------------------------------------ */

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** FNV-1a: tiny, dependency-free and stable across engines. */
const hash = (value: string): number => {
  let digest = FNV_OFFSET
  for (let index = 0; index < value.length; index += 1) {
    digest ^= value.charCodeAt(index)
    digest = Math.imul(digest, FNV_PRIME) >>> 0
  }
  return digest >>> 0
}

/**
 * A deterministic 0..1 value for (`salt`, `value`). Every jitter uses it, so the same
 * work always lands in the same composition — and two slots never share a value,
 * because the salt includes the slot index.
 */
export const unitHash = (value: string, salt: string): number =>
  (hash(`${salt}\u0000${value}`) % 100_003) / 100_003

/* --- geometry constants -------------------------------------------------- */

/** The plane — and therefore the wrapping period — in viewports, both axes. */
export const PLANE = 2
/** Smallest and largest tile widths, as fractions of the plane. */
export const MIN_WIDTH = 0.105
export const MAX_WIDTH = 0.19
/**
 * How much the stylesheet scales every tile up on phones (`--tile-scale`). Mirrored
 * here because the wrapping budget has to account for the *rendered* tile.
 */
export const MOBILE_TILE_SCALE = 1.2
/** How far a tile may wander from its lattice cell, as a fraction of the cell. */
const JITTER = 0.3
/** How much of a cell's height the tiles' top edges are spread over: with cells no
    taller than a third of the plane this keeps consecutive tiles within the viewport
    of each other, which is what makes the coverage sweep pass. */
const CELL_SPREAD = 0.5
/** Crops applied to every third tile, so frames vary instead of every photo keeping
    its own ratio (`0.75` is the portrait crop). */
const PLAN_RATIOS = [1.5, 1, 0.75, 1.25] as const
const MIN_SOURCE_RATIO = 0.6
const MAX_SOURCE_RATIO = 2.4
const MIN_SLOTS = 8
/** Bounded field: at most this many tile elements exist, whatever the CMS holds. */
export const MAX_SLOTS = 20
/** Hop lengths used to shuffle repeats, coprime with the cell count where possible. */
const HOP_CANDIDATES = [5, 7, 3, 11, 13, 2, 1] as const

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * The ratio a tile is framed at: the photograph's own ratio clamped to a sane range,
 * except every third tile, which takes a deliberate crop from `PLAN_RATIOS`. Both are
 * functions of the slot, so the field mixes tall and wide frames deterministically.
 */
export const tileRatio = (media: Media | null, slot: number, identity: string): number => {
  if (slot % 3 === 2) return PLAN_RATIOS[slot % PLAN_RATIOS.length]!
  const width = typeof media?.width === 'number' && media.width > 0 ? media.width : null
  const height = typeof media?.height === 'number' && media.height > 0 ? media.height : null
  if (width && height) return clamp(width / height, MIN_SOURCE_RATIO, MAX_SOURCE_RATIO)
  return PLAN_RATIOS[(hash(identity) + slot) % PLAN_RATIOS.length]!
}

/** How many tiles the field holds: two per work, bounded at both ends. */
export const slotsFor = (workCount: number): number => clamp(workCount * 2, MIN_SLOTS, MAX_SLOTS)

/**
 * The lattice the tiles are placed in, rounded up to a filled grid: every cell holds
 * exactly one tile, because an empty cell is a hole the viewport could wander into.
 * The shape stays as close to square as the count allows, and never exceeds
 * `MAX_SLOTS`, so the field is bounded by construction.
 */
export const gridFor = (slots: number): { cols: number; rows: number } => {
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(slots))))
  return { cols, rows: Math.ceil(slots / cols) }
}

const greatestCommonDivisor = (a: number, b: number): number => (b === 0 ? a : greatestCommonDivisor(b, a % b))

/**
 * The whole home composition. No works → no tiles (the caller renders the empty state,
 * never a fabricated frame); otherwise the field is built once per (works) and never
 * again.
 */
export const planCanvas = (works: CanvasWork[]): CanvasPlan => {
  if (works.length === 0) return { tiles: [] }

  const { cols, rows } = gridFor(slotsFor(works.length))
  const cells = cols * rows
  // Spread repeats (cells > works) across the field instead of stacking them.
  const hop = HOP_CANDIDATES.find((candidate) => greatestCommonDivisor(candidate, cells) === 1) ?? 1
  const cellWidth = 1 / cols
  const cellHeight = 1 / rows

  const tiles = Array.from({ length: cells }, (_, slot) => {
    const workIndex = slot % works.length
    const work = works[workIndex]!
    const identity = work.id || work.href || work.title
    const cell = (slot * hop) % cells
    const column = cell % cols
    const row = Math.floor(cell / cols)

    // Size: anywhere in the budgeted range, chosen by the work's own hash, so the field
    // mixes small and large frames while every tile stays inside the wrapping budget.
    const width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * unitHash(identity, `width-${slot}`)

    // Position: inside the cell, centred and jittered off the lattice so no two tiles
    // share an edge, and clamped so the tile's own box stays inside the plane.
    const jitterX = (unitHash(identity, `jx-${slot}`) - 0.5) * cellWidth * JITTER
    const jitterY = unitHash(identity, `jy-${slot}`) * cellHeight * CELL_SPREAD
    const x = clamp(column * cellWidth + (cellWidth - width) / 2 + jitterX, 0, 1 - width)
    const y = clamp(row * cellHeight + jitterY, 0, 1)

    return {
      key: `${identity}-${slot}`,
      ratio: tileRatio(work.media, slot, identity),
      width,
      work: workIndex,
      x,
      y,
      z: 1 + Math.round(unitHash(identity, `z-${slot}`) * (cells - 1)),
    } satisfies CanvasTile
  })

  return { tiles }
}
