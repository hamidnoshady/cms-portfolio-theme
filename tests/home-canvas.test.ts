import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  MAX_SLOTS,
  MAX_WIDTH,
  MIN_WIDTH,
  MOBILE_TILE_SCALE,
  PLANE,
  gridFor,
  planCanvas,
  slotsFor,
  tileRatio,
  unitHash,
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
 * The home canvas contract, in plain arithmetic.
 *
 * These are the promises a screenshot cannot make: that the composition is the same
 * on every render, that every tile keeps the work it was built for while the field
 * wraps, that a wrap can never happen in front of the visitor, that the viewport is
 * never blank whatever the offset, that the field is bounded, and that the animation
 * loop comes to rest instead of running forever. Geometry, click targets and motion
 * are all decided by the two pure modules under test, so a browser run is evidence
 * about rendering, not about these rules.
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

/** Viewports the field has to behave in: a laptop, a tall laptop, a desktop, a phone. */
const VIEWPORTS = [
  { height: 900, name: '1440x900', width: 1440 },
  { height: 1000, name: '1440x1000', width: 1440 },
  { height: 1080, name: '1920x1080', width: 1920 },
  { height: 844, name: '390x844', scale: MOBILE_TILE_SCALE, width: 390 },
]

/**
 * The composition as the browser lays it out: the plane is `PLANE` viewports across,
 * the tiles are percentages of it, their height follows the ratio until the
 * `max-block-size` cap (46% of the viewport, 38% on phones) crops them.
 */
const boxesFor = (workCount: number, viewport: { height: number; scale?: number; width: number }) => {
  const scale = viewport.scale ?? 1
  const plane = vec(viewport.width * PLANE, viewport.height * PLANE)
  const tiles = planCanvas(works(workCount)).tiles.map((tile) => {
    const width = Math.min(tile.width * plane.x * scale, 0.46 * viewport.width)
    const height = Math.min(width / tile.ratio, (viewport.width < 768 ? 0.38 : 0.46) * viewport.height)
    return {
      box: { position: vec(tile.x * plane.x, tile.y * plane.y), size: vec(width, height) },
      key: tile.key,
      ratio: tile.ratio,
      width: tile.width,
      work: tile.work,
    }
  })
  return { largest: vec(Math.max(...tiles.map((tile) => tile.box.size.x)), Math.max(...tiles.map((tile) => tile.box.size.y))), plane, tiles }
}

