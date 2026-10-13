/**
 * The home canvas composition.
 *
 * The reference home page is not a slider: several works are visible at once,
 * *scattered* around a central wordmark in loose groups of photographs — one large
 * frame with smaller ones tucked around it, at different sizes, crops, angles and
 * depths — and the page never ends when you keep moving it. This module is the *only*
 * thing that decides where a tile sits, and it is deliberately pure, deterministic and
 * free of DOM access so that:
 *
 *  - the server can place the tiles in CSS percentages (the composition exists before
 *    any JavaScript runs, and a no-JS or reduced-motion visitor gets the same field);
 *  - a rerender cannot move a tile ("do not reposition tiles on every render", "do not
 *    randomly reposition tiles on every render") — every value here is derived from the
 *    work's stable identity and its slot, never from `Math.random()`, a timestamp or
 *    the order in which a query answered;
 *  - the wrapping math in `panEngine.ts` can be unit-tested without a browser.
 *
 * ## The grouping
 *
 * Tiles are not laid out in a lattice. They are gathered into *clusters* — an anchor
 * plus one lead photograph and a ring of smaller ones around it — and the anchors are
 * spread across the plane so that a moving window always has a group in it. Two of the
 * anchors sit inside the window a visitor sees on load, which is why the first screen
 * reads as a composed spread rather than as a single photograph in the corner. The
 * angles inside a cluster are a golden-angle spiral, which distributes satellites
 * evenly without ever lining them up into rows or columns — the reason the field never
 * reads as a grid.
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
 * reference never shows. Coverage is not a happy accident here: `tests/home-canvas.test.ts`
 * sweeps real offsets through `place()` and asserts that a photograph is visible at
 * every one of them, for several archive sizes and four viewports.
 *
 * ## Why the sizes are what they are
 *
 * A tile may only jump while it is completely outside the viewport; `panEngine`'s
 * guarantee is `period >= viewport + 2 * largestTile`. With the period equal to the
 * plane that becomes a budget on the largest tile:
 *
 *     PLANE >= 1 + 2 * MAX_WIDTH * MOBILE_TILE_SCALE      (2 >= 1 + 2 * 0.17 * 1.2)
 *
 * `MAX_WIDTH` therefore stays below a third of the plane even though the field scales
 * tiles up on phones (`--tile-scale` in the stylesheet, mirrored by `MOBILE_TILE_SCALE`).
 * Changing one of those numbers without the other reintroduces teleports — which is
 * exactly what the "no tile teleports while it is on screen" test checks.
 *
 * Tiles repeat when there are fewer works than slots (the reference repeats its project
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
  /** True for a frame of the covering lattice (see `ZONES`), which the stylesheet
      height-caps; group frames are free. */
  zone: boolean
  /**
   * The frame's own angle in degrees (positive = clockwise). Applied with the
   * independent `rotate` property so it composes with the `transform` the pan engine
   * writes for wrapping, and so the *composition* stays a pure function.
   */
  rotate: number
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
/**
 * Smallest and largest tile widths, as fractions of the *plane*.
 *
 * The spread between them is what makes the field read as a composition instead of a
 * contact sheet: the smallest frame is a tenth of the viewport across, the largest is
 * a third of it. Both ends are bounded by the wrapping budget above.
 */
export const MIN_WIDTH = 0.05
export const MAX_WIDTH = 0.165
/**
 * How much the stylesheet scales every tile up on phones (`--tile-scale`). Mirrored
 * here because the wrapping budget has to account for the *rendered* tile.
 */
export const MOBILE_TILE_SCALE = 1.2

/**
 * ## Two layers, because "always clickable" is a geometric promise
 *
 * At every offset a visitor can rest at, **one work has to be fully on screen and
 * unobstructed** — that is what "clicking a project image opens that project" means in
 * practice, and `scripts/home-canvas-audit.mjs` checks it after real wheel input. A
 * field of loose groups fails it: a window can settle between two groups with every
 * photograph sliced by an edge.
 *
 * So the composition has two layers:
 *
 *  - the **zone layer** (`ZONES`): one frame per zone of a lattice that tiles the
 *    plane. A zone frame stays inside its own zone, so whatever the offset, the window
 *    contains a whole zone and therefore a whole frame — the guarantee. Zone frames are
 *    also the *top* of the z order, so the guaranteed frame is never buried by a bigger
 *    one;
 *  - the **group layer** (`GROUPS`): larger frames placed around group anchors, pulled
 *    out of the lattice, turned and layered *behind* the zone frames. This is where the
 *    scattered, stacked character of the reference lives — big photographs with small
 *    prints riding on top of them.
 *
 * `tests/home-canvas.test.ts` sweeps offsets through `place()` and asserts the
 * guarantee holds for every viewport and every archive size, not just for the first
 * frame the visitor sees.
 */
export const ZONE_COLUMNS = 3
export const ZONE_ROWS = 4
/** Zone frames: the width budget, as a fraction of the plane (both axes of the plane
    are `PLANE` viewports, so a fraction of it is the same fraction of the viewport). */
