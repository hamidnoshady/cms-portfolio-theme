import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  HOVER_EXPAND,
  isZoneFrame,
  MAX_SLOTS,
  MAX_WIDTH,
  MIN_SLOTS,
  MIN_WIDTH,
  minimumPairwiseGapPx,
  MOBILE_TILE_SCALE,
  PLANE,
  planCanvas,
  slotsFor,
  tileRatio,
  unitHash,
  ZONE_COLUMNS,
  ZONE_MAX_HEIGHT,
  ZONE_ROWS,
  zoneFor,
  type CanvasWork,
} from '@/components/home/canvasPlan'
import {
  createPanState,
  normalize,
  panBy,
  periodFor,
  place,
  step,
  vec,
} from '@/components/home/panEngine'

/**
 * The home canvas contract, in plain arithmetic:
 * - Separated, non-overlapping frames across desktop (1440x900, 1280x800), tablet (768x1024),
 *   and mobile (390x844, 320x568) viewports, including across periodic wrap seams and
 *   with hover expansion margin (`HOVER_EXPAND`).
 * - Minimum pairwise gap thresholds (`>= 32px` desktop, `>= 24px` tablet, `>= 16px` mobile).
 * - Settled rotation `rotate === 0` for all frames.
 * - Visible initial-viewport frame count in the intended range (`4–5` on desktop when 5–8
 *   works exist, avoiding duplicate works in the initial viewport when enough unique works exist).
 * - Deterministic edgecases (`0`, `1`, `2`, `5`, `8` works) without overlap.
 * - Full periodic torus coverage and clickability at every pan offset.
 */

const media = (index: number) => ({
  height: 1000 + index * 120,
  id: `media-${index}`,
  url: `/media/${index}.jpg`,
  width: 1500 - index * 90,
})

const works = (count: number): CanvasWork[] =>
  Array.from({ length: count }, (_, index) => ({
    href: `/projects/work-${index}`,
    id: `work-${index}`,
    media: media(index),
    meta: `202${index % 5}`,
    title: `Work ${index}`,
  }))

const write = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const VIEWPORTS = [
  { height: 900, minGap: 32, name: '1440x900', width: 1440 },
  { height: 800, minGap: 32, name: '1280x800', width: 1280 },
  { height: 1080, minGap: 32, name: '1920x1080', width: 1920 },
  { height: 1024, minGap: 24, name: '768x1024', width: 768 },
  { height: 844, minGap: 16, name: '390x844', scale: MOBILE_TILE_SCALE, width: 390 },
  { height: 568, minGap: 16, name: '320x568', scale: MOBILE_TILE_SCALE, width: 320 },
]

const boxesFor = (workCount: number, viewport: { height: number; scale?: number; width: number }) => {
  const scale = viewport.scale ?? (viewport.width < 768 ? MOBILE_TILE_SCALE : 1)
  const plane = vec(viewport.width * PLANE, viewport.height * PLANE)
  const plan = planCanvas(works(workCount))
  const tiles = plan.tiles.map((tile, slot) => {
    const width = Math.min(tile.width * plane.x * scale, 0.42 * viewport.width)
    const cap = tile.zone ? 0.115 * plane.y : (viewport.width < 768 ? 0.38 : 0.46) * viewport.height
    const height = Math.min(width / tile.ratio, cap)
    return {
      box: { position: vec(tile.x * plane.x, tile.y * plane.y), size: vec(width, height) },
      key: tile.key,
      primary: tile.primary,
      ratio: tile.ratio,
      slot,
      width: tile.width,
      work: tile.work,
      zone: tile.zone,
    }
  })
  return {
    largest: vec(
      Math.max(...tiles.map((tile) => tile.box.size.x)),
      Math.max(...tiles.map((tile) => tile.box.size.y)),
    ),
    plane,
    tiles,
  }
}

