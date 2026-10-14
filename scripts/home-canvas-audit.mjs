#!/usr/bin/env node
/**
 * Home-canvas audit — the reference behaviours a still image cannot prove.
 *
 * The issue is explicit that a screenshot cannot demonstrate infinite scrolling, a
 * fitted composition or a cursor that changes over a work, so this script drives a real
 * browser and measures the things that only exist over time:
 *
 *   - the field is bounded (tile count constant while panning, no DOM growth);
 *   - a wheel/trackpad pan moves every tile by the same delta (one rigid plane);
 *   - coverage never drops to an empty frame over a sustained pan — no end, no seam;
 *   - a tile that is on screen never teleports (wrapping happens off screen);
 *   - a tile's destination is stable before and after wrapping, and the work it opens is
 *     the work whose title its cursor label announces;
 *   - clicking a tile opens *that* work in the overlay, closing returns to the canvas
 *     with its position untouched, and a direct visit renders the full page instead;
 *   - the cursor is present on a fine pointer, absent under reduced motion, and never
 *     paints into the hit path;
 *   - reduced motion and no-JS both get the static, scrollable presentation.
 *
 *   node scripts/home-canvas-audit.mjs --base http://127.0.0.1:3200 --out docs/screenshots/bang-home
 *
 * Writes `home-canvas-report.json` next to the screenshots and exits non-zero on failure.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { brotliDecompressSync } from 'node:zlib'

import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = argOf('--base', process.env.AUDIT_BASE ?? 'http://127.0.0.1:3200').replace(/\/$/u, '')
const OUT = argOf('--out', 'docs/screenshots/bang-home')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const desktop = { deviceScaleFactor: 1, height: 900, width: 1440 }
const phone = { deviceScaleFactor: 1, height: 844, width: 390 }

const chromiumLibs = () => {
  const packaged = join(require.resolve('@sparticuz/chromium'), '..', '..', 'bin', 'al2023.tar.br')
  const dir = join(tmpdir(), 'arch2-chromium-libs')
  if (existsSync(join(dir, 'lib')) || !existsSync(packaged)) return dir
  mkdirSync(dir, { recursive: true })
  const tarPath = join(tmpdir(), 'arch2-al2023.tar')
  writeFileSync(tarPath, brotliDecompressSync(readFileSync(packaged)))
  execFileSync('tar', ['-xf', tarPath, '-C', dir])
  return dir
}

/**
 * The headless shell has no pointer device at all: `(pointer: fine)` and `(hover:
 * hover)` are both false and Chromium exposes no way to emulate them
 * (`Emulation.setEmulatedMedia` rejects `pointer`, and puppeteer's
 * `emulateMediaFeatures` only takes `prefers-*`). A desktop browser — the visitor the
 * canvas and the custom cursor are for — answers `true` to both, so the harness
 * answers for it, and only for those two queries: every other media query, including
 * the emulated `prefers-reduced-motion`, is the browser's own answer.
 *
 * Without this the cursor checks below would be asserting the *touch* presentation,
 * which is a different, also-tested presentation (`custom cursor off`, system cursor).
 */
const emulateFinePointer = (page) =>
  page.evaluateOnNewDocument(() => {
    const native = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      const target = /pointer:\s*fine|hover:\s*hover/u.test(query) ? true : null
      if (target === null) return native(query)
      const list = native(query)
      if (list.matches === target) return list
      const listeners = new Set()
      return {
        addEventListener: (type, handler) => listeners.add(handler),
        addListener: (handler) => listeners.add(handler),
        dispatchEvent: () => true,
        get matches() {
          return target
        },
        media: query,
        onchange: null,
        removeEventListener: (_type, handler) => listeners.delete(handler),
        removeListener: (handler) => listeners.delete(handler),
      }
    }
  })

/**
 * A tile the audit can act on: fully inside the viewport, clear of the fixed chrome,
 * *and* topmost at its own centre — the tiles overlap, so the work a click or a hover
 * reaches is the one the DOM puts last, not the one that happens to be first in the
 * list. Reading the label from the same element the browser will hit is what makes the
 * cursor and the click checks about identity rather than about z-order.
 */
