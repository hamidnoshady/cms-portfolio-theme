// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Gallery } from '@/components/media/Gallery'
import { arrowAdvances } from '@/components/media/Lightbox'

/**
 * The gallery/lightbox contract: a thumbnail opens a real dialog with a localized
 * title over a dedicated full-page backdrop; previous/next controls, their icons,
 * their actions and the Arrow keys all follow the *logical* direction (next advances
 * along the reading direction, so in Persian the next arrow points left); Escape and
 * the close control remove the dialog and focus returns to the thumbnail that opened
 * it; and the grid carries the 2/2/3 responsive contract (the stylesheet side of
 * that contract is pinned in `ui-contract.test.ts`). Focus trapping is Radix's; the
 * open/close and image-change animations are Motion's and are pinned through the
 * states they leave in the DOM. The reduced-motion fallback has its own file, since
 * Motion reads the media query once per module.
 */

const items = [
  { alt: 'نمای نخست', height: 1000, id: 'a', src: '/qa/media/one.png', width: 1500 },
  { alt: 'نمای دوم', height: 1500, id: 'b', src: '/qa/media/two.png', width: 1000 },
  { alt: 'نمای سوم', height: 1000, id: 'c', src: '/qa/media/three.png', width: 1000 },
]

const labels = { close: 'بستن', next: 'بعدی', previous: 'قبلی', title: 'تصاویر' }
const english = { close: 'Close', next: 'Next', previous: 'Previous', title: 'Gallery' }

const thumbs = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('.lightbox-trigger')]

const openFirst = async (): Promise<HTMLElement> => {
  const [first] = thumbs()
  first!.focus()
  fireEvent.click(first!)
  return screen.findByRole('dialog')
}

/** The image currently *settling* in the stage: the last one rendered (an exiting one may still be fading). */
const stageImage = (): HTMLImageElement => {
  const all = document.querySelectorAll<HTMLImageElement>('.lightbox__image')
  return all[all.length - 1]!
}

describe('gallery lightbox: open, close, backdrop', () => {
  it('opens from a thumbnail into a dedicated full-page lightbox and closes from the control', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)

    const triggers = thumbs()
    expect(triggers).toHaveLength(3)
    // Every thumbnail is a real button with an accessible name — never a bare image.
    expect(triggers.every((button) => button.tagName === 'BUTTON' && button.getAttribute('aria-label'))).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()

    const dialog = await openFirst()
    expect(dialog.getAttribute('dir')).toBe('rtl')
    expect(dialog.getAttribute('data-state')).toBe('open')
    expect(dialog.classList.contains('lightbox')).toBe(true)
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۳' })).toBeTruthy()

    // The backdrop is the lightbox's own overlay, not the mobile drawer's.
    const overlay = document.querySelector('.lightbox__overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.getAttribute('data-state')).toBe('open')
    expect(document.querySelector('.drawer__overlay')).toBeNull()
    expect(document.querySelector('.dialog__overlay')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'بستن' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.querySelector('.lightbox__overlay')).toBeNull()
  })

  it('closes on Escape and returns focus to the thumbnail that opened it', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    const [first] = thumbs()
    const dialog = await openFirst()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(first)
  })

  it('closes when the empty stage (the visible backdrop) is clicked, but not when the image is', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    await openFirst()

    fireEvent.click(stageImage())
    expect(screen.queryByRole('dialog')).not.toBeNull()

    fireEvent.click(document.querySelector('.lightbox__stage') as Element)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows the current image and keeps the frame geometry for portrait and landscape alike', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    await openFirst()
    const stage = document.querySelector('.lightbox__stage')
    expect(stage).not.toBeNull()
    // The image sits inside the fixed stage box (absolutely centred by CSS), so a
    // portrait following a landscape cannot move the controls.
    expect(stageImage().closest('.lightbox__stage')).toBe(stage)
    expect(stageImage().getAttribute('src')).toBe('/qa/media/one.png')
    expect(stageImage().getAttribute('width')).toBe('1500')
    expect(stageImage().getAttribute('height')).toBe('1000')
  })
})

