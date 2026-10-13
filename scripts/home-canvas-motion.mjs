/**
 * Motion evidence for the home canvas.
 *
 * A screenshot of an endless field proves nothing: it cannot show that the page never
 * ends, that it never shows an empty frame, that the plane moves rigidly with the
 * pointer, or that the animation stops when the input does. This script therefore
 * records *sequences* — one frame per step of a real wheel gesture, a real drag, a real
 * pointer sweep across three different works and a real open/close of a case study —
 * and writes the numbers next to them:
 *
 *   - `motion/wheel-NN.png`  — a sustained wheel pan, 12 frames;
 *   - `motion/drag-NN.png`   — a pointer drag with a released flick, 6 frames;
 *   - `motion/cursor-NN.png` — the custom cursor over three different works;
 *   - `motion/open-NN.png`, `motion/close-NN.png` — a work opened over the canvas and
 *     closed again, with the field frozen behind it;
 *   - `motion-wheel.gif`, `motion-wheel.jpg`, `motion-drag.jpg` — the same frames as an
 *     animation and as a contact sheet, for reading without a browser;
 *   - `motion-report.json` — the world transform, tile count and visible-tile count of
 *     every frame, plus the assertions below.
 *
 * Asserted per frame: the DOM never grows (a bounded field, not an accumulating one), a
 * tile is always on screen (no blank frame, no seam), every tile keeps its work, and the
 * plane advances monotonically — no reset, no teleport. Asserted after the input stops:
 * the field comes to rest and stops changing (the loop ends instead of spinning).
 *
 *   node scripts/home-canvas-motion.mjs --base http://127.0.0.1:3200
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { brotliDecompressSync } from 'node:zlib'

import puppeteer from 'puppeteer-core'

const vec = (x, y) => ({ x, y })

const require = createRequire(import.meta.url)
const argOf = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

const BASE = argOf('base', process.env.AUDIT_BASE ?? 'http://127.0.0.1:3200').replace(/\/$/u, '')
const OUT = argOf('out', 'docs/screenshots/bang-home/motion')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const desktop = { deviceScaleFactor: 1, height: 900, width: 1440 }

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

/** The headless shell has no pointer device; see `home-canvas-audit.mjs`. */
const emulateFinePointer = (page) =>
  page.evaluateOnNewDocument(() => {
    const native = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      const target = /pointer:\s*fine|hover:\s*hover/u.test(query) ? true : null
      if (target === null) return native(query)
      const list = native(query)
      if (list.matches === target) return list
      return {
        addEventListener: () => {},
        addListener: () => {},
        dispatchEvent: () => true,
        matches: target,
        media: query,
        onchange: null,
        removeEventListener: () => {},
        removeListener: () => {},
      }
    }
  })

/** Everything a frame needs to be checkable after the fact. */
const probe = (page) =>
  page.evaluate(() => {
    const world = document.querySelector('.bang-canvas__world')
    const tiles = [...document.querySelectorAll('.bang-canvas__tile')]
    const shift = (transform) => {
      const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/u.exec(transform ?? '')
      return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 }
    }
    return {
      cursor: {
        label: document.querySelector('.bang-cursor__label')?.textContent ?? '',
        mode: document.querySelector('.bang-cursor')?.dataset.mode ?? null,
      },
      domNodes: document.querySelectorAll('*').length,
      hrefs: tiles.map((tile) => tile.getAttribute('href')).join('|'),
      tiles: tiles.length,
      transform: shift(world?.style.transform ?? ''),
      visible: tiles.filter((tile) => {
        const rect = tile.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight
      }).length,
    }
  })

/**
 * Up to three tiles a pointer can actually reach. A frame does not have to be whole for
 * that — only its centre has to be inside the viewport, big enough to aim at, and
 * *topmost* at that point, which the browser's own hit test answers: if the fixed chrome
 * covered the spot, `elementFromPoint` would return the chrome instead of the tile.
 */
const actionableTiles = (page) =>
  page.evaluate(() => {
    const points = []
    for (const node of document.querySelectorAll('.bang-canvas__tile')) {
      const rect = node.getBoundingClientRect()
      if (rect.width < 120 || rect.height < 80) continue
      const x = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8)
      const y = Math.min(Math.max(rect.top + rect.height / 2, 8), window.innerHeight - 8)
      if (document.elementFromPoint(x, y)?.closest('.bang-canvas__tile') !== node) continue
      points.push({ label: node.dataset.cursorLabel, x, y })
    }
    return points.slice(0, 3)
  })

/**
 * The same lines that go to stdout also go to the run's summary when the runner offers one:
 * a browser audit whose output cannot be read is not evidence (see `home-canvas-audit.mjs`).
 */
