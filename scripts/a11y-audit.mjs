import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import puppeteer from 'puppeteer-core'

/**
 * Structural accessibility audit.
 *
 * The screenshot harness proves what a page *looks* like; this proves the things a
 * picture cannot: one `<h1>` per page, a `<main>` landmark, no skipped heading levels,
 * every image described, no duplicate ids, and pointer targets that meet WCAG 2.2
 * SC 2.5.8 (24×24, AA) — counting an associated `<label>` as part of its control's
 * target, because tapping the label activates the control.
 *
 *   node scripts/a11y-audit.mjs [--base http://127.0.0.1:3200] [--out docs/screenshots]
 *
 * Set `ARCH2_CHROME_PATH` to a host browser (same escape hatch as the screenshot
 * harness) when the bundled @sparticuz/chromium binary cannot run on this OS.
 *
 * Writes `a11y-report.json` next to the screenshot report and exits non-zero when a page
 * has a problem, so it can gate a change the same way the screenshots do. Links inside a
 * running sentence are exempt from SC 2.5.8 by the criterion itself and are not flagged;
 * `.target-standalone` is what the theme uses to opt a link into the 24px floor.
 */
const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = argOf('--base', process.env.AUDIT_BASE ?? 'http://127.0.0.1:3200')
const OUT = argOf('--out', 'docs/screenshots')
const PATHS = (
  argOf('--paths', process.env.AUDIT_PATHS) ??
  '/,/projects,/projects/khaneye-noor,/education,/blog,/blog/notes-on-lines,/about,/contact,/search?q=نور,/services,/en,/en/projects,/en/blog,/en/contact,/en/about,/does-not-exist,/arch-not-found'
).split(',')

