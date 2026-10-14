// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BrandWordmark } from '@/components/home/BrandWordmark'
import { CanvasField } from '@/components/home/CanvasField'
import { planCanvas, type CanvasWork } from '@/components/home/canvasPlan'
import { CustomCursor } from '@/components/home/CustomCursor'
import { classifyHomeArchiveOutcome } from '@/views/HomeView'

const works: CanvasWork[] = Array.from({ length: 5 }, (_, index) => ({
  href: `/projects/work-${index}`,
  id: `work-${index}`,
  media: { height: 1200, id: `m${index}`, url: `https://media.example.test/${index}.jpg`, width: 1600 },
  meta: `2024 · Housing`,
  title: `Work ${index}`,
}))

const mediaOrigin = 'https://media.example.test'

const stubMatchMedia = (matches: Record<string, boolean>) => {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: Boolean(matches[query]),
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }))
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia, writable: true })
}

beforeEach(() => {
  stubMatchMedia({ '(hover: hover)': true, '(pointer: fine)': true })
  delete document.documentElement.dataset.bangCanvas
  delete document.documentElement.dataset.bangCursor
  delete document.documentElement.dataset.bangIndex
  delete document.documentElement.dataset.bangOverlay
})

const renderField = (motionEnabled = true) =>
  render(
    <CanvasField
      brand="Portfolio1"
      mediaOrigin={mediaOrigin}
      motionEnabled={motionEnabled}
      plan={planCanvas(works)}
      works={works}
    />,
  )

describe('canvas field & accessible project discovery (without WorkIndex)', () => {
  it('renders one bounded link per slot with 0deg settled rotation, and exposes exactly one keyboard-focusable primary tile per distinct work', () => {
    const { container } = renderField()
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>('.bang-canvas__tile')]
    expect(tiles.length).toBe(planCanvas(works).tiles.length)
    expect(tiles.length).toBeLessThanOrEqual(20)

    const primaryTiles = tiles.filter((tile) => tile.dataset.primaryTile === 'true')
    const duplicateTiles = tiles.filter((tile) => tile.dataset.primaryTile !== 'true')

    expect(primaryTiles.length).toBe(works.length)
    expect(primaryTiles.map((tile) => tile.getAttribute('href'))).toEqual(works.map((w) => w.href))
    for (const primary of primaryTiles) {
      expect(primary.getAttribute('tabindex')).toBeNull()
      expect(primary.getAttribute('aria-hidden')).toBeNull()
      expect(primary.getAttribute('aria-label')).toBeTruthy()
      const img = primary.querySelector('img')
      expect(img?.getAttribute('alt')).toBeTruthy()
    }

    for (const dup of duplicateTiles) {
      expect(dup.getAttribute('tabindex')).toBe('-1')
      expect(dup.getAttribute('aria-hidden')).toBe('true')
    }

    tiles.forEach((tile, slot) => {
      expect(tile.getAttribute('href')).toBe(works[slot % works.length]!.href)
      expect(tile.style.getPropertyValue('--tile-x')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-y')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-w')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-ratio')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-rotate')).toBe('0')
    })
  })

  it('separates pan/wrap outer wrapper from GSAP intro wrapper and hover grain layer', () => {
    const { container } = renderField()
    const firstTile = container.querySelector('.bang-canvas__tile')!
    expect(firstTile.querySelector('[data-tile-intro]')).not.toBeNull()
    expect(firstTile.querySelector('[data-tile-media]')).not.toBeNull()
    expect(firstTile.querySelector('[data-tile-grain]')).not.toBeNull()
    expect(container.querySelector('#bang-grain-filter')).not.toBeNull()
    expect(container.querySelectorAll('button').length).toBe(0)
    expect(container.querySelectorAll('[aria-roledescription]').length).toBe(0)
  })

  it('annotates each tile with the context the cursor shows', () => {
    const { container } = renderField()
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>('.bang-canvas__tile')]
    tiles.forEach((tile, slot) => {
      expect(tile.dataset.cursor).toBe('work')
      expect(tile.dataset.cursorLabel).toBe(works[slot % works.length]!.title)
    })
  })

  it('keeps the field in place when motion is disabled, without changing the markup', () => {
    const animated = renderField(false)
    const tiles = [...animated.container.querySelectorAll<HTMLAnchorElement>('.bang-canvas__tile')]
    expect(tiles.length).toBe(planCanvas(works).tiles.length)
    expect(document.documentElement.dataset.bangCanvas).toBeUndefined()
    expect(document.querySelector<HTMLElement>('.bang-canvas__world')?.style.transform).toBe('')
  })

  it('shows an empty field (no tiles, no controls) when the archive is empty', () => {
    const { container } = render(<CanvasField mediaOrigin={mediaOrigin} motionEnabled plan={{ tiles: [] }} works={[]} />)
    expect(container.querySelectorAll('.bang-canvas__tile').length).toBe(0)
  })
})