const summarise = async (results) => {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) return
  const failed = results.filter((entry) => !entry.ok)
  const body = [
    `### Home canvas motion — ${results.length - failed.length}/${results.length} checks passed`,
    '',
    ...results.map((entry) => `- ${entry.ok ? '✅' : '❌'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`),
    '',
  ].join('\n')
  const { appendFile } = await import('node:fs/promises')
  await appendFile(path, `${body}\n`, 'utf8').catch(() => null)
}

const results = []
const record = (name, ok, detail) => {
  results.push({ detail, name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
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

  await page.goto(`${BASE}/`, { timeout: 90000, waitUntil: 'networkidle2' })
  await page.waitForSelector('.bang-canvas__tile', { timeout: 30000 })
  // The gestures below are meaningless until the field has taken over (see the audit).
  await page
    .waitForFunction(() => document.documentElement.dataset.bangCanvas === 'pan', { timeout: 30000 })
    .catch(() => null)
  await sleep(400)

  const frames = { close: [], cursor: [], drag: [], open: [], wheel: [] }
  const capture = async (sequence) => {
    const state = await probe(page)
    const index = frames[sequence].length
    frames[sequence].push(state)
    await page.screenshot({ path: join(OUT, `${sequence}-${String(index).padStart(2, '0')}.png`) })
    return state
  }

  // --- a sustained wheel pan ---------------------------------------------------------
  await page.mouse.move(720, 450)
  await capture('wheel')
  for (let index = 1; index <= 11; index += 1) {
    await page.mouse.wheel({ deltaY: 260 })
    await sleep(110)
    await capture('wheel')
  }
  const start = frames.wheel[0]
  const end = frames.wheel.at(-1)
  record('the wheel pans the field without ever resetting it', end.transform.y < start.transform.y - 500, `y ${start.transform.y} → ${end.transform.y}`)
  const steps = frames.wheel.slice(1).map((frame, index) => frames.wheel[index].transform.y - frame.transform.y)
  record(
    'every step moves the plane forward, none of them jumps a seam',
    steps.every((step) => step > 0 && step < 900),
    `steps ${steps.map((step) => step.toFixed(0)).join(', ')}`,
  )
  record('the field never grows while it moves', frames.wheel.every((frame) => frame.tiles === start.tiles && frame.domNodes === start.domNodes), `${start.tiles} tiles, ${start.domNodes} DOM nodes, constant`)
  record('a tile is on screen in every frame (no blank, no seam)', Math.min(...frames.wheel.map((frame) => frame.visible)) > 0, `minimum ${Math.min(...frames.wheel.map((frame) => frame.visible))} tiles`)
  record('every tile keeps its work', frames.wheel.every((frame) => frame.hrefs === start.hrefs))

  // The loop has to *end*: with the input stopped the plane must stop moving.
  await sleep(1400)
  const resting = await probe(page)
  await sleep(700)
  const stillResting = await probe(page)
  record('the field comes to rest and stays there', resting.transform.y === stillResting.transform.y, `y ${resting.transform.y} → ${stillResting.transform.y}`)

  // --- a drag, then a released flick --------------------------------------------------
  const dragStart = await probe(page)
  await page.mouse.move(720, 450)
  await page.mouse.down()
  for (let index = 1; index <= 5; index += 1) {
    await page.mouse.move(720 - index * 55, 450 - index * 30, { steps: 6 })
    await sleep(90)
    await capture('drag')
  }
  await page.mouse.up()
  await sleep(500)
  const afterFlick = await probe(page)
  // Grabbing the field moves it with the hand: a pointer that goes left by 55px takes
  // the plane left by 55px, in the same frame, with no easing in between.
  const grabbed = vec(frames.drag[0].transform.x - dragStart.transform.x, frames.drag[0].transform.y - dragStart.transform.y)
  record(
    'the plane follows the pointer one-to-one',
    Math.abs(grabbed.x + 55) < 6 && Math.abs(grabbed.y + 30) < 6,
    `pointer moved -55,-30 → plane moved ${grabbed.x.toFixed(0)},${grabbed.y.toFixed(0)}`,
  )
  const releaseX = frames.drag.at(-1).transform.x
  const flicked = releaseX - afterFlick.transform.x
  record(
    'the released flick keeps travelling in the same direction, then stops',
    flicked > 5 && flicked < 900 && Math.sign(-flicked) === Math.sign(grabbed.x),
    `x ${releaseX.toFixed(0)} → ${afterFlick.transform.x.toFixed(0)} (${flicked.toFixed(0)}px of momentum)`,
  )
  record('a drag never opens a work', await page.evaluate(() => location.pathname) === '/')

  // --- the cursor, over three different works -----------------------------------------
  // The field is wherever the last gesture left it, so the sweep may need a nudge to
  // bring two whole frames clear of the chrome — every attempt is a real pan.
  const points = await page.evaluate(async () => null).then(async () => {
    // The field repeats works across its cells, so the sweep takes *distinct* works —
    // the point is that the cursor follows the work under it, not the position.
    const distinct = (list) => list.filter((point, index) => list.findIndex((other) => other.label === point.label) === index)
    let found = distinct(await actionableTiles(page))
    for (let attempt = 0; attempt < 5 && found.length < 2; attempt += 1) {
      await page.mouse.move(720, 500)
      await page.mouse.wheel({ deltaY: 320 })
      await page
        .waitForFunction(
          (from) => Math.abs(Number(/(-?[\d.]+)px/u.exec(document.querySelector('.bang-canvas__world')?.style.transform ?? '')?.[1] ?? 0) - from) < 4,
          { timeout: 4000 },
          await page.evaluate(() => Number(/(-?[\d.]+)px/u.exec(document.querySelector('.bang-canvas__world')?.style.transform ?? '')?.[1] ?? 0)),
        )
        .catch(() => null)
      found = distinct(await actionableTiles(page))
    }
    return found
  })
  for (const point of points) {
    await page.mouse.move(point.x, point.y)
    await page
      .waitForFunction(
        ({ px, py }) => {
          const rect = document.querySelector('.bang-cursor__mark')?.getBoundingClientRect()
          if (!rect) return false
          return Math.hypot(rect.left + rect.width / 2 - px, rect.top + rect.height / 2 - py) < 1
        },
        { timeout: 4000 },
        { px: point.x, py: point.y },
      )
      .catch(() => null)
    await capture('cursor')
  }
  const labels = frames.cursor.map((frame) => frame.cursor.label)
  record(
    'the cursor names the work it is over, and changes with it',
    points.length > 1 && frames.cursor.every((frame, index) => frame.cursor.mode === 'work' && frame.cursor.label === points[index]?.label) && new Set(labels).size === labels.length,
    labels.join(' | '),
  )

  // --- opening a work over the canvas, and closing it ---------------------------------
  const target = (await actionableTiles(page))[0]
  if (!target) throw new Error('no tile of the field is clear of the chrome to click')
  await page.mouse.click(target.x, target.y)
  await page.waitForSelector('.bang-overlay', { timeout: 15000 })
  await sleep(120)
  await capture('open')
  await sleep(500)
  await capture('open')
  record(
    'the canvas is frozen, not reset, behind the open work',
    frames.open[0].transform.y === frames.open[1].transform.y && frames.open[0].tiles === frames.open[1].tiles,
    `y ${frames.open[0].transform.y} → ${frames.open[1].transform.y}`,
  )
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.bang-overlay'), { timeout: 15000 })
  await sleep(400)
  await capture('close')
  record(
    'closing returns to the same place on the field',
    frames.close[0].transform.x === frames.open[0].transform.x && frames.close[0].transform.y === frames.open[0].transform.y,
    `${frames.open[0].transform.x},${frames.open[0].transform.y} → ${frames.close[0].transform.x},${frames.close[0].transform.y}`,
  )
  record('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()

  // Sheets and an animation, so the sequence can be read without opening the browser.
  const sheet = (sequence, name) => {
    const files = frames[sequence].map((_, index) => join(OUT, `${sequence}-${String(index).padStart(2, '0')}.png`))
    if (files.length === 0) return
    execFileSync('montage', [...files, '-tile', '3x', '-geometry', '+4+4', '-background', '#f5f5f5', '-resize', '480x300', join(OUT, `${name}.jpg`)])
  }
  sheet('wheel', 'motion-wheel')
  sheet('drag', 'motion-drag')
  sheet('cursor', 'motion-cursor')
  try {
    const gifFrames = frames.wheel.map((_, index) => join(OUT, `wheel-${String(index).padStart(2, '0')}.png`))
    execFileSync('convert', ['-delay', '11', '-loop', '0', ...gifFrames, '-resize', '50%', join(OUT, 'motion-wheel.gif')])
  } catch (error) {
    console.warn(`[motion] no animation written: ${String(error).slice(0, 120)}`)
  }

  writeFileSync(
    join(OUT, 'motion-report.json'),
    `${JSON.stringify({ base: BASE, frames, results, viewport: desktop }, null, 2)}\n`,
  )
  const failed = results.filter((entry) => !entry.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed — evidence in ${OUT}`)
  await summarise(results)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