const ZONE_WIDTH = [0.058, 0.086] as const
/**
 * The height cap for a zone frame, as a fraction of the *viewport height* — the one
 * number in this file the stylesheet owns, because a frame's height follows its
 * `aspect-ratio` and only CSS can bound it. `.bang-canvas__tile[data-zone]` caps it at
 * `21% / --bang-plane` = 10.5% of the viewport = `ZONE_MAX_HEIGHT` of the plane.
 *
 * The width cannot bound the height on its own: the plane is not square (it is
 * `PLANE` viewports *wide* and `PLANE` viewports *tall*), so a width fraction turns
 * into a different height fraction at every aspect ratio — which is exactly how a
 * 191px-wide frame once came out 255px tall and broke the covering argument.
 */
export const ZONE_MAX_HEIGHT = 0.105
/**
 * The window a zone frame has to fit inside, as a fraction of the plane: one viewport
 * minus the chrome margins the browser audit requires (16px at the sides, 64px top and
 * bottom). It is stated in *plane* fractions because the plan is viewport-independent —
 * the numbers below are the tightest of the audited desktop/tablet viewports
 * (1440×900 → 0.489 × 0.429, 1440×1000 → 0.489 × 0.436, 1920×1080 → 0.492 × 0.441) —
 * and they are the budget the jitter below is measured against:
 *
 *     zone cell + frame + 2 × jitter <= usable window
 *     0.3333 + 0.088 + 2 × 0.0319 = 0.485
 *     0.25   + 0.105 + 2 × 0.0350 = 0.425
 *
 * A phone is narrower relative to its plane than a laptop and scales its tiles up by
 * `MOBILE_TILE_SCALE`, so it is the tightest case: 458/1000 of the usable width and
 * 424/966 of the usable height, against a frame of at most 0.086 × 1.2 = 0.103 and
 * 0.105. Both still clear — measured, not assumed, by the sweep test.
 */
const USABLE_X = 0.485
const USABLE_Y = 0.425
/** Group frames: bigger, freer, behind. One per quadrant, so the field reads as four
    loose groups — a large photograph with smaller ones around it — rather than as a
    single spread-out set. */
const GROUP_WIDTH = [0.115, MAX_WIDTH] as const
/** Group anchors, as fractions of the plane: two in the window a visitor loads into
    (the plane's top-left quadrant), the rest spread over the other quadrants. */
export const GROUPS: ReadonlyArray<{ angle: number; radius: number; x: number; y: number }> = [
  { angle: 0.6, radius: 0.2, x: 0.27, y: 0.23 },
  { angle: 1.9, radius: 0.21, x: 0.72, y: 0.3 },
  { angle: 3.4, radius: 0.21, x: 0.3, y: 0.72 },
  { angle: 4.7, radius: 0.22, x: 0.7, y: 0.68 },
]
/** Slack taken off every zone's jitter room for the frame's own turn: a rotated box is
    wider and taller than the frame it was placed as. */
const ROTATION_SLACK = 0.014
/** The most a frame may be turned, in degrees. Small enough to read as a hand-moved
    print, large enough that no two neighbours share a horizon. */
const MAX_ROTATE = 4
const ZONE_ROTATE = 2.6
/** Golden angle: distributes the group frames around an anchor without rows. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
/** Crops applied to every third tile, so frames vary instead of every photo keeping
    its own ratio (`0.75` is the portrait crop). */
const PLAN_RATIOS = [1.5, 1, 0.75, 1.25] as const
const MIN_SOURCE_RATIO = 0.6
const MAX_SOURCE_RATIO = 2.4
/** Bounded field: at most this many tile elements exist, whatever the CMS holds. */
export const MAX_SLOTS = 20
/** The zone layer alone — the floor under the field's size, so the guarantee survives
    a one-work archive. */
export const MIN_SLOTS = ZONE_COLUMNS * ZONE_ROWS

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * Fold a position into the plane. The canvas is a torus, so a frame is placed by the
 * cell it belongs to and then wrapped — *not* clamped: clamping the last row of a
 * column collapses it onto the plane's edge and moves it a fifth of the plane, which
 * is how the covering guarantee was being broken. A frame may therefore overhang the
 * plane edge by its own size; its copy is on the other side of the seam, so the field
 * stays continuous, and the wrapping math in `panEngine.ts` never depends on the
 * overhang.
 */
const wrap01 = (value: number): number => ((value % 1) + 1) % 1

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

/** How many group frames each anchor carries: two rings, so a group reads as a large
    photograph with a smaller one beside it. */
export const GROUP_RINGS = 2

/**
 * How many tiles the field holds: a frame for every zone, the group frames on top of
 * that, and one more per work — bounded at both ends, so a large archive still renders
 * `MAX_SLOTS` elements.
 */
export const slotsFor = (workCount: number): number => {
  const groupSlots = GROUPS.length * GROUP_RINGS
  return clamp(
    Math.max(ZONE_COLUMNS * ZONE_ROWS + groupSlots, workCount + 6),
    ZONE_COLUMNS * ZONE_ROWS + groupSlots,
    MAX_SLOTS,
  )
}

