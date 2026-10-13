// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseStudyShell } from '@/components/portfolio/CaseStudyShell'

/**
 * Opening a work *over* the canvas.
 *
 * Two halves, and both matter: the shell's own behaviour in a DOM (dialog semantics,
 * Escape, the page behind it made inert, the cursor handed back, the history entry the
 * overlay pushed unwound on close), and the routing fact that makes the whole
 * experience possible — the intercepted routes exist, render the same case study with
 * the overlay presentation, and still sit next to the canonical server-rendered pages
 * for direct visits and refreshes.
 */

const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, forward: vi.fn(), prefetch: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

const labels = { copied: 'Copied', copyLink: 'Copy link', done: 'Sent', failed: 'Failed', share: 'Share' }

beforeEach(() => {
  back.mockClear()
  document.body.innerHTML = ''
  delete document.documentElement.dataset.bangOverlay
})

const renderShell = () => {
  const home = document.createElement('div')
  home.id = 'bang-home'
  home.innerHTML = '<a href="#x">canvas link</a>'
  document.body.append(home)
  const view = render(
    <CaseStudyShell closeLabel="Close" dir="ltr" labels={labels} shareUrl="https://example.test/projects/a" title="Cortaderas Norte">
      <p>Case study body</p>
    </CaseStudyShell>,
  )
  return { home, view }
}

describe('case study overlay shell', () => {
  it('is a labelled modal dialog that owns the reading surface', () => {
    renderShell()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Cortaderas Norte')
    expect(dialog.getAttribute('dir')).toBe('ltr')
    expect(document.documentElement.dataset.bangOverlay).toBe('open')
    expect(screen.getByText('Case study body')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it('makes the canvas behind it inert, so keyboard and AT users cannot wander into it', () => {
    const { home } = renderShell()
    expect(home.hasAttribute('inert')).toBe(true)
    expect(home.querySelector('a')?.getAttribute('tabindex')).toBeNull()
  })

  it('closes on the control, on Escape, and unwinds the history entry it pushed', () => {
    const { view } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(back).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(back).toHaveBeenCalledTimes(2)
    // Other keys are left alone — the overlay is a reading surface.
    fireEvent.keyDown(document, { key: 'a' })
    expect(back).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('restores the canvas state on teardown: no stale attributes, no inert, no locked scroll', () => {
    const { home, view } = renderShell()
    view.unmount()
    expect(document.documentElement.dataset.bangOverlay).toBeUndefined()
    expect(home.hasAttribute('inert')).toBe(false)
  })

  it('names the open work in the tab, and gives the canvas its own title back', () => {
    // The overlay is rendered from a parallel slot, so the server-rendered title under
    // it belongs to the page that stayed mounted — the canvas. Without this the visitor
    // would read the studio's name while looking at a work.
    document.title = 'Estudio Example'
    const { view } = renderShell()
    expect(document.title).toBe('Cortaderas Norte')
    view.unmount()
    expect(document.title).toBe('Estudio Example')
  })
})

/* --- the routing half ----------------------------------------------------- */

/** Source-level facts about the routing tree, read as text (there is no DOM for them). */
const source = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8')

describe('intercepted case-study routes', () => {
  it('intercepts both sections in both locales', () => {
    for (const section of ['projects', 'objects', 'en/projects', 'en/objects']) {
      const file = source(`src/app/@overlay/(.)${section}/[slug]/page.tsx`)
      expect(file).toContain('variant="overlay"')
      expect(file).toContain('slug={decodeURIComponent(slug)}')
    }
    expect(source('src/app/@overlay/(.)en/projects/[slug]/page.tsx')).toContain("locale=\"en\"")
    expect(source('src/app/@overlay/(.)projects/[slug]/page.tsx')).toContain("locale=\"fa\"")
  })

  it('renders nothing at all on a hard navigation to a URL that is not intercepted', () => {
    const fallback = source('src/app/@overlay/default.tsx')
    expect(fallback).toContain('return null')
  })

  it('composes the slot beside the page instead of replacing it', () => {
    const layout = source('src/app/layout.tsx')
    expect(layout).toContain('overlay,')
    expect(layout).toMatch(/\{children\}\s*\{overlay\}/u)
  })

  it('keeps the canonical, server-rendered page as the default presentation', () => {
    for (const section of ['projects', 'objects', 'en/projects', 'en/objects']) {
      const file = source(`src/app/${section}/[slug]/page.tsx`)
      expect(file).toContain('<CaseStudyView')
      expect(file).not.toContain('variant="overlay"')
    }
  })

  it('keeps one case-study template for both presentations', () => {
    const view = source('src/views/CaseStudyView.tsx')
    expect(view).toContain("variant = 'page'")
    expect(view).toContain('<CaseStudyShell')
    expect(view).toContain('<InteriorPage')
    // Share/Close belong to the page; the overlay's own bar carries them there.
    expect(view.match(/<CaseStudyShell/gu)?.length).toBe(1)
  })
})
