import type { Media } from '@/lib/cms/types'

/**
 * Deterministic separated-frame homepage composition (`canvasPlan`).
 *
 * Replaces the old grouped/tilted print-stack layout with a separated editorial field:
 * - Settled rotation is always `0deg` (no tilted cards).
 * - Every frame sits in its own non-overlapping cell on the `2×2` periodic torus,
 *   maintaining generous whitespace and >= 32px desktop / >= 24px tablet / >= 16px
 *   mobile clearance even after hover expansion (`1.04×`).
 * - The first slots populate the initial viewport (`[0, 0.5) × [0, 0.5)`) with 4–5
 *   distinct works when available, reserving top/bottom corner safe zones for the
 *   logo, primary menu, and language switch.
 * - Each tile also carries a deterministic curved orbital entry path (`arc`) used by
 *   the GSAP first-load entrance timeline.
 */

export type CanvasWork = {
  href: string
  id: string
  media: null | Media
  meta?: null | string
  title: string
}

export type CanvasArc = {
  angleDeg: number
  bend: number
  ctrlX: number
  ctrlY: number
  delay: number
  startX: number
  startY: number
}

export type CanvasTile = {
  /** Curved orbital entrance path relative to the tile's settled position (in vw/vh). */
  arc: CanvasArc
  /** Stable React key (`${work.id}-${slot}`). */
  key: string
  /** True for the first canonical occurrence of each distinct work (`slot < works.length`). */
  primary: boolean
  /** Aspect ratio `width / height`, clamped to architectural proportions. */
  ratio: number
  /** Settled rotation in degrees — always 0 in the separated layout. */
  rotate: number
  /** 0-based slot index on the periodic plane. */
  slot: number
  /** Width as a fraction of the 2x periodic plane (`MIN_WIDTH .. MAX_WIDTH`). */
  width: number
  /** Index into `works` (`0 <= work < works.length`). */
  work: number
  /** Horizontal position as a fraction of the 2x plane (`0 <= x < 1`). */
  x: number
  /** Vertical position as a fraction of the 2x plane (`0 <= y < 1`). */
  y: number
  /** Stack order (`1 .. MAX_SLOTS`). */
  z: number
  /** True when this slot belongs to the 3x4 covering lattice. */
  zone?: boolean
}

export type CanvasPlan = {
  plane?: number
  tiles: CanvasTile[]
}

/** The periodic plane is `PLANE` viewports across in both axes. */
export const PLANE = 2
/** Subtle phone width multiplier that preserves >= 16px gaps at 320px and 390px. */
export const MOBILE_TILE_SCALE = 1.05

export const ZONE_COLUMNS = 3
export const ZONE_ROWS = 4
export const MIN_SLOTS = ZONE_COLUMNS * ZONE_ROWS
export const MAX_SLOTS = 14

export const MIN_WIDTH = 0.082
export const MAX_WIDTH = 0.098
export const ZONE_MAX_HEIGHT = 0.115
export const HOVER_EXPAND = 1.04

const MIN_RATIO = 0.6
const MAX_RATIO = 2.4
const PLAN_RATIOS = [1.5, 1, 0.75, 1.25] as const

type SlotTemplate = {
  col: number
  corridor?: boolean
  row: number
  x: number
  y: number
  zone: boolean
}

/**
 * Ordered so the initial viewport (`[0, 0.5) × [0, 0.5)`) is populated first:
 * slots 0..3 are the 4 corner-safe lattice frames inside the initial viewport, and
 * slot 4 (when >= 5 works exist) is the central corridor frame, ensuring 5 distinct
 * works appear on screen at load with zero duplicates and zero overlaps.
 */
