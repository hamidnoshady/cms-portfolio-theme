// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * `prefers-reduced-motion`: the lightbox still opens, still steps, still closes — it
 * just does so instantly. Motion reads the media query once per module load, so the
 * stub has to be in place before `Gallery` (and through it `motion/react`) is
 * imported; hence the dynamic import and the dedicated file.
 */

const stubReducedMotion = () => {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }))
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia, writable: true })
}

const items = [
  { alt: 'One', height: 1000, id: 'a', src: '/qa/media/one.png', width: 1500 },
  { alt: 'Two', height: 1500, id: 'b', src: '/qa/media/two.png', width: 1000 },
]
const labels = { close: 'Close', next: 'Next', previous: 'Previous', title: 'Gallery' }

describe('lightbox under prefers-reduced-motion', () => {
  it('opens, changes image and closes without the slide offset or a lingering exit', async () => {
    stubReducedMotion()
    const { Gallery } = await import('@/components/media/Gallery')
    render(<Gallery items={items} labels={labels} locale="en" />)

    const [first] = document.querySelectorAll<HTMLButtonElement>('.lightbox-trigger')
    fireEvent.click(first!)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('data-reduced-motion')).toBe('true')

    // The image changes in place: no horizontal travel on the incoming image.
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'Gallery — 2 / 2' })).toBeTruthy()
    const images = document.querySelectorAll<HTMLImageElement>('.lightbox__image')
    const incoming = images[images.length - 1]!
    expect(incoming.getAttribute('src')).toBe('/qa/media/two.png')
    expect(incoming.style.transform).not.toContain('translateX(14px)')
    expect(incoming.style.transform).not.toContain('translateX(-14px)')

    fireEvent.keyDown(dialog, { key: 'Escape' })
    // Closing is immediate as well: the dialog is gone within the same tick.
    expect(await screen.findByRole('button', { name: 'One' })).toBeTruthy()
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 100 })
    expect(document.activeElement).toBe(first)
  })
})