describe('gallery lightbox: Persian / RTL direction', () => {
  it('points previous to the right and next to the left, and the clicks agree with the labels', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    await openFirst()

    const previous = screen.getByRole('button', { name: 'قبلی' })
    const next = screen.getByRole('button', { name: 'بعدی' })
    expect(previous.querySelector('svg.lucide-chevron-right')).not.toBeNull()
    expect(next.querySelector('svg.lucide-chevron-left')).not.toBeNull()

    // Visual order in the RTL bar: previous first in DOM = on the right.
    const bar = document.querySelector('.lightbox__bar')
    expect(bar?.children[0]).toBe(previous)

    fireEvent.click(next)
    expect(screen.getByRole('heading', { name: 'تصاویر — ۲ / ۳' })).toBeTruthy()
    await waitFor(() => expect(stageImage().getAttribute('src')).toBe('/qa/media/two.png'))
    fireEvent.click(previous)
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۳' })).toBeTruthy()
    // Previous from the first image wraps to the last.
    fireEvent.click(previous)
    expect(screen.getByRole('heading', { name: 'تصاویر — ۳ / ۳' })).toBeTruthy()
  })

  it('moves with Arrow keys in the reading direction and ignores other keys', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    const dialog = await openFirst()

    // RTL: Left advances to the second image, Right returns to the first.
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۲ / ۳' })).toBeTruthy()
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۳' })).toBeTruthy()

    // Tab/Home are not gallery shortcuts: the position must not change.
    fireEvent.keyDown(dialog, { key: 'Tab' })
    fireEvent.keyDown(dialog, { key: 'Home' })
    expect(screen.getByRole('heading', { name: 'تصاویر — ۱ / ۳' })).toBeTruthy()
  })

  it('slides the incoming image in from the side it logically comes from', async () => {
    render(<Gallery items={items} labels={labels} locale="fa" />)
    const dialog = await openFirst()
    const stage = document.querySelector('.lightbox__stage') as HTMLElement

    // Forward in RTL: the next image enters from the left (negative x) …
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(stage.getAttribute('data-direction')).toBe('forward')
    expect(stageImage().style.transform).toContain('translateX(-14px)')
    await waitFor(() => expect(document.querySelectorAll('.lightbox__image')).toHaveLength(1))

    // … and back enters from the right.
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(stage.getAttribute('data-direction')).toBe('back')
    expect(stageImage().style.transform).toContain('translateX(14px)')
  })
})

describe('gallery lightbox: English / LTR direction', () => {
  it('points previous to the left and next to the right, and the keys and slides follow', async () => {
    render(<Gallery items={items} labels={english} locale="en" />)
    const dialog = await openFirst()
    expect(dialog.getAttribute('dir')).toBe('ltr')

    const previous = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(previous.querySelector('svg.lucide-chevron-left')).not.toBeNull()
    expect(next.querySelector('svg.lucide-chevron-right')).not.toBeNull()

    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'Gallery — 2 / 3' })).toBeTruthy()
    // Forward in LTR: the incoming image enters from the right.
    expect(stageImage().style.transform).toContain('translateX(14px)')
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: 'Gallery — 1 / 3' })).toBeTruthy()

    fireEvent.click(next)
    expect(screen.getByRole('heading', { name: 'Gallery — 2 / 3' })).toBeTruthy()
    fireEvent.click(previous)
    expect(screen.getByRole('heading', { name: 'Gallery — 1 / 3' })).toBeTruthy()
  })

  it('maps the Arrow keys per locale in one place', () => {
    expect(arrowAdvances('ArrowRight', 'en')).toBe(true)
    expect(arrowAdvances('ArrowLeft', 'en')).toBe(false)
    expect(arrowAdvances('ArrowRight', 'fa')).toBe(false)
    expect(arrowAdvances('ArrowLeft', 'fa')).toBe(true)
    expect(arrowAdvances('Enter', 'fa')).toBeNull()
  })
})

describe('gallery grid: the 2/2/3 responsive contract', () => {
  it('renders the shared media grid, with an editor column choice applied on desktop only', () => {
    const { container, rerender } = render(<Gallery items={items} labels={english} locale="en" />)
    const grid = container.querySelector('ul')
    expect(grid?.classList.contains('grid-media')).toBe(true)
    expect(grid?.className).not.toMatch(/grid-media--/u)
    // Thumbnails are sized for 2 columns below the desktop breakpoint and 3 above it.
    expect(container.querySelector('img')?.getAttribute('sizes')).toBe('(min-width: 64rem) 33vw, 50vw')

    rerender(<Gallery columns={2} items={items} labels={english} locale="en" />)
    expect(container.querySelector('ul')?.classList.contains('grid-media--2')).toBe(true)
    rerender(<Gallery columns={4} items={items} labels={english} locale="en" />)
    expect(container.querySelector('ul')?.classList.contains('grid-media--4')).toBe(true)
  })

  it('renders nothing when there are no media items', () => {
    const { container } = render(<Gallery items={[]} labels={labels} locale="en" />)
    expect(container.firstChild).toBeNull()
  })

  it('hides previous/next for a single image but still opens the lightbox', async () => {
    render(<Gallery items={[items[0]!]} labels={labels} locale="fa" />)
    await openFirst()
    expect(screen.queryByRole('button', { name: 'قبلی' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'بعدی' })).toBeNull()
    expect(screen.getByRole('button', { name: 'بستن' })).toBeTruthy()
  })
})