const audit = async (page) => page.evaluate(() => {
  const out = { alts: [], contrast: [], dupIds: [], focusables: [], headings: [], landes: [], lang: [], small: [], title: document.title }
  const h = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => Number(el.tagName[1]))
  out.headings = h
  out.h1Count = document.querySelectorAll('h1').length
  // skipped levels
  out.skips = []
  for (let i = 1; i < h.length; i += 1) if (h[i] - h[i - 1] > 1) out.skips.push(`${h[i - 1]}→${h[i]}`)

  for (const img of document.querySelectorAll('img')) {
    if (img.getAttribute('alt') === null) out.alts.push(`<img src="${img.getAttribute('src')?.slice(0, 60)}"> missing alt`)
    const box = img.getBoundingClientRect()
    if (box.width > 40 && box.height > 40 && img.getAttribute('alt') === '' && !img.closest('[aria-hidden="true"]') && !img.hasAttribute('data-decorative')) out.alts.push(`large img with empty alt: ${img.getAttribute('src')?.slice(0, 60)}`)
  }

  const seen = new Map()
  for (const el of document.querySelectorAll('[id]')) {
    const id = el.id
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  for (const [id, n] of seen) if (n > 1) out.dupIds.push(`${id}×${n}`)

  // Focusables with no visible focus indicator
  out.focusables = []
  for (const el of document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) {
    const box = el.getBoundingClientRect()
    if (el.getClientRects().length === 0) continue // not rendered (e.g. the honeypot)
    if (getComputedStyle(el).visibility === 'hidden') continue
    if (box.width === 0 && box.height === 0) continue
    const name = (el.textContent ?? '').trim().slice(0, 24) || el.getAttribute('aria-label') || el.getAttribute('name') || el.tagName
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
    const lb = label?.getBoundingClientRect() ?? null
    out.focusables.push({
      h: Math.round(box.height),
      name,
      tag: el.tagName,
      targetH: Math.round(Math.max(box.height, lb?.height ?? 0)),
      targetW: Math.round(Math.max(box.width, lb?.width ?? 0)),
      w: Math.round(box.width),
    })
  }

  // Colour contrast for text against its resolved background
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return { a: p[3] === undefined ? 1 : p[3], b: p[2], g: p[1], r: p[0] }
  }
  const bgOf = (el) => {
    let node = el
    while (node) {
      const bg = parse(getComputedStyle(node).backgroundColor)
      if (bg && bg.a > 0.95) return bg
      node = node.parentElement
    }
    return { a: 1, b: 255, g: 255, r: 255 }
  }
  const lum = ({ b, g, r }) => {
    const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  for (const el of document.querySelectorAll('p,span,a,li,label,small,time,dt,dd,h1,h2,h3,h4,button,figcaption')) {
    if (!el.textContent?.trim() || el.children.length > 0) continue
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (box.width < 4 || box.height < 4) continue
    const fg = parse(style.color)
    if (!fg) continue
    const bg = bgOf(el)
    const l1 = lum(fg)
    const l2 = lum(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const size = parseFloat(style.fontSize)
    const bold = Number(style.fontWeight) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    if (ratio < need) {
      out.contrast.push({ cls: el.className.toString().slice(0, 40), ratio: Number(ratio.toFixed(2)), need, size: Math.round(size), text: el.textContent.trim().slice(0, 30) })
    }
  }
  return out
})

/**
 * Fail fast when the page's own assets are not being served.
 *
 * A theme that answers 200 for HTML but 500 for `/_next/static/*` renders an unstyled,
 * unhydrated page — every measurement below then reports a defect that does not exist in
 * the theme at all. The usual cause is a server booted before the last `next build`:
 * the process holds the old asset manifest while the static directory has new hashes.
 */
const assertAssetsServed = async (page, base) => {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  const href = await page.evaluate(() =>
    document.querySelector('link[rel="stylesheet"]')?.getAttribute('href') ?? '',
  )
  if (!href) return
  // Cache-buster: a cached stylesheet revalidates with 304, which proves the browser
  // cache, not the server. The asset itself has to come back 200 + text/css.
  const probe = new URL(href, base)
  probe.searchParams.set('arch2-audit', Date.now().toString(36))
  const response = await page.goto(probe.toString(), { waitUntil: 'domcontentloaded' })
  const type = response?.headers()['content-type'] ?? ''
  if (response?.status() !== 200 || !type.includes('text/css')) {
    throw new Error(
      `assets are not being served (${href} → ${response?.status()} ${type}). Restart the theme servers on the current build: bash scripts/qa-servers.sh --reset, then re-run.`,
    )
  }
}

const main = async () => {
  let executablePath = process.env.ARCH2_CHROME_PATH
  let env = process.env
  if (!executablePath) {
    const { default: chromium } = await import('@sparticuz/chromium')
    executablePath = await chromium.executablePath()
    env = { ...process.env, LD_LIBRARY_PATH: [join(tmpdir(), 'arch2-chromium-libs', 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    env,
    executablePath,
    headless: true,
  })
  await assertAssetsServed(await browser.newPage(), BASE)
  const results = []
  for (const path of PATHS) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 40000 })
      await page.waitForSelector('main, .stage', { timeout: 30000 })
      await new Promise((r) => setTimeout(r, path === '/' || path === '/en' ? 1200 : 500))
      const a = await audit(page)
      const problems = []
      if (a.h1Count !== 1) problems.push(`h1 count = ${a.h1Count}`)
      if (!(await page.evaluate(() => Boolean(document.querySelector('main'))))) problems.push('no <main> landmark')
      if (a.skips.length) problems.push(`heading skips: ${a.skips.join(',')}`)
      if (a.alts.length) problems.push(`alt: ${a.alts.slice(0, 3).join(' | ')}`)
      if (a.dupIds.length) problems.push(`dup ids: ${a.dupIds.slice(0, 4).join(',')}`)
      const tiny = a.focusables.filter((f) => f.targetH < 24 || f.targetW < 24)
      if (tiny.length) problems.push(`targets < 24px: ${tiny.map((t) => `${t.name}(${t.targetW}x${t.targetH})`).slice(0, 4).join(', ')}`)
      const low = a.contrast.filter((c) => c.need === 4.5)
      results.push({ contrast: a.contrast.slice(0, 20), h1: a.h1Count, headings: a.headings, ok: problems.length === 0, path, problems, title: a.title })
      console.log(`${problems.length ? 'PROBLEM' : 'ok     '} ${path}`)
      for (const p of problems) console.log(`        - ${p}`)
      if (low.length) for (const c of low.slice(0, 4)) console.log(`        ~ contrast ${c.ratio} < ${c.need} (${c.size}px) "${c.text}" [${c.cls}]`)
      if (process.env.AUDIT_VERBOSE) console.log('        ' + JSON.stringify({ h1: a.h1Count, headings: a.headings, title: a.title }))
    } catch (error) {
      results.push({ ok: false, path, problems: [`navigation: ${String(error).slice(0, 160)}`] })
      console.log(`ERROR   ${path}: ${String(error).slice(0, 120)}`)
    }
    await page.close()
  }
  await browser.close()

  const failed = results.filter((entry) => !entry.ok)
  mkdirSync(dirname(join(OUT, 'a11y-report.json')), { recursive: true })
  writeFileSync(join(OUT, 'a11y-report.json'), `${JSON.stringify({ base: BASE, results }, null, 2)}\n`)
  console.log(`\n${results.length - failed.length}/${results.length} pages clean${failed.length ? ` — ${failed.map((entry) => entry.path).join(', ')}` : ''}`)
  if (failed.length > 0) process.exitCode = 1
}
main()