describe('central BrandWordmark & mask compositing', () => {
  it('renders a single semantic h1 plus aria-hidden difference-blend layers for text wordmarks', () => {
    const { container } = render(<BrandWordmark brand="Portfolio1" />)
    const headings = container.querySelectorAll('h1')
    expect(headings.length).toBe(1)
    expect(headings[0]?.textContent).toBe('Portfolio1')
    expect(headings[0]?.dataset.wordmarkLayer).toBe('base')

    const prep = container.querySelector('[data-wordmark-layer="prep"]')
    const blend = container.querySelector('[data-wordmark-layer="blend"]')
    expect(prep?.getAttribute('aria-hidden')).toBe('true')
    expect(blend?.getAttribute('aria-hidden')).toBe('true')
    expect(prep?.getAttribute('data-wordmark')).toBe('Portfolio1')
    expect(blend?.getAttribute('data-wordmark')).toBe('Portfolio1')
  })

  it('renders uploaded logo artwork as a single semantic h1 image without difference-blend inversion', () => {
    const { container } = render(<BrandWordmark brand="Portfolio1" markUrl="https://media.example.test/logo.svg" />)
    expect(container.querySelectorAll('h1').length).toBe(1)
    expect(container.querySelector('h1 img')?.getAttribute('alt')).toBe('Portfolio1')
    expect(container.querySelector('[data-wordmark-layer="blend"]')).toBeNull()
  })
})

describe('home archive error vs empty classification', () => {
  it('distinguishes upstream archive fetch failure from genuinely empty archive', () => {
    expect(classifyHomeArchiveOutcome({ objectsError: false, projectsError: false, worksCount: 5 })).toBe('ready')
    expect(classifyHomeArchiveOutcome({ objectsError: false, projectsError: false, worksCount: 0 })).toBe('empty')
    expect(classifyHomeArchiveOutcome({ objectsError: true, projectsError: false, worksCount: 0 })).toBe('empty')
    expect(classifyHomeArchiveOutcome({ objectsError: true, projectsError: true, worksCount: 0 })).toBe('error')
  })
})

describe('custom cursor (site-wide filled black square)', () => {
  it('follows the pointer, expands on controls/work, yields to text inputs, and never sits in the hit path', () => {
    stubMatchMedia({ '(hover: hover)': true, '(pointer: fine)': true })
    const { container } = render(<CustomCursor />)
    const cursor = container.querySelector<HTMLElement>('.bang-cursor')!
    expect(cursor.getAttribute('aria-hidden')).toBe('true')
    expect(cursor.querySelector('[data-cursor-square]')).not.toBeNull()
    expect(document.documentElement.dataset.bangCursor).toBe('on')

    const tile = document.createElement('a')
    tile.dataset.cursor = 'work'
    tile.dataset.cursorLabel = 'Cortaderas Norte'
    document.body.append(tile)
    fireEvent.pointerOver(tile)
    expect(cursor.dataset.mode).toBe('work')
    expect(cursor.textContent).toBe('Cortaderas Norte')

    const control = document.createElement('button')
    document.body.append(control)
    fireEvent.pointerOver(control)
    expect(cursor.dataset.mode).toBe('control')
    expect(cursor.textContent).toBe('')

    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    fireEvent.pointerOver(input)
    expect(cursor.getAttribute('data-hidden')).toBe('true')

    fireEvent.pointerMove(window, { clientX: 120, clientY: 90 })
    expect(cursor.style.transform).toContain('translate3d')
    fireEvent.pointerOut(window, { relatedTarget: null })
    expect(cursor.hasAttribute('data-hidden')).toBe(true)
    tile.remove()
    control.remove()
    input.remove()
  })

  it('keeps the system cursor on coarse pointers', () => {
    stubMatchMedia({ '(hover: hover)': false, '(pointer: fine)': false })
    const { container } = render(<CustomCursor />)
    expect(container.querySelector<HTMLElement>('.bang-cursor')!.dataset.enabled).toBeUndefined()
    expect(document.documentElement.dataset.bangCursor).toBe('off')
  })

  it('keeps the system cursor under prefers-reduced-motion', () => {
    stubMatchMedia({ '(hover: hover)': true, '(pointer: fine)': true, '(prefers-reduced-motion: reduce)': true })
    render(<CustomCursor />)
    expect(document.documentElement.dataset.bangCursor).toBe('off')
  })

  it('hands the system cursor back while a case study overlay is open', () => {
    stubMatchMedia({ '(hover: hover)': true, '(pointer: fine)': true })
    render(<CustomCursor />)
    expect(document.documentElement.dataset.bangCursor).toBe('on')
    document.documentElement.dataset.bangOverlay = 'open'
    window.dispatchEvent(new Event('bang:overlay'))
    expect(document.documentElement.dataset.bangCursor).toBe('off')
    delete document.documentElement.dataset.bangOverlay
    window.dispatchEvent(new Event('bang:overlay'))
    expect(document.documentElement.dataset.bangCursor).toBe('on')
  })
})