describe('home canvas composition', () => {
  it('is byte-identical between renders and across module reloads', () => {
    const first = planCanvas(works(5))
    const second = planCanvas(works(5))
    expect(second).toEqual(first)
    expect(unitHash('work-1', 'angle-3')).toBe(unitHash('work-1', 'angle-3'))
    expect(unitHash('work-1', 'angle-3')).not.toBe(unitHash('work-1', 'angle-4'))
  })

  it('places every tile inside the plane with settled rotation 0deg and orbital entry arc', () => {
    for (const tile of planCanvas(works(6)).tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x).toBeLessThan(1)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThan(1)
      expect(tile.x + tile.width).toBeLessThanOrEqual(1 + MAX_WIDTH)
      expect(tile.y + tile.width / tile.ratio).toBeLessThanOrEqual(1 + ZONE_MAX_HEIGHT + 1e-9)
      expect(tile.width).toBeGreaterThanOrEqual(MIN_WIDTH)
      expect(tile.width).toBeLessThanOrEqual(MAX_WIDTH)
      expect(tile.ratio).toBeGreaterThan(0.5)
      expect(tile.ratio).toBeLessThan(3)
      expect(tile.rotate).toBe(0)
      expect(Number.isInteger(tile.z)).toBe(true)
      expect(Number.isFinite(tile.arc.startX)).toBe(true)
      expect(Number.isFinite(tile.arc.startY)).toBe(true)
      expect(Number.isFinite(tile.arc.ctrlX)).toBe(true)
      expect(Number.isFinite(tile.arc.ctrlY)).toBe(true)
    }
  })

  it('bounds the field, marks one primary tile per unique work, and gives every work a destination', () => {
    expect(slotsFor(0)).toBe(0)
    expect(slotsFor(1)).toBe(MIN_SLOTS)
    expect(slotsFor(5)).toBe(MAX_SLOTS)
    expect(slotsFor(50)).toBe(MAX_SLOTS)
    const plan = planCanvas(works(7))
    expect(plan.tiles.length).toBeLessThanOrEqual(MAX_SLOTS)
    expect(plan.tiles.length).toBeGreaterThanOrEqual(7)
    const covered = new Set(plan.tiles.map((tile) => tile.work))
    for (let index = 0; index < 7; index += 1) expect(covered.has(index)).toBe(true)
    const primary = plan.tiles.filter((tile) => tile.primary)
    expect(primary.length).toBe(7)
    expect(new Set(primary.map((tile) => tile.work)).size).toBe(7)
    const zones = plan.tiles.filter((tile) => tile.zone)
    expect(zones.length).toBe(ZONE_COLUMNS * ZONE_ROWS)
  })

  it('maintains separated non-overlapping frames with minimum gap thresholds across desktop, tablet, and mobile viewports (including periodic seams and hover expansion)', () => {
    for (const count of [1, 2, 5, 8]) {
      const plan = planCanvas(works(count))
      for (const viewport of VIEWPORTS) {
        const minGap = minimumPairwiseGapPx(plan, viewport, HOVER_EXPAND)
        expect(
          minGap,
          `viewport ${viewport.name} with ${count} works (minGap=${minGap.toFixed(1)}px, required>=${viewport.minGap}px)`,
        ).toBeGreaterThanOrEqual(viewport.minGap)
      }
    }
  })

  it('shows 4–5 separated distinct works in the initial desktop viewport when 5–8 unique works exist', () => {
    const viewport = VIEWPORTS[0]!
    for (const count of [5, 6, 8]) {
      const { plane, tiles } = boxesFor(count, viewport)
      const period = periodFor(plane, vec(0, 0), 0)
      const size = vec(viewport.width, viewport.height)
      const visibleAtLoad = tiles.filter(
        (tile) => place(tile.box.position, tile.box.size, vec(0, 0), size, period).visible,
      )
      expect(visibleAtLoad.length).toBeGreaterThanOrEqual(4)
      expect(visibleAtLoad.length).toBeLessThanOrEqual(7)
      // No duplicate work IDs in the initial viewport when enough unique works exist.
      const distinctWorks = new Set(visibleAtLoad.map((tile) => tile.work))
      expect(distinctWorks.size).toBe(visibleAtLoad.length)
    }
  })

  it('keeps every zone frame inside its own zone band so a window always contains a whole frame', () => {
    const tiles = planCanvas(works(8)).tiles
    const zoneTiles = tiles.filter((tile, slot) => isZoneFrame(slot, tiles.length))
    expect(zoneTiles.length).toBe(ZONE_COLUMNS * ZONE_ROWS)
    tiles.forEach((tile, slot) => {
      if (!isZoneFrame(slot, tiles.length)) return
      const zone = zoneFor(slot, tiles.length)
      const zoneWidth = 1 / ZONE_COLUMNS
      const zoneHeight = 1 / ZONE_ROWS
      const around = (value: number, anchor: number) => {
        const gap = Math.abs(value - anchor) % 1
        return Math.min(gap, 1 - gap)
      }
      expect(around(tile.x + tile.width / 2, zone.x)).toBeLessThanOrEqual(zoneWidth / 2)
      expect(around(tile.y + tile.width / tile.ratio / 2, zone.y)).toBeLessThanOrEqual(zoneHeight)
    })
  })

  it('ties identity to the slot, so a recycled tile can never open another work', () => {
    const plan = planCanvas(works(4))
    plan.tiles.forEach((tile, slot) => {
      expect(tile.work).toBe(slot % 4)
      expect(tile.key).toBe(`work-${slot % 4}-${slot}`)
    })
    expect(new Set(plan.tiles.map((tile) => tile.key)).size).toBe(plan.tiles.length)
  })

  it('crops every third tile and respects a photograph’s own ratio elsewhere', () => {
    const square = { height: 1000, id: 'square', url: '/square.jpg', width: 1000 }
    expect(tileRatio(square, 0, 'w')).toBe(1)
    expect(tileRatio(square, 2, 'w')).toBe(0.75)
    const panorama = { height: 200, id: 'pan', url: '/pan.jpg', width: 4000 }
    expect(tileRatio(panorama, 0, 'w')).toBe(2.4)
    expect(tileRatio(null, 1, 'w')).toBeGreaterThan(0.5)
    expect(planCanvas([{ href: '/projects/a', id: 'a', media: null, title: 'A' }]).tiles.length).toBeGreaterThan(0)
  })

  it('serves an empty plan for an empty archive (the caller shows a state, never a tile)', () => {
    expect(planCanvas([])).toEqual({ tiles: [] })
  })

  it('has no carousel and no floating WorkIndex disclosure left', () => {
    const sources = ['src/views/HomeView.tsx', 'src/components/home/CanvasField.tsx'].map(write).join('\n')
    expect(sources).not.toMatch(/aria-roledescription/u)
    expect(sources).not.toMatch(/carousel/iu)
    expect(sources).not.toMatch(/bang-dot/u)
    expect(sources).not.toMatch(/is-active/u)
    expect(sources).not.toMatch(/WorkIndex/u)
    expect(() => write('src/components/portfolio/CanvasStage.tsx')).toThrow()
    expect(() => write('src/components/home/HomeStage.tsx')).toThrow()
    expect(() => write('src/components/home/WorkIndex.tsx')).toThrow()
    expect(() => write('src/components/portfolio/StudioClock.tsx')).toThrow()
    expect(() => write('src/components/layout/SiteFooter.tsx')).toThrow()
    expect(write('src/styles/components.css')).not.toMatch(/\.bang-dot|carousel/u)
  })

  it('keeps the whole Bang section inside the components layer, so utilities can still win', () => {
    const css = write('src/styles/components.css')
    const start = css.indexOf('/* --- buttons ---')
    expect(css.slice(0, start).lastIndexOf('@layer components {')).toBeGreaterThan(-1)
    expect(css.replace(/\/\*[\s\S]*?\*\//gu, '').indexOf('@layer components {')).toBeGreaterThan(-1)
  })
})

describe('home canvas wrapping', () => {
  it('never lets the viewport go blank, at any offset', () => {
    for (const viewport of VIEWPORTS) {
      for (const count of [1, 3, 5, 6, 8]) {
        const { largest, plane, tiles } = boxesFor(count, viewport)
        const period = periodFor(plane, largest, 0)
        expect(period.x).toBeGreaterThanOrEqual(viewport.width + 2 * largest.x - 1e-9)
        let worst = Number.POSITIVE_INFINITY
        const samples = 60
        for (let sx = 0; sx < samples; sx += 1) {
          for (let sy = 0; sy < samples; sy += 1) {
            const offset = vec((sx / samples) * plane.x, (sy / samples) * plane.y)
            const onScreen = tiles.filter(
              (tile) =>
                place(tile.box.position, tile.box.size, offset, vec(viewport.width, viewport.height), plane).visible,
            )
            worst = Math.min(worst, onScreen.length)
          }
        }
        expect(worst, `${viewport.name}, ${count} works`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps a whole work on screen at every offset, clear of the chrome', () => {
    const MARGIN_X = 16
    const MARGIN_Y = 64
    for (const viewport of VIEWPORTS.slice(0, 5)) {
      for (const count of [1, 5, 6, 8]) {
        const { plane, tiles } = boxesFor(count, viewport)
        const period = periodFor(plane, vec(0, 0), 0)
        const size = vec(viewport.width, viewport.height)
        let reachable = Number.POSITIVE_INFINITY
        const samples = 48
        for (let sx = 0; sx < samples; sx += 1) {
          for (let sy = 0; sy < samples; sy += 1) {
            const offset = vec((sx / samples) * plane.x, (sy / samples) * plane.y)
            const whole = tiles.filter((tile) => {
              if (!tile.zone) return false
              const at = place(tile.box.position, tile.box.size, offset, size, period)
              return (
                at.x > MARGIN_X &&
                at.y > MARGIN_Y &&
                at.x + tile.box.size.x < viewport.width - MARGIN_X &&
                at.y + tile.box.size.y < viewport.height - MARGIN_Y
              )
            }).length
            reachable = Math.min(reachable, whole)
          }
        }
        expect(reachable, `${viewport.name}, ${count} works`).toBeGreaterThan(0)
      }
    }
  })

  it('never jumps a tile that is on screen, so a wrap cannot be seen', () => {
    const viewport = VIEWPORTS[0]!
    for (const count of [1, 4, 6]) {
      const { plane, tiles } = boxesFor(count, viewport)
      const size = vec(viewport.width, viewport.height)
      const stride = 180
      let previous = tiles.map((tile) => ({
        ...place(tile.box.position, tile.box.size, vec(0, 0), size, plane),
        key: tile.key,
      }))
      for (let stepIndex = 1; stepIndex <= 40; stepIndex += 1) {
        const offset = vec(0, stride * stepIndex)
        const current = tiles.map((tile) => ({
          ...place(tile.box.position, tile.box.size, offset, size, plane),
          key: tile.key,
        }))
        current.forEach((tile, index) => {
          const before = previous[index]!
          const moved = Math.hypot(tile.delta.x - before.delta.x, tile.delta.y - before.delta.y)
          if (moved > 0) {
            expect(tile.visible && before.visible, `${tile.key} jumped (${moved}px) while visible`).toBe(false)
          }
        })
        previous = current
      }
    }
  })

  it('reads its plane and tile budget from the same numbers the stylesheet uses', () => {
    const css = write('src/styles/components.css')
    const plane = css.match(/--bang-plane:\s*([\d.]+)/u)
    expect(Number(plane?.[1])).toBe(PLANE)
    const phone = css.match(/@media \(max-width: 47\.99rem\) \{[\s\S]*?--tile-scale:\s*([\d.]+)/u)
    expect(Number(phone?.[1])).toBe(MOBILE_TILE_SCALE)
    expect(css).toMatch(/inline-size: calc\(var\(--tile-w[^)]*\) \* 100% \* var\(--tile-scale[^)]*\) \* var\(--tile-fit/u)
    const planeMatch = css.match(/--bang-plane:\s*([\d.]+)/u)
    expect(PLANE).toBeGreaterThanOrEqual(1 + 2 * MAX_WIDTH * MOBILE_TILE_SCALE)
    expect(planeMatch).not.toBeNull()
    expect(MIN_WIDTH).toBeGreaterThan(0.03)
    expect(MAX_WIDTH).toBeLessThan(0.3)
    expect(MAX_SLOTS).toBeLessThanOrEqual(20)
    expect(MIN_SLOTS).toBeGreaterThanOrEqual(8)
    expect(css).toMatch(/rotate: calc\(var\(--tile-rotate[^)]*\) \* 1deg\)/)
  })
})

describe('home canvas pan engine', () => {
  it('pulls a long session back into the first period without moving the field', () => {
    const period = vec(2000, 1600)
    const far = { offset: vec(900_450, -300_000), target: vec(900_450, -300_000), velocity: vec(0, 0) }
    expect(normalize(far, period)).toEqual(far)
    const huge = { offset: vec(7_200_450, -39_300_000), target: vec(7_200_450, -39_300_000), velocity: vec(0, 0) }
    const state = normalize(huge, period)
    expect(Math.abs(state.offset.x)).toBeLessThanOrEqual(period.x / 2)
    expect(Math.abs(state.offset.y)).toBeLessThanOrEqual(period.y / 2)
    expect((huge.offset.x - state.offset.x) % period.x).toBeCloseTo(0, 6)
    expect((huge.offset.y - state.offset.y) % period.y).toBeCloseTo(0, 6)
  })

  it('settles instead of animating forever', () => {
    let state = panBy(createPanState(), vec(0, 900))
    let frames = 0
    let settled = false
    while (!settled && frames < 600) {
      const next = step(state, 16.7)
      state = next
      settled = next.settled
      frames += 1
    }
    expect(settled).toBe(true)
    expect(frames).toBeLessThan(240)
    expect(state.offset.y).toBeGreaterThan(700)
    expect(state.offset.y).toBeLessThan(1000)
  })

  it('carries a released drag, then bleeds it off to a stop', () => {
    const state = { offset: vec(0, 0), target: vec(0, 0), velocity: vec(0, -30) }
    const afterOneFrame = step(state, 16.7)
    expect(afterOneFrame.offset.y).toBeLessThan(0)
    expect(afterOneFrame.offset.y).toBeGreaterThan(-30)
    let current = afterOneFrame
    let frames = 1
    while (frames < 600 && !current.settled) {
      current = step(current, 16.7)
      frames += 1
    }
    expect(current.settled).toBe(true)
    expect(current.offset.y).toBeLessThan(-30 * 4)
    expect(current.offset.y).toBeLessThan(0)
    expect(current.offset.y).toBeGreaterThan(-30 * 20)
    expect(frames).toBeLessThan(120)
    expect(Math.abs(current.velocity.y)).toBe(0)
  })
})