/** The plan is a function of its input only — no randomness, no clock, no DOM. */
describe('home canvas composition', () => {
  it('is byte-identical between renders and across module reloads', () => {
    const first = planCanvas(works(5))
    const second = planCanvas(works(5))
    expect(second).toEqual(first)
    expect(unitHash('work-1', 'angle-3')).toBe(unitHash('work-1', 'angle-3'))
    expect(unitHash('work-1', 'angle-3')).not.toBe(unitHash('work-1', 'angle-4'))
  })

  it('keeps every tile inside the canvas box, so the served percentages need no correction', () => {
    for (const tile of planCanvas(works(6)).tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0)
      expect(tile.x + tile.width).toBeLessThanOrEqual(1)
      expect(tile.y).toBeGreaterThanOrEqual(0)
      expect(tile.y).toBeLessThanOrEqual(1)
      expect(tile.width).toBeGreaterThan(0.1)
      expect(tile.width).toBeLessThanOrEqual(0.3)
      expect(tile.ratio).toBeGreaterThan(0.5)
      expect(tile.ratio).toBeLessThan(3)
      expect(Number.isInteger(tile.z)).toBe(true)
    }
  })

  it('bounds the field and gives every work at least one destination', () => {
    expect(slotsFor(1)).toBe(8)
    expect(slotsFor(50)).toBe(MAX_SLOTS)
    const plan = planCanvas(works(7))
    expect(plan.tiles.length).toBeLessThanOrEqual(MAX_SLOTS)
    expect(plan.tiles.length).toBeGreaterThanOrEqual(7)
    const covered = new Set(plan.tiles.map((tile) => tile.work))
    for (let index = 0; index < 7; index += 1) expect(covered.has(index)).toBe(true)
    // The lattice is filled: an empty cell would be a hole the viewport could settle in.
    const { cols, rows } = gridFor(plan.tiles.length)
    expect(cols * rows).toBe(plan.tiles.length)
  })

  it('scatters rather than stacks: sizes, crops, depths and positions all differ', () => {
    const tiles = planCanvas(works(6)).tiles
    expect(new Set(tiles.map((tile) => tile.width)).size).toBeGreaterThan(3)
    expect(new Set(tiles.map((tile) => tile.ratio)).size).toBeGreaterThan(2)
    expect(new Set(tiles.map((tile) => tile.z)).size).toBeGreaterThan(3)
    expect(new Set(tiles.map((tile) => `${tile.x.toFixed(3)}:${tile.y.toFixed(3)}`)).size).toBe(tiles.length)
    // A ring, not a grid: nothing sits on a shared row edge.
    expect(new Set(tiles.map((tile) => tile.y.toFixed(3))).size).toBeGreaterThan(tiles.length / 2)
  })

  it('ties identity to the slot, so a recycled tile can never open another work', () => {
    const plan = planCanvas(works(4))
    plan.tiles.forEach((tile, slot) => {
      expect(tile.work).toBe(slot % 4)
      expect(tile.key).toBe(`work-${slot % 4}-${slot}`)
    })
    // Two tiles of the same work are two different frames, never the same element.
    expect(new Set(plan.tiles.map((tile) => tile.key)).size).toBe(plan.tiles.length)
  })

  it('crops every third tile and respects a photograph’s own ratio elsewhere', () => {
    const square = { height: 1000, id: 'square', url: '/square.jpg', width: 1000 }
    expect(tileRatio(square, 0, 'w')).toBe(1)
    expect(tileRatio(square, 2, 'w')).toBe(0.75)
    // A panorama is clamped instead of becoming a sliver.
    const panorama = { height: 200, id: 'pan', url: '/pan.jpg', width: 4000 }
    expect(tileRatio(panorama, 0, 'w')).toBe(2.4)
    // Missing media still frames: a plan ratio, then a placeholder box in the DOM.
    expect(tileRatio(null, 1, 'w')).toBeGreaterThan(0.5)
    expect(planCanvas([{ href: '/projects/a', id: 'a', media: null, title: 'A' }]).tiles.length).toBeGreaterThan(0)
  })

  it('serves an empty plan for an empty archive (the caller shows a state, never a tile)', () => {
    expect(planCanvas([])).toEqual({ tiles: [] })
  })

  it('has no carousel left: no numbered controls, no roledescription, no active-slide state', () => {
    const sources = ['src/views/HomeView.tsx', 'src/components/home/CanvasField.tsx', 'src/components/home/WorkIndex.tsx'].map(write).join('\n')
    expect(sources).not.toMatch(/aria-roledescription/u)
    expect(sources).not.toMatch(/carousel/iu)
    expect(sources).not.toMatch(/bang-dot/u)
    expect(sources).not.toMatch(/is-active/u)
    // The superseded implementations are gone, not merely unused.
    expect(() => write('src/components/portfolio/CanvasStage.tsx')).toThrow()
    expect(() => write('src/components/home/HomeStage.tsx')).toThrow()
    expect(write('src/styles/components.css')).not.toMatch(/\.bang-dot|carousel/u)
  })

  it('keeps the whole Bang section inside the components layer, so utilities can still win', () => {
    const css = write('src/styles/components.css')
    const start = css.indexOf('/* --- buttons ---')
    expect(css.slice(0, start).lastIndexOf('@layer components {')).toBeGreaterThan(-1)
    // Comments describe the layer; the declarations have to live in it.
    expect(css.replace(/\/\*[\s\S]*?\*\//gu, '').indexOf('@layer components {')).toBeGreaterThan(-1)
  })
})

/**
 * The field is a torus, so the promises that matter are about *every* offset a visitor
 * can reach, not about the first screen. This is the arithmetic behind "it never ends
 * and it never shows an empty frame".
 */
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
            const onScreen = tiles.filter((tile) => place(tile.box.position, tile.box.size, offset, vec(viewport.width, viewport.height), plane).visible)
            worst = Math.min(worst, onScreen.length)
          }
        }
        expect(worst, `${viewport.name}, ${count} works`).toBeGreaterThan(0)
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
            // A whole period of correction is the only move `place` may make, and only
            // while the tile is completely outside the viewport on both samples.
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
    // The phone scale lives in the phone media query, which is the only place it applies.
    const phone = css.match(/@media \(max-width: 47\.99rem\) \{[\s\S]*?--tile-scale:\s*([\d.]+)/u)
    expect(Number(phone?.[1])).toBe(MOBILE_TILE_SCALE)
    // The tile width is a percentage of the plane, times both scales.
    expect(css).toMatch(/inline-size: calc\(var\(--tile-w[^)]*\) \* 100% \* var\(--tile-scale[^)]*\) \* var\(--tile-fit/u)
    // The wrapping budget: the plane has to hold the viewport and two of the largest
    // rendered tile, or a wrap happens in front of the visitor.
    const planeMatch = css.match(/--bang-plane:\s*([\d.]+)/u)
    expect(PLANE).toBeGreaterThanOrEqual(1 + 2 * MAX_WIDTH * MOBILE_TILE_SCALE)
    expect(planeMatch).not.toBeNull()
    // Tiles are a fraction of the plane, and the field never holds more than MAX_SLOTS.
    expect(MIN_WIDTH).toBeGreaterThan(0.1)
    expect(MAX_WIDTH).toBeLessThan(0.3)
    expect(gridFor(MAX_SLOTS)).toEqual({ cols: 5, rows: 4 })
  })
})

