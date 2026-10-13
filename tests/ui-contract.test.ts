import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The stylesheet side of the UI contract: numbers and selectors the design brief
 * fixes and a refactor could silently drift. Read as text on purpose — jsdom does
 * not lay out, and these are promises about the *source*, not about a browser.
 */

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const structure = read('src/styles/structure.css')
const components = read('src/styles/components.css')
const tokens = read('src/styles/tokens.css')

/** The CSS block(s) matching `selector` (the text between its `{` and the matching `}`). */
const blocks = (css: string, selector: string): string[] => {
  const out: string[] = []
  const pattern = new RegExp(`(^|[\\s,])${selector.replace(/[.[\]]/gu, '\\$&')}\\s*\\{`, 'gu')
  for (const match of css.matchAll(pattern)) {
    const start = match.index + match[0].length
    out.push(css.slice(start, css.indexOf('}', start)))
  }
  return out
}

/** The media-query bodies in `css` keyed by their condition. */
const mediaQueries = (css: string): Map<string, string[]> => {
  const map = new Map<string, string[]>()
  const pattern = /@media\s*([^{]+)\{/gu
  for (const match of css.matchAll(pattern)) {
    let depth = 1
    let cursor = match.index + match[0].length
    while (depth > 0 && cursor < css.length) {
      const char = css[cursor]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      cursor += 1
    }
    const key = match[1]!.trim()
    map.set(key, [...(map.get(key) ?? []), css.slice(match.index + match[0].length, cursor - 1)])
  }
  return map
}

const px = (css: string, variable: string): number => {
  const match = css.match(new RegExp(`${variable}:\\s*(\\d+(?:\\.\\d+)?)px`, 'u'))
  if (!match) throw new Error(`${variable} is not a px value in:\n${css}`)
  return Number(match[1])
}

describe('media grid: 2 columns on phones and tablets, 3 on desktop', () => {
  it('defaults to two columns and only grows at the 64rem (desktop) breakpoint', () => {
    const [base] = blocks(structure, '.grid-media')
    expect(base).toMatch(/grid-template-columns:\s*repeat\(2,/u)

    const queries = mediaQueries(structure)
    const desktop = (queries.get('(min-width: 64rem)') ?? []).join('\n')
    expect(desktop).toMatch(/\.grid-media\s*\{[^}]*repeat\(3,/u)
    expect(desktop).toMatch(/\.grid-media--2\s*\{[^}]*repeat\(2,/u)
    expect(desktop).toMatch(/\.grid-media--4\s*\{[^}]*repeat\(4,/u)

    // Nothing about the media grid changes at tablet width any more.
    const tablet = (queries.get('(min-width: 48rem)') ?? []).join('\n')
    expect(tablet).not.toContain('.grid-media')
  })

  it('has no second, static grid implementation left behind', () => {
    expect(components).not.toContain('.media-grid__list')
    expect(components).not.toContain('.gallery-item--button')
  })
})

describe('homepage chrome', () => {
  it('styles the shell the home page actually renders', () => {
    // The confirmed bug this guards: `.bang-top` shipped in the markup with no rule
    // anywhere, so the bar had no layout at all.
    for (const selector of ['.bang-top', '.bang-footer', '.bang-stage', '.bang-canvas', '.bang-wordmark', '.bang-index']) {
      const [rule] = blocks(components, selector)
      expect(rule, `${selector} has no style rule`).toBeTruthy()
    }
    const [top] = blocks(components, '.bang-top')
    expect(top).toMatch(/display:\s*flex/u)
    expect(top).toMatch(/min-block-size:\s*var\(--bang-chrome\)/u)
    const [footer] = blocks(components, '.bang-footer')
    expect(footer).toMatch(/justify-content:\s*space-between/u)
  })

  it('takes every tile box from the composition variables', () => {
    const [tile] = blocks(components, '.bang-canvas__tile')
    for (const variable of ['--tile-x', '--tile-y', '--tile-w', '--tile-ratio']) {
      expect(tile, `${variable} is not applied`).toContain(variable)
    }
    // The height cap is a *viewport* proportion, expressed against the plane the tile
    // is measured in (46% desktop, 38% on phones) — not a percentage of the plane.
    expect(tile).toMatch(/max-block-size:\s*calc\(46%\s*\/\s*var\(--bang-plane/u)
    const phone = mediaQueries(components).get('(max-width: 47.99rem)')?.join('\n') ?? ''
    expect(phone).toMatch(/max-block-size:\s*calc\(38%\s*\/\s*var\(--bang-plane/u)
    // The field is bounded by its box, so a wrapped tile can never escape the page.
    const [field] = blocks(components, '.bang-canvas')
    expect(field).toMatch(/overflow:\s*hidden/u)
  })

  it('lays the tiles out in a plane larger than the viewport, and wraps by exactly that plane', () => {
    // The plane is what makes an endless field possible: a composition that only filled
    // one screen leaves an empty frame the moment the visitor pans, and a period that
    // is not the plane would repeat the composition at the wrong distance.
    const [world] = blocks(components, '.bang-canvas__world')
    expect(world).toMatch(/inline-size:\s*calc\(var\(--bang-plane[^)]*\)\s*\*\s*100%\)/u)
    expect(world).toMatch(/block-size:\s*calc\(var\(--bang-plane[^)]*\)\s*\*\s*100%\)/u)
    // Physical offsets on purpose: the composition and the wrapping math share one
    // coordinate system, which the logical properties would mirror in RTL.
    expect(world).toMatch(/left:\s*0/u)
    expect(world).not.toMatch(/inset-inline-start/u)
    const [home] = blocks(components, '.bang-home')
    expect(home).toMatch(/--bang-plane:\s*2/u)
    // The static presentation fits the whole plane in the box instead of clipping it.
    // (Read the raw source: this selector is a compound one the helper's simple
    // pattern is not built for.)
    const staticRule = components.match(/html:not\(\[data-bang-canvas='pan'\]\)\s*\.bang-canvas__world\s*\{([^}]*)\}/u)
    expect(staticRule?.[1], 'the static presentation has no plane rule').toBeTruthy()
    expect(staticRule?.[1]).toMatch(/scale:\s*calc\(1\s*\/\s*var\(--bang-plane/u)
  })

  it('carries no permanent underline on navigation, and marks the current page by weight', () => {
    const [link] = blocks(components, '.bang-nav__link')
    expect(link).toContain('text-decoration: none')
    expect(components).not.toMatch(/text-decoration-line:\s*underline/u)
    const current = blocks(components, ".bang-nav__link[aria-current='page']")
    expect(current[0]).toMatch(/font-weight/u)
  })

  it('has no rules left for the removed home entrance', () => {
    for (const selector of ['.home-row', '.home-menu', '.home-logo', '.home-cue', '.home-bar', '.home-intro', '.menu-row']) {
      expect(components, `${selector} survived the rewrite`).not.toContain(`${selector} `)
    }
    for (const file of ['src/components/home/HomeStage.tsx', 'src/components/portfolio/CanvasStage.tsx']) {
      expect(() => read(file)).toThrow()
    }
  })

  it('keeps the custom cursor out of the hit-testing path and only on capable pointers', () => {
    const [cursor] = blocks(components, '.bang-cursor')
    expect(cursor).toMatch(/pointer-events:\s*none/u)
    expect(cursor).toMatch(/position:\s*fixed/u)
    // Hidden by default; shown only while the client has decided it may run.
    expect(cursor).toContain('display: none')
    expect(components).toContain("html[data-bang-cursor='on'] .bang-cursor { display: block; }")
    // And never over an open case study.
    expect(components).toMatch(/html\[data-bang-overlay='open'\] \.bang-cursor \{ display: none !important; \}/u)
  })

  it('gives the case-study overlay the whole viewport above the canvas, and locks the page behind it', () => {
    const [overlay] = blocks(components, '.bang-overlay')
    expect(overlay).toContain('position: fixed')
    expect(overlay).toContain('inset: 0')
    expect(overlay).toMatch(/overflow-y:\s*auto/u)
    const z = Number(overlay!.match(/z-index:\s*(\d+)/u)?.[1])
    const field = Number(blocks(components, '.bang-canvas')[0]!.match(/z-index:\s*(\d+)/u)?.[1] ?? 0)
    expect(z).toBeGreaterThan(field)
    expect(components).toMatch(/html\[data-bang-overlay='open'\],\s*\n\s*html\[data-bang-overlay='open'\] body \{ overflow: hidden; \}/u)
  })
})

describe('theme tokens the CMS also writes', () => {
  it('keeps the design’s square corners when a tenant theme sets a radius', () => {
    // `themeCss` writes `body{--radius:…}` from the site's settings and is unlayered,
    // which beats `:root` for every element in the document.
    expect(tokens).toMatch(/--radius-square:\s*0px/u)
    const rule = tokens.match(/html body \{\s*--radius: var\(--radius-square\);\s*\}/u)
    expect(rule, 'the radius re-assertion is missing').toBeTruthy()
    // Unlayered: a rule inside `@layer base` would lose to the injected one, whatever
    // its specificity. Comments are stripped so the prose above cannot vouch for the
    // code below.
    const code = tokens.replace(/\/\*[\s\S]*?\*\//gu, '')
    expect(code).not.toMatch(/@layer/u)
    expect(code).toMatch(/html body \{\s*--radius: var\(--radius-square\);\s*\}/u)
  })

  it('ships no hardcoded reference identity in production source', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) walk(full)
        else if (/\.(?:ts|tsx|css)$/u.test(entry.name) && /estudiobang/iu.test(read(full))) offenders.push(full)
      }
    }
    walk('src')
    expect(offenders).toEqual([])
  })
})

describe('overlays', () => {
  it('give the lightbox its own full-page backdrop in the brief’s opacity range', () => {
    const [overlay] = blocks(components, '.lightbox__overlay')
    expect(overlay).toContain('position: fixed')
    expect(overlay).toContain('inset: 0')
    const alpha = Number(overlay!.match(/rgba\(0,\s*0,\s*0,\s*(0?\.\d+)\)/u)?.[1])
    expect(alpha).toBeGreaterThanOrEqual(0.45)
    expect(alpha).toBeLessThanOrEqual(0.55)
    // The lightbox layer stacks above its overlay.
    const [layer] = blocks(components, '.lightbox')
    expect(Number(layer!.match(/z-index:\s*(\d+)/u)?.[1])).toBeGreaterThan(Number(overlay!.match(/z-index:\s*(\d+)/u)?.[1]))
  })

  it('leave the navigation drawer’s wash untouched', () => {
    const [drawer] = blocks(components, '.drawer__overlay')
    expect(drawer).toContain('rgba(0, 0, 0, 0.25)')
  })
})

describe('navbar and logo sizing', () => {
  it('sets the chrome from tokens inside the brief’s ranges per breakpoint', () => {
    const queries = mediaQueries(tokens)
    const base = tokens.slice(0, tokens.indexOf('@media'))
    const tablet = (queries.get('(min-width: 48rem)') ?? []).join('\n')
    const desktop = (queries.get('(min-width: 64rem)') ?? []).join('\n')

    expect(px(base, '--navbar-block')).toBeGreaterThanOrEqual(80)
    expect(px(base, '--navbar-block')).toBeLessThanOrEqual(84)
    expect(px(base, '--logo-block')).toBeGreaterThanOrEqual(40)
    expect(px(base, '--logo-block')).toBeLessThanOrEqual(44)

    expect(px(tablet, '--navbar-block')).toBeGreaterThanOrEqual(86)
    expect(px(tablet, '--navbar-block')).toBeLessThanOrEqual(90)
    expect(px(tablet, '--logo-block')).toBeGreaterThanOrEqual(44)
    expect(px(tablet, '--logo-block')).toBeLessThanOrEqual(48)

    expect(px(desktop, '--navbar-block')).toBeGreaterThanOrEqual(90)
    expect(px(desktop, '--navbar-block')).toBeLessThanOrEqual(96)
    expect(px(desktop, '--logo-block')).toBeGreaterThanOrEqual(48)
    expect(px(desktop, '--logo-block')).toBeLessThanOrEqual(54)
  })

  it('drives the navbar and the logo from those tokens, with no fixed pixel height left', () => {
    const [navbar] = blocks(components, '.navbar__inner')
    expect(navbar).toContain('min-block-size: var(--navbar-block)')
    expect(components).not.toMatch(/min-block-size:\s*68px/u)

    const [logo] = blocks(components, '.navbar__logo')
    expect(logo).toContain('block-size: var(--logo-block)')
    expect(logo).toMatch(/inline-size:\s*auto/u)
    expect(logo).toMatch(/object-fit:\s*contain/u)
    expect(read('src/components/layout/Logo.tsx')).not.toMatch(/\bh-8\b|height=\{?["']?32/u)
  })
})

describe('prose media grids', () => {
  const typography = read('src/styles/typography.css')

  it('a grid inside prose is layout, not a list: no markers, no list indent, no staggered cells', () => {
    const [reset] = blocks(typography, '.prose .grid-media')
    expect(reset).toMatch(/list-style:\s*none/u)
    expect(reset).toMatch(/padding:\s*0/u)
    const spacing = typography.match(/\.prose \.grid-media > li \+ li\s*\{([^}]*)\}/u)?.[1]
    expect(spacing).toMatch(/margin-block-start:\s*0/u)
  })

  it('only text is held to the reading measure; figures use the column width', () => {
    expect(typography).toMatch(/\.prose > :where\([^)]*\bp\b[^)]*\)\s*\{[^}]*max-inline-size:\s*var\(--measure-prose\)/u)
    const [prose] = blocks(typography, '.prose')
    expect(prose ?? '').not.toContain('max-inline-size')
  })

  it('a single named image uses the same label row, as wide as its frame may be', () => {
    expect(components).toContain('.media-titled--content > .media-grid__head {')
    expect(components).toContain('.media-titled--narrow > .media-grid__head {')
  })

  it('the named-grid label has a title, a rule and a count', () => {
    for (const part of ['.media-grid__head', '.media-grid__title', '.media-grid__rule', '.media-grid__count']) {
      expect(components).toContain(`${part} {`)
    }
  })
})

describe('section navigation', () => {
  it('is a rail only for hover-capable desktops, a button + panel everywhere else', () => {
    const queries = [...mediaQueries(components).entries()].filter(([condition]) => condition.includes('hover: hover'))
    expect(queries.map(([condition]) => condition)).toEqual(['(min-width: 64rem) and (hover: hover)'])
    const rail = queries[0]![1].join('\n')
    expect(rail).toMatch(/\.secnav__toggle\s*\{[^}]*display:\s*none/u)
    // Opens on hover and on keyboard focus only — a mouse click must not pin it open.
    expect(rail).toMatch(/\.secnav:hover,\s*\.secnav:has\(:focus-visible\)\s*\{/u)
  })

  it('has no shadows or rounded corners', () => {
    const start = components.indexOf('/* --- in-page navigation (SectionNav)')
    const nav = components.slice(start, components.indexOf('.project-related {'))
    expect(nav).not.toMatch(/box-shadow|border-radius/u)
  })
})

describe('short description typography', () => {
  const typography = read('src/styles/typography.css')

  it('is a supporting voice: smaller than body copy, light, secondary ink, airy', () => {
    const [summary] = blocks(typography, '.type-summary')
    expect(summary).toMatch(/font-size:\s*var\(--text-summary\)/u)
    expect(summary).toMatch(/font-weight:\s*var\(--weight-light\)/u)
    expect(summary).toMatch(/color:\s*var\(--ink-secondary\)/u)
    expect(summary).toMatch(/max-inline-size:\s*var\(--measure-lede\)/u)
    expect(summary).toMatch(/text-wrap:\s*pretty/u)
    // Smaller than body text, looser than body leading.
    expect(Number.parseFloat(tokens.match(/--text-summary:\s*([\d.]+)rem/u)![1]!)).toBeLessThan(1)
    expect(Number(tokens.match(/--leading-summary:\s*([\d.]+)/u)![1])).toBeGreaterThan(Number(tokens.match(/--leading-body:\s*([\d.]+)/u)![1]))
  })

  it('is opened by the drafting dash, not boxed', () => {
    const [lede] = blocks(components, '.project-lede::before')
    expect(lede).toMatch(/background-color:\s*var\(--line-decor-color\)/u)
    const [box] = blocks(components, '.project-lede')
    expect(box).not.toMatch(/border|background/u)
  })
})

describe('project cards', () => {
  it('one frame for every card, and every card in a row starts on the same line', () => {
    const [frame] = blocks(components, '.pcard__frame')
    expect(frame).toMatch(/aspect-ratio:\s*4 \/ 5/u)
    expect(structure).not.toMatch(/\.grid-projects\s*>\s*:nth-child/u)
    expect(blocks(structure, '.grid-projects').join('')).toMatch(/align-items:\s*start/u)
  })

  it('draws a solid line over the hairline on hover and keyboard focus only', () => {
    expect(components).toMatch(/\.pcard__link:hover \.pcard__caption::before,\s*\.pcard__link:focus-visible \.pcard__caption::before\s*\{[^}]*inline-size:\s*100%/u)
    const [line] = blocks(components, '.pcard__caption::before')
    expect(line).toMatch(/inline-size:\s*0/u)
  })
})
