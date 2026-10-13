#!/usr/bin/env node
/**
 * Real-browser QA: screenshots + horizontal-overflow checks.
 *
 * The sandbox that produced the committed screenshots has no system Chromium and no
 * access to the Playwright CDN, so this script drives the npm-distributed
 * `@sparticuz/chromium` build with `puppeteer-core`. That build needs NSS, which the
 * same package ships brotli-compressed in `bin/al2023.tar.br`; the script unpacks it to
 * a temp directory and points the launcher's `LD_LIBRARY_PATH` at it. On a normal
 * machine with a system Chrome/Chromium, set `ARCH2_CHROME_PATH` and skip all of that.
 *
 * Usage:
 *   node scripts/screenshots.mjs --base http://127.0.0.1:3000 --out docs/screenshots
 *   node scripts/screenshots.mjs --only projects --base http://127.0.0.1:3000
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'

import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const readFlag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const base = readFlag('base', 'http://127.0.0.1:3000').replace(/\/$/, '')
const outDir = readFlag('out', 'docs/screenshots')
const only = readFlag('only', null)
const scale = Number(readFlag('scale', '1'))

const desktop = { deviceScaleFactor: scale, height: 900, width: 1440 }
const wide = { deviceScaleFactor: scale, height: 1080, width: 1920 }
const laptop = { deviceScaleFactor: scale, height: 800, width: 1024 }
const tablet = { deviceScaleFactor: scale, height: 1024, width: 768 }
const phone = { deviceScaleFactor: scale, height: 844, width: 390 }
const smallPhone = { deviceScaleFactor: scale, height: 640, width: 320 }
// 200% browser zoom = the same physical window with half the CSS pixels, so a 720×450
// CSS viewport at 2× device scale is the faithful emulation (media queries included).
const zoomed = { deviceScaleFactor: scale * 2, height: 450, width: 720 }

const shots = [
  { name: '01-home-entrance-1440', path: '/', viewport: desktop, waitMs: 2400, expect: { selector: '.btn', text: 'ورود' } },
  // The menu only exists after a client interaction, so this shot is also the hydration proof.
  { name: '02-home-menu-1440', path: '/', viewport: desktop, action: 'enter-stage', waitMs: 2400, expect: { selector: '.menu-row__label' } },
  { name: '03-home-entrance-390', path: '/', viewport: phone, waitMs: 2400 },
  { name: '04-projects-1920', path: '/projects', viewport: wide, fullPage: true },
  { name: '05-projects-1440', path: '/projects', viewport: desktop, fullPage: true },
  { name: '06-projects-1024', path: '/projects', viewport: laptop, fullPage: true },
  { name: '07-projects-768', path: '/projects', viewport: tablet, fullPage: true },
  { name: '08-projects-390', path: '/projects', viewport: phone, fullPage: true },
  { name: '09-projects-320', path: '/projects', viewport: smallPhone, fullPage: true },
  { name: '10-project-detail-1440', path: '/projects/khaneye-noor', viewport: desktop, fullPage: true },
  { name: '11-education-1440', path: '/education', viewport: desktop, fullPage: true },
  { name: '12-blog-1440', path: '/blog', viewport: desktop, fullPage: true },
  { name: '13-article-1440', path: '/blog/notes-on-lines', viewport: desktop, fullPage: true },
  { name: '14-about-1440', path: '/about', viewport: desktop, fullPage: true },
  { name: '15-contact-1440', path: '/contact', viewport: desktop, fullPage: true },
  { name: '16-services-blocks-1440', path: '/services', viewport: desktop, fullPage: true },
  { name: '17-search-1440', path: '/search?q=%DB%8C%D8%A7%D8%AF%D8%AF%D8%A7%D8%B4%D8%AA', viewport: desktop, fullPage: true },
  { name: '18-en-blog-1440', path: '/en/blog', viewport: desktop, fullPage: true },
  { name: '19-en-contact-390', path: '/en/contact', viewport: phone, fullPage: true },
  { name: '20-mobile-drawer-390', path: '/blog', viewport: phone, action: 'open-drawer', expect: { selector: '.drawer__row' } },
  // Skeletons are captured through a *client-side* navigation, which is the only place a
  // visitor can actually see one: a cold page load waits for `generateMetadata` first.
  // Category-filtered targets on purpose: the unfiltered archive is usually already in
  // the server's fetch cache, and a cached navigation never shows a skeleton.
  { name: '21-skeletons-projects-1440', path: '/blog', viewport: desktop, base: 'SLOW', action: 'client-nav-skeleton', target: '/projects', throttle: true, expect: { selector: '.grid-projects .skeleton' } },
  { name: '22-cms-unreachable-1440', path: '/projects', viewport: desktop, base: 'FAIL', fullPage: true, expect: { selector: 'h1', text: 'اتصال به سامانهٔ محتوا' } },
  // Lifecycle + empty-content scenarios run against their own mock CMS instances.
  { name: '23-holding-suspended-1440', path: '/', viewport: desktop, base: 'HOLDING', fullPage: true, expect: { selector: 'h1', text: 'موقتاً در دسترس نیست' } },
  // A suspended site must show no portfolio content at all — proven negatively.
  { name: '24-holding-suspended-1440-projects', path: '/projects', viewport: desktop, base: 'HOLDING', fullPage: true, expect: { absent: '.frame-project, .card-project', selector: 'h1', text: 'موقتاً در دسترس نیست' } },
  { name: '25-empty-projects-1440', path: '/projects', viewport: desktop, base: 'EMPTY', fullPage: true, expect: { selector: 'h2', text: 'هنوز چیزی منتشر نشده' } },
  { name: '26-empty-blog-1440', path: '/blog', viewport: desktop, base: 'EMPTY', fullPage: true, expect: { selector: 'h2', text: 'هنوز چیزی منتشر نشده' } },
// The 390px skeleton is the two-column project grid — the same geometry as the archive.
  { name: '27-skeletons-projects-390', path: '/about', viewport: phone, base: 'SLOW', action: 'client-nav-skeleton', target: '/projects', throttle: true, expect: { selector: '.grid-projects .skeleton' } },
  // Edge cases the brief calls out explicitly: missing logo, long labels, invalid form,
  // 200% zoom and reduced motion. Each has its own mock instance so the evidence is unambiguous.
  // No logo in the CMS: the site-name wordmark must appear, and no invented mark may be drawn.
  { name: '28-missing-logo-1440', path: '/', viewport: desktop, base: 'NOLOGO', waitMs: 2400, expect: { absent: '[data-logo="mark"]', selector: '[data-logo="wordmark"]', text: 'استودیوی نمونه' } },
  { name: '29-long-labels-nav-1440', path: '/projects', viewport: desktop, base: 'LONG', fullPage: true, expect: { selector: 'main' } },
  { name: '30-invalid-form-390', path: '/contact', viewport: phone, action: 'submit-empty-form', expect: { selector: '[aria-invalid="true"]' } },
  { name: '39-form-success-1440', path: '/contact', viewport: desktop, action: 'submit-valid-form', expect: { selector: '[aria-live="polite"]', text: 'ثبت شد' } },
  { name: '31-zoom200-home-1440', path: '/', viewport: zoomed, waitMs: 2400 },
  { name: '32-zoom200-projects-1440', path: '/projects', viewport: zoomed, fullPage: true },
  { name: '33-reduced-motion-home-1440', path: '/', viewport: desktop, emulate: { reducedMotion: 'reduce' }, action: 'enter-stage', waitMs: 1200 },
  { name: '34-education-390', path: '/education', viewport: phone, fullPage: true },
  { name: '35-article-390', path: '/blog/notes-on-lines', viewport: phone, fullPage: true },
  { name: '36-about-390', path: '/about', viewport: phone, fullPage: true },
  { name: '37-contact-390', path: '/contact', viewport: phone, fullPage: true },
  { name: '38-en-education-390', path: '/en/education', viewport: phone, fullPage: true },
  // Progressive enhancement: with scripting off the entrance cannot run, so the home
  // page must still offer the CMS menu. Chromium parses `<noscript>` children into the
  // DOM exactly when scripting is disabled, so a menu that `:has()` the no-JS caption
  // *and* a real link to the archive is proof the fallback rendered (the links are
  // siblings of the `<noscript>`, not inside it).
  {
    name: '40-no-js-home-1440',
    javaScriptEnabled: false,
    path: '/',
    viewport: desktop,
    waitMs: 600,
    fullPage: true,
    expect: { selector: '.home-menu:has(noscript p) a[href="/projects"]', text: 'پروژه‌ها' },
  },
  // The unified lightbox (issue #9): a gallery-block thumbnail opens the dialog over its
  // own backdrop. In Persian the *next* control (second step button) points left, in
  // English it points right; both shots are taken after the open animation has settled.
  { name: '41-lightbox-fa-1440', path: '/services', viewport: desktop, action: 'open-lightbox', expect: { selector: '.lightbox[data-state="open"][dir="rtl"] [data-step="next"] svg.lucide-chevron-left' } },
  { name: '42-lightbox-en-1440', path: '/en/services', viewport: desktop, action: 'open-lightbox', expect: { selector: '.lightbox[data-state="open"][dir="ltr"] [data-step="next"] svg.lucide-chevron-right' } },
  { name: '43-lightbox-fa-390', path: '/services', viewport: phone, action: 'open-lightbox', expect: { selector: '.lightbox__overlay[data-state="open"]' } },
  // The services page carries the gallery block: two columns at phone and tablet width.
  { name: '44-services-blocks-768', path: '/services', viewport: tablet, fullPage: true, expect: { selector: '.grid-media .lightbox-trigger' } },
  { name: '45-services-blocks-390', path: '/services', viewport: phone, fullPage: true, expect: { selector: '.grid-media .lightbox-trigger' } },
  // Project detail at phone width: the compact facts block and content images rendered once.
  { name: '46-project-detail-390', path: '/projects/khaneye-noor', viewport: phone, fullPage: true, expect: { selector: '.facts .facts__item' } },
]

/** True when something accepts a TCP connection at `origin` (a slow server still does). */
const portIsOpen = async (origin) => {
  const url = new URL(origin)
  return new Promise((resolve) => {
    const socket = connect({ host: url.hostname, port: Number(url.port || 80) })
    const done = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(1500)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(true)) // listening, just slow to answer
    socket.once('error', () => done(false))
  })
}