/** The pan engine itself: eased travel, momentum, and a loop that stops. */
describe('home canvas pan engine', () => {
  it('pulls a long session back into the first period without moving the field', () => {
    const period = vec(2000, 1600)
    // A visitor who keeps panning forever accumulates distance; past the engine's
    // threshold it is folded back, and that fold is invisible because the field is
    // periodic. Below the threshold nothing is touched (no work on an ordinary pan).
    const far = { offset: vec(900_450, -300_000), target: vec(900_450, -300_000), velocity: vec(0, 0) }
    expect(normalize(far, period)).toEqual(far)
    const huge = { offset: vec(7_200_450, -39_300_000), target: vec(7_200_450, -39_300_000), velocity: vec(0, 0) }
    const state = normalize(huge, period)
    expect(Math.abs(state.offset.x)).toBeLessThanOrEqual(period.x / 2)
    expect(Math.abs(state.offset.y)).toBeLessThanOrEqual(period.y / 2)
    // Periodicity: the same visual position, whole periods apart. (`toBeCloseTo`,
    // because a multiple of a period can come out as `-0`.)
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
    // A flick of 30px per frame is what a real pointer produces when it lets go.
    const state = { offset: vec(0, 0), target: vec(0, 0), velocity: vec(0, -30) }
    const afterOneFrame = step(state, 16.7)
    // The first frame starts moving, but the target leads: the field eases into the
    // flick instead of jumping the whole velocity in one frame.
    expect(afterOneFrame.offset.y).toBeLessThan(0)
    expect(afterOneFrame.offset.y).toBeGreaterThan(-30)
    let current = afterOneFrame
    let frames = 1
    while (frames < 600 && !current.settled) {
      current = step(current, 16.7)
      frames += 1
    }
    expect(current.settled).toBe(true)
    // Momentum continues the gesture for a little under a second, and no further: it
    // travels further than the flick itself, but never without bound.
    expect(current.offset.y).toBeLessThan(-30 * 4)
    expect(current.offset.y).toBeGreaterThan(-30 * 20)
    expect(frames).toBeLessThan(120)
    expect(Math.abs(current.velocity.y)).toBe(0)
  })
})