const LATTICE_SLOTS: readonly SlotTemplate[] = [
  // Initial viewport ([0, 0.5) x [0, 0.5))
  { col: 0, row: 0, x: 0.042, y: 0.062, zone: true },
  { col: 1, row: 0, x: 0.372, y: 0.062, zone: true },
  { col: 0, row: 1, x: 0.042, y: 0.292, zone: true },
  { col: 1, row: 1, x: 0.372, y: 0.292, zone: true },
  // Remaining torus cells for seamless 2D wrapping
  { col: 2, row: 0, x: 0.702, y: 0.062, zone: true },
  { col: 2, row: 1, x: 0.702, y: 0.292, zone: true },
  { col: 0, row: 2, x: 0.042, y: 0.542, zone: true },
  { col: 1, row: 2, x: 0.372, y: 0.542, zone: true },
  { col: 2, row: 2, x: 0.702, y: 0.542, zone: true },
  { col: 0, row: 3, x: 0.042, y: 0.792, zone: true },
  { col: 1, row: 3, x: 0.372, y: 0.792, zone: true },
  { col: 2, row: 3, x: 0.702, y: 0.792, zone: true },
]

const CORRIDOR_SLOTS: readonly SlotTemplate[] = [
  // Center corridor in initial viewport
  { col: 0, corridor: true, row: 0, x: 0.206, y: 0.174, zone: false },
  // Center corridor in opposite torus half
  { col: 1, corridor: true, row: 2, x: 0.536, y: 0.664, zone: false },
]

const templatesFor = (slotCount: number): SlotTemplate[] => {
  if (slotCount <= MIN_SLOTS) return [...LATTICE_SLOTS]
  return [
    ...LATTICE_SLOTS.slice(0, 4),
    CORRIDOR_SLOTS[0]!,
    ...LATTICE_SLOTS.slice(4),
    ...CORRIDOR_SLOTS.slice(1, slotCount - MIN_SLOTS),
  ]
}