const chromiumLibs = () => {
  // `package.json` is not an exported subpath, so walk up from the resolved entry.
  const packaged = join(require.resolve('@sparticuz/chromium'), '..', '..', 'bin', 'al2023.tar.br')
  const dir = join(tmpdir(), 'arch2-chromium-libs')
  if (existsSync(join(dir, 'lib')) || !existsSync(packaged)) return dir
  mkdirSync(dir, { recursive: true })
  const tarPath = join(tmpdir(), 'arch2-al2023.tar')
  writeFileSync(tarPath, brotliDecompressSync(readFileSync(packaged)))
  execFileSync('tar', ['-xf', tarPath, '-C', dir])
  return dir
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

  mkdirSync(outDir, { recursive: true })
  const results = []

  for (const shot of shots) {
    if (only && !shot.name.includes(only)) continue
    const page = await browser.newPage()
    // Must be set before the first navigation: the parser decides whether `<noscript>`
    // content is rendered, so toggling it later would not reproduce a no-JS visitor.
    if (shot.javaScriptEnabled === false) await page.setJavaScriptEnabled(false)
    await page.setViewport(shot.viewport)
    if (shot.emulate?.reducedMotion) {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: shot.emulate.reducedMotion }])
    }
    const consoleErrors = []
    page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 200)))

    let status = null
    const overrides = {
      EMPTY: 'http://127.0.0.1:3500',
      FAIL: 'http://127.0.0.1:3600',
      HOLDING: 'http://127.0.0.1:3400',
      LONG: 'http://127.0.0.1:3800',
      NOLOGO: 'http://127.0.0.1:3700',
      SLOW: 'http://127.0.0.1:3300',
    }
    const shotBase = shot.base ? (overrides[shot.base] ?? shot.base) : base
    if (shot.base && overrides[shot.base]) {
      // Probe the *port*, never an HTTP response: one of these instances answers in four
      // seconds on purpose, and a slow answer must not read as "not running".
      if (!(await portIsOpen(shotBase))) {
        console.log(`skip ${shot.name} (scenario instance ${shotBase} is not running)`)
        await page.close()
        continue
      }
    }
    try {
      // Skeleton shots must be taken *while the response is still streaming*:
      // `networkidle2` would resolve after the Suspense boundary has settled and the
      // skeleton would already be replaced by real content. `domcontentloaded` fires on
      // the first streamed chunk, which is exactly the shell + skeleton.
      const waitUntil = shot.waitUntil ?? (shot.action === 'skeleton-only' ? 'domcontentloaded' : 'networkidle2')
      const response = await page.goto(`${shotBase}${shot.path}`, { timeout: 90000, waitUntil })
      status = response?.status() ?? null
    } catch (error) {
      results.push({ consoleErrors, name: shot.name, status: 'navigation-failed', error: String(error).slice(0, 200) })
      await page.close()
      continue
    }

    if (shot.action === 'enter-stage') {
      // The menu sits below the entrance; the Enter control scrolls it into view.
      await page.click('.stage .btn')
      await new Promise((resolve) => setTimeout(resolve, 1600))
    }
    if (shot.action === 'open-drawer') {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('header button')]
        buttons.at(-1)?.click()
      })
      await new Promise((resolve) => setTimeout(resolve, 900))
    }
    if (shot.action === 'open-lightbox') {
      // The second trigger on the page is the gallery block's first thumbnail (the first
      // is the standalone media block); open it and let the 260ms entrance finish.
      await page.waitForSelector('.grid-media .lightbox-trigger', { timeout: 20000 })
      await page.evaluate(() => {
        const trigger = document.querySelector('.grid-media .lightbox-trigger')
        trigger?.scrollIntoView({ block: 'center' })
        trigger?.click()
      })
      await page.waitForSelector('.lightbox[data-state="open"]', { timeout: 10000 })
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    if (shot.action === 'submit-valid-form') {
      // The happy path: fill every required field, submit, and wait for the CMS to answer.
      await page.evaluate(() => {
        const form = document.querySelector('form')
        if (!form) return
        for (const control of form.querySelectorAll('input, textarea')) {
          if (control.name === 'company' || control.type === 'checkbox') continue
          const setter = Object.getOwnPropertyDescriptor(
            control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value',
          )?.set
          setter?.call(control, control.type === 'email' ? 'sample@example.com' : 'نمونه')
          control.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const consent = form.querySelector('input[type="checkbox"]')
        if (consent && !consent.checked) consent.click()
        form.requestSubmit()
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    if (shot.action === 'submit-empty-form') {
      // Submitting an untouched form must surface field-level errors, never a silent no-op.
      await page.evaluate(() => {
        const form = document.querySelector('form')
        form?.querySelector('button[type="submit"]')?.click()
        form?.requestSubmit()
      })
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    if (shot.action === 'client-nav-skeleton') {
      // Warm page → click the real nav link → capture while the RSC payload resolves.
      // A warm connection prefetches both the target segment's loading boundary and its
      // data, so the navigation is instant and there is nothing to photograph. Throttling
      // the network reproduces the visitor on a slow connection, which is the only honest
      // way to see a skeleton on a site this aggressively prefetched.
      //
      // The initial load is allowed to finish *before* the throttle is installed: what
      // must be slow is the navigation, not the page the shot starts from.
      await page.waitForSelector('header', { timeout: 60000 })
      await new Promise((resolve) => setTimeout(resolve, 800))
      if (shot.throttle) {
        const client = await page.createCDPSession()
        await client.send('Network.enable')
        await client.send('Network.emulateNetworkConditions', {
          downloadThroughput: (500 * 1024) / 8,
          latency: 400,
          offline: false,
          uploadThroughput: (500 * 1024) / 8,
        })
      }
      // `offsetParent` is null for anything inside a `position: fixed` ancestor — which is
      // exactly what the drawer is — so measure the box instead. Links are matched by
      // *pathname*: the shot's target may carry a query (an uncached archive navigation)
      // while the navigation link itself is the plain path.
      const targetPath = shot.target.split('?')[0]

      const hasVisibleLink = () =>
        page.evaluate(
          (path) =>
            [...document.querySelectorAll('a[href]')].some((node) => {
              if (new URL(node.href).pathname !== path) return false
              const rect = node.getBoundingClientRect()
              const style = getComputedStyle(node)
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
            }),
          targetPath,
        )

      if (!(await hasVisibleLink())) {
        // Mobile: the same link lives in the drawer. Opening it is asynchronous (Radix
        // commits after the state update), so the click and the wait are separate steps.
        await page.evaluate(() => {
          const trigger = [...document.querySelectorAll('header button')].at(-1)
          if (trigger instanceof HTMLElement) trigger.click()
        })
        await page.waitForFunction(
          (path) =>
            [...document.querySelectorAll('a[href]')].some((node) => {
              if (new URL(node.href).pathname !== path) return false
              const rect = node.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0
            }),
          { timeout: 15000 },
          targetPath,
        )
      }

      const clicked = await page.evaluate((path) => {
        const link = [...document.querySelectorAll('a[href]')]
          .filter((node) => new URL(node.href).pathname === path)
          .find((node) => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
        if (!link) return false
        link.click()
        return true
      }, targetPath)
      if (!clicked) throw new Error(`no reachable link to ${shot.target}`)
    }
    if (shot.action === 'skeleton-only' || shot.action === 'client-nav-skeleton') {
      // Wait for the *expected* skeleton, not just any skeleton: the root loading boundary
      // renders first and is replaced by the segment's own boundary a moment later, and the
      // evidence needs the segment geometry.
      await page
        .waitForSelector(shot.expect?.selector ?? '.skeleton', { timeout: 20000 })
        .catch(() => page.waitForSelector('[aria-busy="true"]', { timeout: 5000 }).catch(() => null))
    } else {
      await new Promise((resolve) => setTimeout(resolve, shot.waitMs ?? 500))
    }

    const overflow = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      offenders: [...document.querySelectorAll('*')]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 2 || element.getBoundingClientRect().left < -2)
        .slice(0, 5)
        .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`),
    }))

    const expectation = shot.expect
      ? await page.evaluate(
          ({ absent, selector, text }) => {
            const node = selector ? document.querySelector(selector) : null
            const absentOk = absent ? !document.querySelector(absent) : true
            return {
              found: Boolean(node),
              text: node && text ? (node.textContent ?? '').includes(text) : true,
              absentOk,
            }
          },
          { absent: shot.expect.absent ?? null, selector: shot.expect.selector ?? null, text: shot.expect.text ?? null },
        )
      : null

    await page.screenshot({ fullPage: Boolean(shot.fullPage), path: join(outDir, `${shot.name}.png`), type: 'png' })
    results.push({
      consoleErrors,
      expectOk: expectation ? expectation.found && expectation.text && expectation.absentOk : undefined,
      name: shot.name,
      overflowOk: overflow.documentScrollWidth <= overflow.innerWidth + 1,
      status,
      ...overflow,
    })
    await page.close()
  }

  await browser.close()
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify({ base, results }, null, 2)}\n`)

  const failures = results.filter((entry) => entry.status !== 200 || entry.overflowOk === false || entry.consoleErrors?.length || entry.expectOk === false)
  console.log(`captured ${results.length} screenshots into ${outDir}`)
  for (const entry of results) {
    console.log(
      `${entry.status === 200 && entry.overflowOk !== false && entry.expectOk !== false ? 'ok  ' : 'FAIL'} ${entry.name} status=${entry.status} overflow=${entry.overflowOk ?? 'n/a'}${
        entry.expectOk === false ? ' expectation=missing' : ''
      }${entry.consoleErrors?.length ? ` console=${entry.consoleErrors.join(' | ')}` : ''}`,
    )
  }
  if (failures.length > 0) {
    console.log(`\n${failures.length} shot(s) need attention`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