/** The lattice zone a slot belongs to: its column, row and the anchor it must stay in. */
export const zoneFor = (slot: number): { column: number; row: number; x: number; y: number } => {
  const index = slot % (ZONE_COLUMNS * ZONE_ROWS)
  const row = Math.floor(index / ZONE_COLUMNS)
  const column = index % ZONE_COLUMNS
  const cellWidth = 1 / ZONE_COLUMNS
  const cellHeight = 1 / ZONE_ROWS
  // The zones tile the plane — that is what the guarantee rests on — and each *column*
  // is dropped by a fraction of a cell so the anchors do not line up into rows.
  //
  // There is deliberately no brick offset on alternate rows: a per-row offset makes a
  // column's x position depend on the row's parity, which couples the two axes and
  // breaks the covering argument (the fitting column's rows would then sit two cells
  // apart vertically, and a window can land between them — measured, not assumed). The
  // scatter comes from the staggered columns and from the jitter below, which is a
  // third of a cell wide.
  const stagger = (column * cellHeight) / ZONE_COLUMNS
  return {
    column,
    row,
    x: (column + 0.5) * cellWidth,
    y: (row + 0.5) * cellHeight + stagger,
  }
}

/** Zone frames are slots `0..ZONE_COLUMNS * ZONE_ROWS - 1`; the rest are group frames. */
export const isZoneFrame = (slot: number): boolean => slot < ZONE_COLUMNS * ZONE_ROWS

/**
 * The whole home composition. No works → no tiles (the caller renders the empty state,
 * never a fabricated frame); otherwise the field is built once per (works) and never
 * again.
 */
export const planCanvas = (works: CanvasWork[]): CanvasPlan => {
  if (works.length === 0) return { tiles: [] }

  const zones = ZONE_COLUMNS * ZONE_ROWS
  const slots = slotsFor(works.length)

  const tiles = Array.from({ length: slots }, (_, slot) => {
    const workIndex = slot % works.length
    const work = works[workIndex]!
    const identity = work.id || work.href || work.title
    const ratio = tileRatio(work.media, slot, identity)
    const spread = unitHash(identity, `width-${slot}`)
    const zone = slot < zones

    let x: number
    let y: number
    let width: number
    if (zone) {
      const cell = zoneFor(slot)
      width = ZONE_WIDTH[0] + (ZONE_WIDTH[1] - ZONE_WIDTH[0]) * spread
      // Jitter inside the zone, bounded so the frame cannot leave the window the
      // guarantee is about: its own room grows as the frame gets smaller.
      //
      // The height budget is the stylesheet's cap rather than the frame's own ratio:
      // the plan cannot see the viewport, and a *width* fraction does not convert into a
      // height fraction — the plane is not square (see `ZONE_MAX_HEIGHT`). A tall frame
      // is therefore capped in CSS and budgeted at the cap here.
      const height = ZONE_MAX_HEIGHT
      const roomX = Math.max(0, (USABLE_X - 1 / ZONE_COLUMNS) / 2 - width / 2 - ROTATION_SLACK)
      const roomY = Math.max(0, (USABLE_Y - 1 / ZONE_ROWS) / 2 - height / 2 - ROTATION_SLACK)
      x = wrap01(cell.x - width / 2 + (unitHash(identity, `jx-${slot}`) - 0.5) * 2 * roomX)
      y = wrap01(cell.y + (unitHash(identity, `jy-${slot}`) - 0.5) * 2 * roomY)
    } else {
      const group = GROUPS[(slot - zones) % GROUPS.length]!
      const ring = Math.floor((slot - zones) / GROUPS.length)
      width = GROUP_WIDTH[0] + (GROUP_WIDTH[1] - GROUP_WIDTH[0]) * spread
      const angle = group.angle + ring * GOLDEN_ANGLE + unitHash(identity, `angle-${slot}`) * 0.6
      const radius = group.radius * (0.35 + 0.65 * unitHash(identity, `radius-${slot}`))
      x = wrap01(group.x + Math.cos(angle) * radius)
      y = wrap01(group.y + Math.sin(angle) * radius)
    }

    return {
      key: `${identity}-${slot}`,
      ratio,
      rotate: Number(
        ((unitHash(identity, `rotate-${slot}`) - 0.5) * 2 * (zone ? ZONE_ROTATE : MAX_ROTATE)).toFixed(2),
      ),
      width,
      // The work assignment is a function of the slot alone, and `slot % works.length`
      // spreads repeats across the field: with eight works the first eight slots are the
      // eight works in order, and later slots wrap around.
      work: workIndex,
      x,
      y,
      // Depth: group frames behind, zone frames in front. A zone frame is therefore
      // never buried by a larger one — the clickable frame at any offset is always the
      // reachable one.
      z: zone ? 100 + (slot % 25) : 1 + (slot % 40),
      zone,
    } satisfies CanvasTile
  })

  return { tiles }
}
