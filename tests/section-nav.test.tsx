// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from '@/components/navigation/SectionNav'

/**
 * The in-page navigation's behaviour: it follows the reader's position, a click scrolls
 * to the section once (and keeps the hash), and the touch/narrow presentation opens and
 * closes its panel from the button, Escape and an outside press. Layout (rail vs
 * button) is the stylesheet's and is pinned in `ui-contract.test.ts`.
 */

const items = [
  { id: 'section-1', label: 'رندرها', level: 1 as const },
  { id: 'section-2', label: 'طبقه همکف و لابی', level: 2 as const },
  { id: 'section-3', label: 'پلان', level: 1 as const },
]

const tops: Record<string, number> = {}

beforeEach(() => {
  for (const item of items) {
    const element = document.createElement('div')
    element.id = item.id
    element.getBoundingClientRect = () => ({ top: tops[item.id] ?? 5000 }) as DOMRect
    document.body.append(element)
  }
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 10000 })
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }) as typeof window.requestAnimationFrame
  window.scrollTo = vi.fn() as never
  window.matchMedia = ((query: string) => ({ addEventListener() {}, matches: false, media: query, removeEventListener() {} })) as never
})

afterEach(() => {
  document.body.innerHTML = ''
  for (const key of Object.keys(tops)) delete tops[key]
  window.history.replaceState(null, '', '/')
})

const scrollTo = (y: number) => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('SectionNav', () => {
  it('lists real anchors, two levels, named by the section label', () => {
    render(<SectionNav items={items} label="بخش‌های صفحه" locale="fa" />)
    const nav = screen.getByRole('navigation', { name: 'بخش‌های صفحه' })
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#section-1', '#section-2', '#section-3'])
    expect([...nav.querySelectorAll('li')].map((li) => li.getAttribute('data-level'))).toEqual(['1', '2', '1'])
    expect(nav.querySelector('[aria-current]')).toBeNull()
  })

  it('marks the section being read (past 35% of the viewport) and shows the count in the button', () => {
    render(<SectionNav items={items} label="بخش‌های صفحه" locale="fa" />)
    tops['section-1'] = -900
    tops['section-2'] = 200
    scrollTo(800)

    const current = document.querySelector('[aria-current="location"]')
    expect(current?.getAttribute('href')).toBe('#section-2')
    const toggle = screen.getByRole('button')
    expect(toggle.textContent).toContain('طبقه همکف و لابی')
    expect(toggle.textContent).toContain('۲/۳')
    expect(document.querySelector('.secnav')?.getAttribute('data-scrolled')).toBe('true')
  })

  it('scrolls once to the section on click, keeps the hash and does not leave the page', () => {
    const bubbled = vi.fn()
    document.addEventListener('click', bubbled)
    render(<SectionNav items={items} label="بخش‌های صفحه" locale="fa" />)
    const link = document.querySelector<HTMLAnchorElement>('a[href="#section-3"]')!

    const notPrevented = fireEvent.click(link)

    expect(notPrevented).toBe(false)
    expect(bubbled).not.toHaveBeenCalled()
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#section-3')
    expect(link.getAttribute('aria-current')).toBe('location')
    document.removeEventListener('click', bubbled)
  })

  it('opens from the button and closes on selection, Escape and an outside press', () => {
    render(<SectionNav items={items} label="بخش‌های صفحه" locale="fa" />)
    const toggle = screen.getByRole('button')
    const state = () => document.querySelector('.secnav')?.getAttribute('data-open')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(state()).toBe('true')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-controls')).toBe(document.querySelector('.secnav__list')?.id)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(state()).toBe('false')

    fireEvent.click(toggle)
    fireEvent.pointerDown(document.body)
    expect(state()).toBe('false')

    fireEvent.click(toggle)
    fireEvent.click(document.querySelector('a[href="#section-1"]')!)
    expect(state()).toBe('false')
  })
})