/** FNV-1a 32-bit hash mapped to `[0, 1)`. */
export const unitHash = (seed: string, salt: string): number => {
  const input = `${seed}::${salt}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x1_0000_0000
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const tileRatio = (media: null | Media, slot: number, id: string): number => {
  if (slot % 3 === 2) return PLAN_RATIOS[slot % PLAN_RATIOS.length]!
  const w = typeof media?.width === 'number' && media.width > 0 ? media.width : null
  const h = typeof media?.height === 'number' && media.height > 0 ? media.height : null
  if (w && h) return clamp(w / h, MIN_RATIO, MAX_RATIO)
  const hVal = Math.floor(unitHash(id, `ratio-${slot}`) * 1000)
  return PLAN_RATIOS[(hVal + slot) % PLAN_RATIOS.length]!
}

export const slotsFor = (workCount: number): number => {
  if (workCount <= 0) return 0
  if (workCount < 5) return MIN_SLOTS
  return MAX_SLOTS
}

export const isZoneFrame = (slot: number, totalSlots = MAX_SLOTS): boolean => {
  const templates = templatesFor(totalSlots)
  return Boolean(templates[slot]?.zone)
}

export const zoneFor = (slot: number, totalSlots = MAX_SLOTS): { col: number; row: number; x: number; y: number } => {
  const templates = templatesFor(totalSlots)
  const item = templates[slot] ?? LATTICE_SLOTS[slot % LATTICE_SLOTS.length]!
  return {
    col: item.col,
    row: item.row,
    x: (item.col + 0.35) / ZONE_COLUMNS,
    y: (item.row + 0.4) / ZONE_ROWS,
  }
}

const buildArc = (slot: number, totalSlots: number, x: number, y: number, id: string): CanvasArc => {
  const angleDeg = Number((((slot / Math.max(totalSlots, 1)) * 360 + unitHash(id, `arc-${slot}`) * 28) % 360).toFixed(2))
  const rad = (angleDeg * Math.PI) / 180
  const orbitRadiusVw = 14 + (slot % 3) * 4
  const orbitRadiusVh = 12 + (slot % 3) * 3.5
  const settledCenterVw = (x + 0.045) * PLANE * 100
  const settledCenterVh = (y + 0.045) * PLANE * 100
  const orbitX = 50 + Math.cos(rad) * orbitRadiusVw
  const orbitY = 50 + Math.sin(rad) * orbitRadiusVh
  const startX = Number(clamp(orbitX - settledCenterVw, -42, 42).toFixed(2))
  const startY = Number(clamp(orbitY - settledCenterVh, -38, 38).toFixed(2))
  const tangentRad = rad + Math.PI / 2
  const ctrlX = Number((startX * 0.52 + Math.cos(tangentRad) * 14).toFixed(2))
  const ctrlY = Number((startY * 0.52 + Math.sin(tangentRad) * 12).toFixed(2))
  const bend = (slot % 2 === 0 ? 1 : -1) * Number((0.42 + unitHash(id, `bend-${slot}`) * 0.38).toFixed(3))
  const delay = Number((0.26 + (slot % 6) * 0.065).toFixed(3))
  return { angleDeg, bend, ctrlX, ctrlY, delay, startX, startY }
}

export const planCanvas = (works: readonly CanvasWork[]): CanvasPlan => {
  const count = works.length
  if (count === 0) return { tiles: [] }
  const total = slotsFor(count)
  const templates = templatesFor(total)
  const tiles: CanvasTile[] = []

  for (let slot = 0; slot < total; slot += 1) {
    const workIndex = slot % count
    const work = works[workIndex]!
    const key = `${work.id}-${slot}`
    const tpl = templates[slot]!
    const uX = unitHash(work.id, `x-${slot}`)
    const uY = unitHash(work.id, `y-${slot}`)
    const uW = unitHash(work.id, `w-${slot}`)

    const width = Number((MIN_WIDTH + uW * (MAX_WIDTH - MIN_WIDTH)).toFixed(4))
    const ratio = tileRatio(work.media, slot, work.id)
    const x = Number((tpl.x + uX * 0.004).toFixed(4))
    const y = Number((tpl.y + uY * 0.008).toFixed(4))

    tiles.push({
      arc: buildArc(slot, total, x, y, work.id),
      key,
      primary: slot < count,
      ratio,
      rotate: 0,
      slot,
      width,
      work: workIndex,
      x,
      y,
      z: slot + 1,
      zone: tpl.zone,
    })
  }

  return { tiles }
}

/**
 * Computes minimum pairwise edge-to-edge separation (in pixels) across all 9 periodic
 * torus copies for a given viewport, accounting for hover expansion (`HOVER_EXPAND`).
 */
export const minimumPairwiseGapPx = (
  plan: CanvasPlan,
  viewport: { height: number; scale?: number; width: number },
  hoverExpand = HOVER_EXPAND,
): number => {
  if (plan.tiles.length < 2) return Number.POSITIVE_INFINITY
  const scale = viewport.scale ?? (viewport.width < 768 ? MOBILE_TILE_SCALE : 1)
  const planeX = viewport.width * PLANE
  const planeY = viewport.height * PLANE
  const maxCap = 0.115 * planeY

  const rects = plan.tiles.map((tile) => {
    const baseW = Math.min(tile.width * planeX * scale, 0.42 * viewport.width)
    const baseH = Math.min(baseW / tile.ratio, maxCap)
    const w = baseW * hoverExpand
    const h = baseH * hoverExpand
    const cx = tile.x * planeX + baseW / 2
    const cy = tile.y * planeY + baseH / 2
    return { cx, cy, h, key: tile.key, w }
  })

  let minGap = Number.POSITIVE_INFINITY
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i]!
      const b = rects[j]!
      for (const sx of [-1, 0, 1]) {
        for (const sy of [-1, 0, 1]) {
          const bx = b.cx + sx * planeX
          const by = b.cy + sy * planeY
          const gapX = Math.abs(a.cx - bx) - (a.w + b.w) / 2
          const gapY = Math.abs(a.cy - by) - (a.h + b.h) / 2
          const gap =
            gapX >= 0 && gapY >= 0
              ? Math.hypot(gapX, gapY)
              : Math.max(gapX, gapY)
          if (gap < minGap) minGap = gap
        }
      }
    }
  }
  return minGap
}