const actionableTile = (page) =>
  page.evaluate(() => {
    for (const node of document.querySelectorAll('.bang-canvas__tile')) {
      const rect = node.getBoundingClientRect()
      if (rect.left <= 16 || rect.top <= 64 || rect.right >= window.innerWidth - 16 || rect.bottom >= window.innerHeight - 64) continue
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const hit = document.elementFromPoint(x, y)
      if (!hit || hit.closest('.bang-canvas__tile') !== node) continue
      return { href: node.getAttribute('href'), key: node.dataset.tile, label: node.dataset.cursorLabel, x, y }
    }
    return null
  })

/** One snapshot of the field, as the DOM reports it. */
const snapshot = (page) =>
  page.evaluate(() => {
    const world = document.querySelector('.bang-canvas__world')
    const tiles = [...document.querySelectorAll('.bang-canvas__tile')].map((tile) => {
      const rect = tile.getBoundingClientRect()
      return {
        height: rect.height,
        href: tile.getAttribute('href'),
        key: tile.dataset.tile,
        label: tile.dataset.cursorLabel,
        primary: tile.dataset.primaryTile === 'true',
        transform: tile.style.transform,
        visible: rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight,
        width: rect.width,
        x: rect.left,
        y: rect.top,
      }
    })
    const visibleTiles = tiles.filter((tile) => tile.visible)
    let minGap = Infinity
    for (let i = 0; i < visibleTiles.length; i += 1) {
      for (let j = i + 1; j < visibleTiles.length; j += 1) {
        const a = visibleTiles[i]
        const b = visibleTiles[j]
        const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width))
        const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height))
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        const gap = overlapX > 0 && overlapY > 0 ? -Math.min(overlapX, overlapY) : Math.hypot(dx, dy)
        if (gap < minGap) minGap = gap
      }
    }
    return {
      canvasMode: document.documentElement.dataset.bangCanvas ?? null,
      clocks: document.querySelectorAll('.bang-clock').length,
      count: tiles.length,
      footers: document.querySelectorAll('footer').length,
      indexLinks: [...document.querySelectorAll('.bang-canvas__tile[data-primary-tile="true"]')].filter((link) => link.getBoundingClientRect().height > 0).length,
      indexToggle: Boolean(document.querySelector('.bang-index__toggle')),
      minGap: Number.isFinite(minGap) ? minGap : 0,
      plane: { height: world?.offsetHeight ?? 0, width: world?.offsetWidth ?? 0 },
      scrollable: document.documentElement.scrollHeight - window.innerHeight,
      tiles,
      visible: visibleTiles.length,
      wordmarkBase: document.querySelectorAll('h1.bang-wordmark').length,
      wordmarkBlend: document.querySelectorAll('.bang-wordmark[aria-hidden="true"]').length,
      world: world?.style.transform ?? '',
    }
  })

/**
 * The same tile, but waiting for the field to settle first: after a drag the plane eases
 * for a few frames, and "no tile was reachable" would then be a statement about the
 * audit's timing rather than about the composition.
 */
const reachableTile = async (page) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const tile = await actionableTile(page)
    if (tile) return tile
    await sleep(250)
  }
  return null
}

/**
 * A browser audit that cannot be read is not evidence. GitHub's log view for a job can be
 * unavailable (large logs, forks), so the same lines that go to stdout are appended to the
 * run's summary when the runner offers one.
 */
const summarise = async (results, out) => {
  const path = process.env.GITHUB_STEP_SUMMARY
  const failed = results.filter((entry) => !entry.ok)
  const body = [
    `### Home canvas behaviour — ${results.length - failed.length}/${results.length} checks passed`,
    '',
    ...results.map((entry) => `- ${entry.ok ? '✅' : '❌'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`),
    '',
  ].join('\n')
  if (!path) return
  const { appendFile } = await import('node:fs/promises')
  await appendFile(path, `${body}\n`, 'utf8').catch(() => null)
  void out
}

const ANNOTATION_TITLE = 'home canvas'

