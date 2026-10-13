// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CanvasField } from '@/components/home/CanvasField'
import { planCanvas, type CanvasWork } from '@/components/home/canvasPlan'
import { CustomCursor } from '@/components/home/CustomCursor'
import { WorkIndex } from '@/components/home/WorkIndex'

/**
 * The home canvas in the DOM: bounded tiles, correct click targets, one canonical
 * destination per work, and a cursor that states what it is doing without intercepting
 * input. The geometry and the wrapping arithmetic are covered in `home-canvas.test.ts`;
 * what matters here is what a browser (and a keyboard) would find.
 */

const works: CanvasWork[] = Array.from({ length: 4 }, (_, index) => ({
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

/** jsdom has no `matchMedia`; the canvas asks it for reduced motion on mount. */
beforeEach(() => {
  stubMatchMedia({ '(pointer: fine)': true })
  delete document.documentElement.dataset.bangCanvas
  delete document.documentElement.dataset.bangCursor
  delete document.documentElement.dataset.bangIndex
  delete document.documentElement.dataset.bangOverlay
})

const renderField = (motionEnabled = true) =>
  render(<CanvasField mediaOrigin={mediaOrigin} motionEnabled={motionEnabled} plan={planCanvas(works)} works={works} />)

describe('canvas field', () => {
  it('renders one bounded link per slot, keyed to the work the slot owns', () => {
    const { container } = renderField()
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>('.bang-canvas__tile')]
    expect(tiles.length).toBe(planCanvas(works).tiles.length)
    expect(tiles.length).toBeLessThanOrEqual(20)
    tiles.forEach((tile, slot) => {
      expect(tile.getAttribute('href')).toBe(works[slot % works.length]!.href)
      // The link is decorative by design: the canonical list is the tab stop.
      expect(tile.getAttribute('tabindex')).toBe('-1')
      expect(tile.style.getPropertyValue('--tile-x')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-y')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-w')).not.toBe('')
      expect(tile.style.getPropertyValue('--tile-ratio')).not.toBe('')
    })
  })

  it('is hidden from assistive technology and offers no carousel controls', () => {
    const { container } = renderField()
    const field = container.querySelector('[data-canvas-field]')
    expect(field?.getAttribute('aria-hidden')).toBe('true')
    // No dots, no numbered slider, no slide role — the field is a surface, not a widget.
    expect(container.querySelectorAll('button').length).toBe(0)
    expect(container.querySelectorAll('[aria-roledescription]').length).toBe(0)
    expect(container.querySelectorAll('img').length).toBeGreaterThan(0)
    // Every photograph is decorative here (the index carries the titles).
    for (const image of container.querySelectorAll('img')) expect(image.getAttribute('alt')).toBe('')
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
    // Motion off means no document mode attribute and no transform: the composition is
    // the served one and the page scrolls normally.
    expect(document.documentElement.dataset.bangCanvas).toBeUndefined()
    expect(document.querySelector<HTMLElement>('.bang-canvas__world')?.style.transform).toBe('')
  })

  it('shows an empty field (no tiles, no controls) when the archive is empty', () => {
    const { container } = render(<CanvasField mediaOrigin={mediaOrigin} motionEnabled plan={{ tiles: [] }} works={[]} />)
    expect(container.querySelectorAll('.bang-canvas__tile').length).toBe(0)
  })
})

describe('selected work index', () => {
  const renderIndex = () =>
    render(<WorkIndex browseHref="/projects" browseLabel="Browse projects" labels={{ count: '4 works', index: 'Selected work' }} works={works} />)

  it('carries exactly one canonical destination per work, in publishing order', () => {
    renderIndex()
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.bang-index__link')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(works.map((work) => work.href))
    expect(links[0]!.textContent).toContain('Work 0')
    expect(links[0]!.textContent).toContain('2024 · Housing')
    expect(screen.getByText('Selected work')).toBeTruthy()
  })

  it('is a plain, open section while the canvas is not running', () => {
    renderIndex()
    expect(document.querySelector('.bang-index')?.tagName).toBe('SECTION')
    expect(document.querySelector('.bang-index__label')).not.toBeNull()
    // Nothing to press: without a live canvas there is no control that would do nothing.
    expect(document.querySelector('.bang-index__toggle')).toBeNull()
    expect(document.documentElement.dataset.bangIndex).toBeUndefined()
  })

  it('becomes a disclosure once the canvas owns the page, and records the choice', () => {
    document.documentElement.dataset.bangCanvas = 'pan'
    renderIndex()
    const toggle = document.querySelector<HTMLButtonElement>('.bang-index__toggle')
    expect(toggle).not.toBeNull()
    expect(toggle!.getAttribute('aria-expanded')).toBe('false')
    expect(toggle!.getAttribute('aria-controls')).toBe('bang-works-list')
    fireEvent.click(toggle!)
    expect(document.documentElement.dataset.bangIndex).toBe('open')
    expect(document.querySelector('.bang-index__toggle')!.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(document.querySelector('.bang-index__toggle')!)
    expect(document.documentElement.dataset.bangIndex).toBeUndefined()
    expect(document.querySelector('.bang-index__toggle')!.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('custom cursor', () => {
  it('follows the pointer, states the hovered work and never sits in the hit path', () => {
    stubMatchMedia({ '(pointer: fine)': true })
    const { container } = render(<CustomCursor />)
    const cursor = container.querySelector<HTMLElement>('.bang-cursor')!
    expect(cursor.getAttribute('aria-hidden')).toBe('true')
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

    fireEvent.pointerMove(window, { clientX: 120, clientY: 90 })
    expect(cursor.style.transform).toContain('translate3d')
    // A pointer leaving the window parks it rather than leaving a square behind.
    fireEvent.pointerOut(window, { relatedTarget: null })
    expect(cursor.hasAttribute('data-hidden')).toBe(true)
    tile.remove()
    control.remove()
  })

  it('keeps the system cursor on coarse pointers', () => {
    stubMatchMedia({ '(pointer: fine)': false })
    const { container } = render(<CustomCursor />)
    expect(container.querySelector<HTMLElement>('.bang-cursor')!.dataset.enabled).toBeUndefined()
    expect(document.documentElement.dataset.bangCursor).toBe('off')
  })

  it('keeps the system cursor under prefers-reduced-motion', () => {
    stubMatchMedia({ '(pointer: fine)': true, '(prefers-reduced-motion: reduce)': true })
    render(<CustomCursor />)
    expect(document.documentElement.dataset.bangCursor).toBe('off')
  })

  it('hands the system cursor back while a case study is open', () => {
    stubMatchMedia({ '(pointer: fine)': true })
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