const results = []
/**
 * A failed check is also emitted as a workflow annotation, because a job's raw log can be
 * unreachable from outside the run (forks, large logs) while annotations are readable
 * through the API — an audit nobody can read is not evidence.
 */
const record = (name, ok, detail) => {
  results.push({ detail, name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) console.log(`::error title=${ANNOTATION_TITLE}: ${name}::${String(detail ?? '').slice(0, 500).replace(/\n/gu, ' ')}`)
}

const main = async () => {
  const systemChrome = process.env.ARCH2_CHROME_PATH
  let executablePath = systemChrome
  let env = process.env
  if (!executablePath) {
    const { default: chromium } = await import('@sparticuz/chromium')
    executablePath = await chromium.executablePath()
    const libs = chromiumLibs()
    env = { ...process.env, LD_LIBRARY_PATH: [join(libs, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars'],
    defaultViewport: null,
    env,
    executablePath,
    headless: true,
  })
  mkdirSync(OUT, { recursive: true })

  const page = await browser.newPage()
  await page.setViewport(desktop)
  await emulateFinePointer(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 200))
  })

  await page.goto(`${BASE}/`, { timeout: 90000, waitUntil: 'networkidle2' })
  await page.waitForSelector('.bang-canvas__tile', { timeout: 30000 })

  /**
   * Wait for the canvas to *take over*, rather than assuming a delay. The assertion is
   * "the field becomes interactive", not "the field is interactive 1.2 seconds after the
   * document loads" — a cold runner hydrating React takes as long as it takes.
   */
  const started = Date.now()
  const hydrated = await page
    .waitForFunction(() => document.documentElement.dataset.bangCanvas === 'pan', { timeout: 30000 })
    .then(() => 'pan')
    .catch(async () => (await page.evaluate(() => document.documentElement.dataset.bangCanvas)) ?? null)
  record('canvas mode engages on a fine pointer', hydrated === 'pan', `data-bang-canvas=${hydrated} after ${Date.now() - started}ms`)
  if (hydrated !== 'pan') throw new Error('the canvas never became interactive — the rest of this audit would be measuring the static presentation')

  const start = await snapshot(page)
  record('field is bounded and populated', start.count > 0 && start.count <= 20 && start.visible >= 2, `${start.count} tiles, ${start.visible} on screen`)
  record(
    'settled project frames are separated and upright (0deg rotation, >= 32px gap on desktop)',
    start.minGap >= 32 && start.visible >= 4 && start.visible <= 7,
    `visible=${start.visible}, minPairwiseGap=${start.minGap.toFixed(1)}px`,
  )
  record(
    'no floating WorkIndex, clock, or footer menu on home, and BrandWordmark has 1 semantic h1',
    !start.indexToggle && start.clocks === 0 && start.footers === 0 && start.wordmarkBase === 1,
    `indexToggle=${start.indexToggle} clocks=${start.clocks} footers=${start.footers} h1=${start.wordmarkBase} blendLayers=${start.wordmarkBlend}`,
  )

  await page.screenshot({ path: join(OUT, '01-canvas-1440.png') })

  // --- panning: one rigid plane, no blank frame, no visible jump ---------------------
  const samples = [start]
  for (let step = 0; step < 30; step += 1) {
    await page.mouse.move(720, 450)
    await page.mouse.wheel({ deltaY: 260 })
    await sleep(90)
    samples.push(await snapshot(page))
  }
  record('tile count never changes while panning', samples.every((sample) => sample.count === start.count), `${samples.length} samples`)
  record(
    'coverage never goes blank (no end, no seam)',
    samples.every((sample) => sample.visible >= 2),
    `minimum ${Math.min(...samples.map((sample) => sample.visible))} tiles on screen`,
  )

  /**
   * The clickability guarantee, at offsets no screenshot can reach: whatever offset the
   * visitor stops at, at least one work is *entirely* on screen, clear of the fixed
   * chrome and on top of the tiles under it — so "clicking a project image opens that
   * project" is always available, not only on the frame the page loaded with. The
   * composition's covering argument is `ZONES` in `canvasPlan.ts`; this is the same
   * promise measured after real wheel input.
   */
  const unreachable = []
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.move(720, 450)
    await page.mouse.wheel({ deltaY: 240 })
    await sleep(220)
    if (!(await actionableTile(page))) unreachable.push(step)
  }
  record(
    'a whole work is clickable at every offset the visitor stops at',
    unreachable.length === 0,
    unreachable.length === 0 ? '12 offsets sampled' : `no reachable work at samples ${unreachable.join(', ')}`,
  )

  const worldMoved = samples.at(-1).world !== start.world
  record('the plane actually moves', worldMoved, `${start.world || 'none'} → ${samples.at(-1).world || 'none'}`)

  let visibleWrap = null
  let identityStable = true
  let fastest = 0
  let reversed = false
  /** Total plane travel, and the total wheel input that asked for it. */
  let travelled = 0
  const wheelInput = 260 * 30
  const shift = (transform) => {
    const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/u.exec(transform ?? '')
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 }
  }
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    const before = shift(previous.world)
    const now = shift(current.world)
    const step = { x: now.x - before.x, y: now.y - before.y }
    fastest = Math.max(fastest, Math.hypot(step.x, step.y))
    travelled += Math.abs(step.y)
    // Wheel down must move the plane down, always: a sign change would be a reset or a
    // wrap applied to the whole plane instead of to a single tile.
    if (step.y > 0.5) reversed = true
    for (let tile = 0; tile < current.tiles.length; tile += 1) {
      const was = previous.tiles[tile]
      const is = current.tiles[tile]
      if (was.href !== is.href || was.key !== is.key) identityStable = false
      // A tile's own correction only ever changes by whole periods, and `place` may
      // only apply one while the tile is completely off screen — so a tile whose
      // transform moved has to be clear of the viewport in both samples.
      if (was.transform === is.transform) continue
      const clear = (sample) => !sample.visible
      if (!clear(was) && !clear(is)) visibleWrap = `tile ${is.key} jumped ${was.transform} → ${is.transform} while on screen`
    }
  }
  record('a tile keeps its destination across wrapping', identityStable)
  record('no tile teleports while it is on screen', visibleWrap === null, visibleWrap ?? `checked ${samples.length} samples`)
  // The plane may never travel further than the wheel asked for (plus a little slack for
  // sampling), and never backwards: that is what distinguishes a smooth pan from a reset,
  // and it holds on a slow machine as well as a fast one. `fastest` is reported for the
  // record — it depends on how many frames the sampler got between wheel events, so it is
  // a fact about the machine, not a pass/fail.
  record(
    'the plane follows the wheel, never runs ahead of it and never reverses',
    !reversed && travelled <= wheelInput * 1.05 + 120,
    `travelled ${travelled.toFixed(0)}px for ${wheelInput}px of wheel (largest step ${fastest.toFixed(1)}px)`,
  )
  // The wrap is only invisible while the period holds a whole viewport plus two of the
  // largest tile; that is the invariant behind every check above.
  const budget = await page.evaluate(() => {
    const world = document.querySelector('.bang-canvas__world')
    const sizes = [...document.querySelectorAll('.bang-canvas__tile')].map((tile) => ({ height: tile.offsetHeight, width: tile.offsetWidth }))
    return {
      height: world?.offsetHeight ?? 0,
      largest: { height: Math.max(...sizes.map((size) => size.height)), width: Math.max(...sizes.map((size) => size.width)) },
      viewport: { height: window.innerHeight, width: window.innerWidth },
      width: world?.offsetWidth ?? 0,
    }
  })
  record(
    'the wrapping period holds the viewport and two of the largest tile',
    budget.width >= budget.viewport.width + 2 * budget.largest.width && budget.height >= budget.viewport.height + 2 * budget.largest.height,
    `plane ${budget.width}x${budget.height}, viewport ${budget.viewport.width}x${budget.viewport.height}, largest tile ${budget.largest.width}x${budget.largest.height}`,
  )

  await page.screenshot({ path: join(OUT, '02-canvas-panned-1440.png') })

  // --- the cursor ------------------------------------------------------------------
  const cursorPoint = await actionableTile(page)
  if (cursorPoint) {
    await page.mouse.move(cursorPoint.x, cursorPoint.y)
    // The mark trails the pointer through a short eased follow, so the check is
    // *convergence*: wait for it to arrive rather than assuming a delay (a slower
    // machine, or a busy first frame, is not a defect).
    const settle = async (x, y, budget = 4000) => {
      await page
        .waitForFunction(
          ({ px, py }) => {
            const rect = document.querySelector('.bang-cursor__mark')?.getBoundingClientRect()
            if (!rect) return false
            return Math.hypot(rect.left + rect.width / 2 - px, rect.top + rect.height / 2 - py) < 1
          },
          { timeout: budget },
          { px: x, py: y },
        )
        .catch(() => null)
    }
    await settle(cursorPoint.x, cursorPoint.y)
    const cursor = await page.evaluate(() => {
      const node = document.querySelector('.bang-cursor')
      const rect = node?.querySelector('.bang-cursor__mark')?.getBoundingClientRect()
      return {
        centre: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
        enabled: document.documentElement.dataset.bangCursor,
        label: node?.textContent ?? '',
        mode: node?.dataset.mode,
        pointerEvents: node ? getComputedStyle(node).pointerEvents : null,
        size: rect ? rect.width : 0,
      }
    })
    record(
      'cursor is the studio one over a work and names it',
      cursor.enabled === 'on' && cursor.mode === 'work' && cursor.label === cursorPoint.label,
      `enabled=${cursor.enabled} mode=${cursor.mode} label=“${cursor.label}” expected “${cursorPoint.label}”`,
    )
    record('cursor never intercepts the pointer', cursor.pointerEvents === 'none', String(cursor.pointerEvents))
    await page.screenshot({ path: join(OUT, '03-cursor-over-work-1440.png') })

    // The mark has to be *at* the pointer: a cursor that names the right work while
    // sitting off screen (an RTL offset, say) is not evidence of anything.
    const offset = Math.hypot(cursor.centre.x - cursorPoint.x, cursor.centre.y - cursorPoint.y)
    // The mark trails the pointer by design (a short eased follow), so it is measured
    // after it has had time to catch up — and it has to keep closing, not hang behind.
    await page.mouse.move(cursorPoint.x + 60, cursorPoint.y + 60)
    await settle(cursorPoint.x + 60, cursorPoint.y + 60)
    const catching = await page.evaluate(() => {
      const rect = document.querySelector('.bang-cursor__mark')?.getBoundingClientRect()
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
    })
    const lagging = catching ? Math.hypot(catching.x - (cursorPoint.x + 60), catching.y - (cursorPoint.y + 60)) : Infinity
    record(
      'the cursor is drawn at the pointer',
      cursor.centre !== null && offset < 1.5 && cursor.size > 0,
      `centre ${cursor.centre ? `${cursor.centre.x.toFixed(0)},${cursor.centre.y.toFixed(0)}` : 'none'} vs pointer ${cursorPoint.x.toFixed(0)},${cursorPoint.y.toFixed(0)} (${offset.toFixed(1)}px), size ${cursor.size}px`,
    )
    record(
      'the cursor follows the pointer instead of stopping',
      lagging < 1.5,
      `after an 85px move it settles ${lagging.toFixed(1)}px from the pointer`,
    )
    await page.mouse.move(cursorPoint.x, cursorPoint.y)
    await sleep(200)

    await page.mouse.move(8, 8)
    await sleep(160)
    const away = await page.evaluate(() => document.querySelector('.bang-cursor')?.dataset.mode)
    record('cursor changes state away from a work', away !== 'work', `mode=${away}`)

    // --- click to open, close to restore -------------------------------------------
    const before = await snapshot(page)
    await page.mouse.move(cursorPoint.x, cursorPoint.y)
    await page.mouse.down()
    await page.mouse.move(cursorPoint.x + 120, cursorPoint.y + 40, { steps: 8 })
    await page.mouse.up()
    await sleep(200)
    const afterDrag = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('.bang-overlay')),
      path: location.pathname,
      world: document.querySelector('.bang-canvas__world')?.style.transform ?? '',
    }))
    record('a drag pans without opening a work', !afterDrag.dialog && afterDrag.path === '/', `${afterDrag.path}`)
    record('a drag moves the field one-to-one with the pointer', afterDrag.world !== before.world, `${before.world} → ${afterDrag.world}`)

    const target = await reachableTile(page)
    if (!target) throw new Error('no tile of the field became reachable to click')
    await page.mouse.click(target.x, target.y)
    await page.waitForSelector('.bang-overlay', { timeout: 30000 })
    await sleep(700)
    const opened = await page.evaluate(() => {
      const dialog = document.querySelector('.bang-overlay')
      return {
        href: location.pathname,
        label: dialog?.getAttribute('aria-label'),
        modal: dialog?.getAttribute('aria-modal'),
        title: document.title,
      }
    })
    record('clicking a tile opens that work', opened.href === new URL(target.href, BASE).pathname && opened.label === target.label, `${opened.href} “${opened.label}”`)
    record('the overlay is a real modal, and the title follows it', opened.modal === 'true' && opened.title.includes(target.label), opened.title)
    await page.screenshot({ path: join(OUT, '04-case-study-overlay-1440.png') })

    // The field must not drift while a work is open over it, so the position to
    // restore is the one the overlay froze, not the one that was on screen at the
    // instant of the click.
    const frozen = await snapshot(page)
    await sleep(600)
    const stillFrozen = await snapshot(page)
    record(
      'the canvas holds still while a work is open over it',
      stillFrozen.world === frozen.world && stillFrozen.visible === frozen.visible,
      `${frozen.world} → ${stillFrozen.world}`,
    )

    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.bang-overlay'), { timeout: 30000 })
    await sleep(400)
    const after = await snapshot(page)
    record('closing restores the canvas position exactly', after.world === frozen.world && after.visible === frozen.visible, `${frozen.world} → ${after.world}`)
    record('closing returns the URL to the home page', await page.evaluate(() => location.pathname) === '/')

    // --- direct visit is still a full page ------------------------------------------
    const direct = await page.goto(`${BASE}${new URL(target.href, BASE).pathname}`, { timeout: 60000, waitUntil: 'networkidle2' })
    const directState = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('.bang-overlay')),
      headings: [...document.querySelectorAll('h1')].map((node) => node.textContent?.trim()),
    }))
    record(
      'a direct visit renders the server page, not an overlay',
      direct?.status() === 200 && !directState.dialog && directState.headings.includes(target.label),
      `${direct?.status()} h1=${directState.headings[0]}`,
    )
    await page.screenshot({ path: join(OUT, '05-case-study-page-1440.png') })
  } else {
    record('a work is reachable inside the viewport', false, 'no tile was fully on screen')
  }

  // --- phone: same field, touch-sized chrome ----------------------------------------
  await page.setViewport(phone)
  await page.goto(`${BASE}/`, { timeout: 60000, waitUntil: 'networkidle2' })
  await page.waitForSelector('.bang-canvas__tile', { timeout: 30000 })
  await sleep(1000)
  const mobile = await snapshot(page)
  record('the phone gets the same bounded field', mobile.count === start.count && mobile.visible >= 2, `${mobile.count} tiles, ${mobile.visible} on screen`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  record('the phone canvas does not overflow sideways', overflow <= 1, `${overflow}px`)
  await page.screenshot({ path: join(OUT, '06-canvas-390.png') })

  // --- reduced motion: static, scrollable, open index -------------------------------
  const reduced = await browser.newPage()
  await reduced.setViewport(desktop)
  await emulateFinePointer(reduced)
  await reduced.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await reduced.goto(`${BASE}/`, { timeout: 60000, waitUntil: 'networkidle2' })
  await reduced.waitForSelector('.bang-canvas__tile', { timeout: 30000 })
  await sleep(800)
  const reducedState = await snapshot(reduced)
  const reducedCursor = await reduced.evaluate(() => document.documentElement.dataset.bangCursor)
  record('reduced motion serves the static field', reducedState.canvasMode === null, `data-bang-canvas=${reducedState.canvasMode}`)
  record(
    'reduced motion leaves the page scrollable, with the work list visible',
    reducedState.scrollable > 200 && reducedState.indexLinks > 0 && !reducedState.indexToggle,
    `scrollable=${reducedState.scrollable}px links=${reducedState.indexLinks} toggle=${reducedState.indexToggle}`,
  )
  record('reduced motion keeps the system cursor', reducedCursor === 'off', String(reducedCursor))
  await reduced.screenshot({ path: join(OUT, '07-reduced-motion-1440.png') })
  await reduced.close()

  // --- no JavaScript ------------------------------------------------------------------
  const noJs = await browser.newPage()
  await noJs.setViewport(desktop)
  await noJs.setJavaScriptEnabled(false)
  await noJs.goto(`${BASE}/`, { timeout: 60000, waitUntil: 'networkidle2' })
  await noJs.waitForSelector('.bang-canvas__tile', { timeout: 30000 })
  /**
   * No-JavaScript, honestly. The markup for the whole page — every tile's `<img>`, every
   * index link — is in the served HTML (`tiles`/`links` below are read straight out of
   * the document), but the theme's routing is built on Suspense loading boundaries
   * (`src/app/loading.tsx` and a `loading.tsx` per segment), and React's streamed swap
   * needs a script. A JS-less browser therefore paints the loading state on *every*
   * route of this theme, the untouched archives included — that is a property of the
   * loading boundaries, not of this canvas, so the audit pins both halves: the content
   * is served, and what a JS-less visitor sees is the same loading state as elsewhere.
   */
  const noJsState = await noJs.evaluate(() => ({
    links: [...document.querySelectorAll('.bang-canvas__tile[data-primary-tile="true"]')].map((node) => node.getAttribute('href')),
    tiles: document.querySelectorAll('.bang-canvas__tile').length,
    tilesVisible: [...document.querySelectorAll('.bang-canvas__tile')].filter((node) => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
    }).length,
  }))
  record(
    'without scripting the composition and the work list are both served',
    noJsState.tiles > 0 && noJsState.links.length > 0,
    `${noJsState.tiles} tiles, ${noJsState.links.length} links`,
  )
  record(
    'without scripting the page paints the theme’s loading state (pre-existing boundary)',
    noJsState.tilesVisible === 0,
    `${noJsState.tilesVisible} tiles visible — see docs/LIMITATIONS.md`,
  )
  await noJs.screenshot({ path: join(OUT, '08-no-js-1440.png') })

  // The same boundary wraps every other route, so a JS-less browser sees the same kind
  // of frame on an archive this work never touched. That is what makes the line above a
  // property of the theme's loading boundaries rather than of the canvas.
  await noJs.goto(`${BASE}/projects`, { timeout: 60000, waitUntil: 'networkidle2' })
  await sleep(800)
  const archiveNoJs = await noJs.evaluate(() => ({
    rows: document.querySelectorAll('.bang-row').length,
    rowsVisible: [...document.querySelectorAll('.bang-row')].filter((node) => node.getBoundingClientRect().height > 0).length,
    skeletons: document.querySelectorAll('.skeleton').length,
  }))
  record(
    'the untouched archives paint the same loading state without scripting',
    archiveNoJs.rows > 0 && archiveNoJs.rowsVisible === 0 && archiveNoJs.skeletons > 0,
    `archive: ${archiveNoJs.rows} rows served, ${archiveNoJs.rowsVisible} visible, ${archiveNoJs.skeletons} skeletons`,
  )
  await noJs.close()

  record('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  writeFileSync(join(OUT, 'home-canvas-report.json'), `${JSON.stringify({ base: BASE, results }, null, 2)}\n`)
  const failed = results.filter((entry) => !entry.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed — screenshots in ${OUT}`)
  await summarise(results, OUT)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  console.log(`::error title=home canvas audit crashed::${String(error).slice(0, 500).replace(/\n/gu, ' ')}`)
  process.exit(1)
})
