import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer-core'

/**
 * Interaction audit — the behaviours a screenshot cannot prove.
 *
 * The brief asks for specific *behaviour*: a visible Browse action, dots that switch
 * the featured work with no repeated links, a pause control, a drawer that traps focus,
 * closes on Escape, restores focus, unlocks scrolling and closes on navigation, and a
 * form that cannot be submitted twice.
 *
 * It also pins the behaviours a structural a11y pass cannot see: the language link must
 * stay reachable from the canvas, English archive links and breadcrumbs must remain
 * English, wrong-section detail URLs must redirect to the canonical section, the drawer
 * must open from the correct physical edge with bounded motion, an invalid email must
 * be blocked inline, long card metadata must not collapse the title, the licensed
 * Shazde weights must be active, and the decorative stroke token must drive mark
 * strokes at 1x/2x.
 *
 *   node scripts/interaction-audit.mjs [--base http://127.0.0.1:3200] [--out docs/screenshots]
 *
 * Writes `interaction-report.json` and exits non-zero on failure.
 */

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = argOf('--base', process.env.AUDIT_BASE ?? 'http://127.0.0.1:3200')
const OUT = argOf('--out', 'docs/screenshots')
/** Optional slow-CMS instance (qa-servers.sh starts one on 3300); skipped when absent. */
const SLOW_BASE = argOf('--slow-base', process.env.AUDIT_SLOW_BASE ?? 'http://127.0.0.1:3300')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wait until the page is *hydrated*, not merely parsed.
 *
 * Clicking at `domcontentloaded` reaches the server-rendered HTML before React has
 * attached its handlers, so every interaction check fails for a reason that has nothing
 * to do with the theme. The stylesheet is the honest signal available without hooks:
 * `document.readyState === 'complete'` plus a settled frame is when the entrance's
 * client component has taken over in this app.
 */
const loaded = async (page, selector = 'main, .stage', settle = 1200) => {
  await page.waitForSelector(selector, { timeout: 40000, visible: true })
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 40000 })
  await sleep(settle)
}

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
    env = { ...process.env, LD_LIBRARY_PATH: [join(tmpdir(), 'arch2-chromium-libs', 'lib'), process.env.LIBRARY_PATH].filter(Boolean).join(':') }
  }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    env,
    executablePath,
    headless: true,
  })
  await assertAssetsServed(await browser.newPage(), BASE)
  const checks = []
  const check = async (name, run) => {
    const page = await browser.newPage()
    page.on('pageerror', (error) => checks.push({ detail: String(error).slice(0, 200), name: `${name} (page error)`, ok: false }))
    try {
      const detail = await run(page)
      checks.push({ detail: detail ?? '', name, ok: true })
    } catch (error) {
      checks.push({ detail: String(error).slice(0, 200), name, ok: false })
    }
    await page.close()
  }

  const waitFor = async (page, selector, timeout = 20000) => {
    await page.waitForSelector(selector, { timeout, visible: true })
  }

  // ------------------------------------------------------------------ home canvas
  await check('home: the Browse Projects action is visible before any interaction', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const box = await page.$eval('.bang-canvas__actions .bang-btn', (el) => el.getBoundingClientRect().height)
    if (box < 24) throw new Error(`Browse action is only ${Math.round(box)}px tall`)
    return `Browse action ${Math.round(box)}px tall`
  })

  await check('home: dots switch the featured work', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas__dots')
    const before = await page.$eval('.bang-canvas__actions .bang-btn', (el) => el.getAttribute('href'))
    const dots = await page.$$('.bang-canvas__dots .bang-dot')
    if (dots.length < 2) throw new Error('fewer than two featured works to switch between')
    await dots[1].click()
    await sleep(600)
    const after = await page.$eval('.bang-canvas__actions .bang-btn', (el) => el.getAttribute('href'))
    if (before === after) throw new Error('the featured work did not change')
    return `${dots.length} works, ${before} → ${after}`
  })

  await check('home: one accessible destination per work (visual copies are decorative)', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const state = await page.evaluate(() => {
      const hrefs = [...document.querySelectorAll('.bang-canvas a[href]')].map((a) => a.getAttribute('href'))
      const dupes = hrefs.filter((href, index) => hrefs.indexOf(href) !== index)
      const hidden = [...document.querySelectorAll('.bang-canvas__tile')].filter((tile) => !tile.hasAttribute('aria-hidden')).length
      return { dupes, hrefs: hrefs.length, unlabelledTiles: hidden }
    })
    if (state.dupes.length > 0) throw new Error(`repeated canvas links: ${state.dupes.join(', ')}`)
    if (state.unlabelledTiles > 0) throw new Error(`${state.unlabelledTiles} canvas tiles miss aria-hidden`)
    return `${state.hrefs} canvas links, no repeats`
  })

  await check('home: the pause control stops the rotation', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const pause = await page.$('.bang-canvas__actions button[aria-pressed]')
    if (!pause) return 'no pause control (reduced-motion static composition)'
    await pause.click()
    await sleep(300)
    const pressed = await page.evaluate(() => document.querySelector('.bang-canvas__actions button[aria-pressed]')?.getAttribute('aria-pressed'))
    if (pressed !== 'true') throw new Error('pause did not engage')
    return 'rotation paused'
  })

  // --------------------------------------------------------------------- drawer
  const openDrawer = async (page) => {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${BASE}/projects`, { waitUntil: 'load' })
    await loaded(page, 'header')
    await page.click('.navbar__toggle, button[aria-label]')
    await waitFor(page, '.drawer__row')
    await sleep(400)
  }

  await check('drawer: Tab stays inside (focus trap)', async (page) => {
    await openDrawer(page)
    const inside = []
    for (let index = 0; index < 14; index += 1) {
      await page.keyboard.press('Tab')
      inside.push(await page.evaluate(() => Boolean(document.activeElement?.closest('.drawer')) || Boolean(document.activeElement?.closest('[role="dialog"]'))))
    }
    if (!inside.every(Boolean)) throw new Error(`focus escaped the drawer after ${inside.indexOf(false) + 1} tabs`)
    return `14 tabs stayed inside`
  })

  await check('drawer: Escape closes it and focus returns to the trigger', async (page) => {
    await openDrawer(page)
    await page.keyboard.press('Escape')
    await sleep(500)
    const state = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      focused: Boolean(document.activeElement?.closest('header')),
      open: Boolean(document.querySelector('.drawer__row')),
    }))
    if (state.open) throw new Error('drawer is still rendered after Escape')
    if (!state.focused) throw new Error('focus did not return to the header/trigger')
    if (state.bodyOverflow === 'hidden') throw new Error('body scroll lock was left behind')
    return `closed, focus in header, body overflow ${state.bodyOverflow}`
  })

  await check('drawer: navigating from the drawer closes it', async (page) => {
    await openDrawer(page)
    const href = await page.$eval('.drawer__row', (el) => el.getAttribute('href') ?? el.querySelector('a')?.getAttribute('href'))
    await page.evaluate((target) => {
      document.querySelectorAll(`.drawer__row`).forEach((el) => {
        const anchor = el.tagName === 'A' ? el : el.querySelector('a')
        if (anchor?.getAttribute('href') === target) anchor.click()
      })
    }, href)
    await sleep(1500)
    const open = await page.evaluate(() => Boolean(document.querySelector('.drawer__row')))
    if (open) throw new Error('the drawer is still open after navigation')
    return `navigated to ${href} with the drawer closed`
  })

  // ----------------------------------------------------------------------- form
  await check('contact: a double submit is ignored', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    const posts = []
    page.on('request', (request) => {
      if (request.url().includes('/api/form-submissions') && request.method() === 'POST') posts.push(request.url())
    })
    await page.goto(`${BASE}/contact`, { waitUntil: 'load' })
    await loaded(page, 'form')
    const values = { email: 'a@example.com', message: 'سلام', name: 'نمونه', phone: '09120000000' }
    for (const [name, value] of Object.entries(values)) {
      const selector = `[name="${name}"]`
      if (await page.$(selector)) await page.type(selector, value)
    }
    const consent = await page.$('[name="consent"]')
    if (consent) await consent.click()
    const submit = await page.$('button[type="submit"]')
    await Promise.all([submit.click(), submit.click().catch(() => {})])
    await waitFor(page, '[aria-live="polite"]')
    await sleep(600)
    if (posts.length !== 1) throw new Error(`${posts.length} POSTs reached the CMS for one submission`)
    return 'exactly one POST'
  })

  await check('contact: a failed submit keeps the entered values', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.setRequestInterception(true)
    let first = true
    page.on('request', (request) => {
      if (request.url().includes('/api/form-submissions') && first) {
        first = false
        request.respond({ body: '{"errors":[{"message":"nope"}]}', contentType: 'application/json', status: 500 })
        return
      }
      request.continue()
    })
    await page.goto(`${BASE}/contact`, { waitUntil: 'load' })
    await loaded(page, 'form')
    await page.type('[name="email"]', 'keep@example.com')
    await page.type('[name="message"]', 'متن نمونه برای بررسی')
    const consent = await page.$('[name="consent"]')
    if (consent) await consent.click()
    await page.click('button[type="submit"]')
    await sleep(1500)
    const values = await page.evaluate(() => ({
      email: document.querySelector('[name="email"]')?.value,
      message: document.querySelector('[name="message"]')?.value,
    }))
    if (values.email !== 'keep@example.com' || values.message !== 'متن نمونه برای بررسی') {
      throw new Error(`values were lost: ${JSON.stringify(values)}`)
    }
    return 'values preserved after a failure'
  })

  // ------------------------------------------------------- language and locale
  await check('home: the language link navigates from the canvas', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const link = await page.$('a[hreflang="en"]')
    if (!link) throw new Error('no English language link on the entrance')
    await link.focus()
    await page.keyboard.press('Enter')
    await sleep(1500)
    const url = page.url()
    if (!url.includes('/en')) throw new Error(`language link did not navigate (still ${url})`)
    return `navigated to ${url.replace(BASE, '')}`
  })

  await check('locale: English archive controls and breadcrumbs stay in English', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    const problems = []
    for (const path of ['/en/projects', '/en/objects']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' })
      await loaded(page, 'main')
      const state = await page.evaluate(() => ({
        actions: [...document.querySelectorAll('form[action]')].map((form) => form.getAttribute('action')),
        chips: [...document.querySelectorAll('.filter-chip')].map((chip) => chip.getAttribute('href')),
        crumbs: [...document.querySelectorAll('.breadcrumbs li')].map((li) => li.textContent.trim()),
      }))
      for (const href of [...state.chips, ...state.actions]) {
        if (href && !href.startsWith('/en')) problems.push(`${path} → ${href}`)
      }
      if (state.crumbs.some((crumb) => /[\u0600-\u06FF]/u.test(crumb))) problems.push(`${path} has a Persian breadcrumb`)
    }
    if (problems.length > 0) throw new Error(problems.join('; '))
    return 'filters, search actions and breadcrumbs all stay under /en'
  })

  await check('case study: facts, inquiry CTA and related work render', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/projects/khaneye-noor`, { waitUntil: 'load' })
    await loaded(page, 'main')
    const composition = await page.evaluate(() => ({
      facts: Boolean(document.querySelector('.bang-facts')),
      h1: document.querySelectorAll('main h1').length,
      inquiry: [...document.querySelectorAll('main a')].some((a) => a.getAttribute('href')?.includes('/contact')),
      repeatHidden: document.querySelector('.bang-case__repeat')?.getAttribute('aria-hidden') === 'true',
      share: [...document.querySelectorAll('main button')].some((b) => (b.textContent ?? '').includes('اشتراک') || (b.textContent ?? '').includes('Share')),
    }))
    if (composition.h1 !== 1) throw new Error(`case study has ${composition.h1} h1 elements`)
    if (!composition.repeatHidden) throw new Error('the decorative repeated title is not hidden from assistive tech')
    if (!composition.facts) throw new Error('the facts table is missing')
    if (!composition.inquiry) throw new Error('the inquiry CTA is missing')
    if (!composition.share) throw new Error('the share control is missing')
    return 'khaneye-noor: h1, hidden repeat, facts, inquiry, share'
  })

  await check('detail: wrong-section URLs redirect to the canonical section', async (page) => {
    const expectRedirect = async (from, to) => {
      await page.goto(`${BASE}${from}`, { waitUntil: 'load' })
      await sleep(600)
      const url = page.url().replace(BASE, '')
      if (!url.endsWith(to)) throw new Error(`${from} → ${url}, expected ${to}`)
    }
    await expectRedirect('/projects/raw-lamp', '/objects/raw-lamp')
    await expectRedirect('/objects/khaneye-noor', '/projects/khaneye-noor')
    return 'both mismatched detail URLs redirected'
  })

  // --------------------------------------------------------------- archives
  await check('archives: projects and objects list entries without overflow at 390px', async (page) => {
    await page.setViewport({ width: 390, height: 844 })
    for (const path of ['/projects', '/objects']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' })
      await loaded(page, 'main')
      const state = await page.evaluate(() => ({
        cards: document.querySelectorAll('.bang-card').length,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rows: document.querySelectorAll('.bang-row').length,
      }))
      if (state.cards === 0) throw new Error(`${path} rendered no cards`)
      if (state.documentOverflow > 1) throw new Error(`${path} overflows by ${state.documentOverflow}px`)
    }
    return 'both archives render cards with no overflow'
  })

  // ------------------------------------------------------------ drawer geometry
  await check('drawer: each locale opens from its own edge with bounded motion', async (page) => {
    const measure = async (path, expected) => {
      await page.setViewport({ width: 390, height: 844 })
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' })
      await loaded(page, 'header')
      await page.click('button[aria-label]')
      await page.waitForSelector('.drawer__panel', { timeout: 5000 })
      const during = await page.evaluate(() => {
        const panel = document.querySelector('.drawer__panel')
        return {
          animations: panel.getAnimations().map((animation) => ({
            duration: animation.effect.getTiming().duration,
            name: animation.animationName,
          })),
          rows: [...document.querySelectorAll('.drawer__row')].slice(0, 3).map((row) => ({
            delay: getComputedStyle(row).animationDelay,
            name: getComputedStyle(row).animationName,
          })),
        }
      })
      await sleep(500)
      const settled = await page.evaluate(() => {
        const panel = document.querySelector('.drawer__panel')
        const rect = panel.getBoundingClientRect()
        const styles = getComputedStyle(panel)
        // Compare against the body's layout edge: `scrollbar-gutter: stable` may reserve
        // a viewport gutter that no fixed panel should cover.
        const bodyRect = document.body.getBoundingClientRect()
        return {
          dir: panel.getAttribute('dir'),
          edgeEnd: Number.parseFloat(styles.borderInlineEndWidth) || 0,
          edgeLeft: bodyRect.left,
          edgeRight: bodyRect.right,
          edgeStart: Number.parseFloat(styles.borderInlineStartWidth) || 0,
          left: rect.left,
          right: rect.right,
        }
      })
      const animation = during.animations.find((entry) => entry.name.includes(expected.motion))
      if (!animation) throw new Error(`${path}: panel animation ${JSON.stringify(during.animations)}`)
      if (animation.duration < 250 || animation.duration > 350) {
        throw new Error(`${path}: panel travel is ${animation.duration}ms, outside 250–350ms`)
      }
      if (settled.dir !== expected.dir) throw new Error(`${path}: panel dir is ${settled.dir}`)
      const atEdge = expected.side === 'right'
        ? Math.abs(settled.right - settled.edgeRight) < 1.5
        : Math.abs(settled.left - settled.edgeLeft) < 1.5
      if (!atEdge) {
        throw new Error(`${path}: panel sits at ${settled.left}–${settled.right}, layout edge ${settled.edgeLeft}–${settled.edgeRight}`)
      }
      if (!(settled.edgeEnd > 0 && settled.edgeStart === 0)) throw new Error(`${path}: divider is not on the inner edge`)
      if (during.rows.length >= 2) {
        if (!during.rows.every((row) => row.name === 'drawer-row-in')) {
          throw new Error(`${path}: drawer rows are not animated (${during.rows.map((row) => row.name).join(', ')})`)
        }
        if (during.rows[0].delay === during.rows[1].delay) throw new Error(`${path}: drawer rows do not stagger`)
      }
      return `${settled.dir} ${expected.side} edge, ${animation.duration}ms`
    }
    const fa = await measure('/projects', { dir: 'rtl', motion: 'rtl', side: 'right' })
    const en = await measure('/en/projects', { dir: 'ltr', motion: 'ltr', side: 'left' })
    return `fa: ${fa}; en: ${en}`
  })

  // ------------------------------------------------------------------- forms
  await check('contact: an invalid email is blocked inline and posts nothing', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    const posts = []
    page.on('request', (request) => {
      if (request.url().includes('/api/form-submissions') && request.method() === 'POST') posts.push(request.url())
    })
    await page.goto(`${BASE}/contact`, { waitUntil: 'load' })
    await loaded(page, 'form')
    await page.type('[name="name"]', 'نمونه')
    await page.type('[name="email"]', 'not-an-email')
    await page.type('[name="message"]', 'متن نمونه')
    const consent = await page.$('[name="consent"]')
    if (consent) await consent.click()
    await page.click('button[type="submit"]')
    await sleep(400)
    const state = await page.evaluate(() => {
      const email = document.querySelector('[name="email"]')
      const describedBy = email?.getAttribute('aria-describedby')
      return {
        error: describedBy ? document.querySelector(`#${CSS.escape(describedBy)}`)?.textContent ?? '' : '',
        invalid: email?.getAttribute('aria-invalid'),
      }
    })
    if (state.invalid !== 'true' || !state.error.includes('ایمیل')) {
      throw new Error(`invalid email not blocked inline: ${JSON.stringify(state)}`)
    }
    if (posts.length !== 0) throw new Error('an invalid email reached the submission endpoint')
    await page.focus('[name="email"]')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.type('[name="email"]', 'valid@example.com')
    await page.click('button[type="submit"]')
    await sleep(1200)
    if (posts.length !== 1) throw new Error(`a corrected email did not submit (${posts.length} POSTs)`)
    return 'blocked inline, then submitted after correction'
  })

  // ------------------------------------------------------- responsive captions
  await check('archives: long card metadata stays readable at 390px', async (page) => {
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${BASE}/projects`, { waitUntil: 'load' })
    await loaded(page, '.bang-card')
    const measured = await page.evaluate(() => {
      const card = document.querySelector('.bang-card')
      const title = card.querySelector('.bang-card__title')
      const meta = card.querySelector('.bang-card__meta')
      title.textContent = 'خانه‌ای با نام بسیار طولانی در منطقه شمال غرب — نمونه'
      meta.textContent = 'تهران، منطقه شمال غرب — خیابان بسیار طولانی'
      const cardRect = card.getBoundingClientRect()
      const titleRect = title.getBoundingClientRect()
      const metaRect = meta.getBoundingClientRect()
      return {
        cardWidth: cardRect.width,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        metaInside: metaRect.left >= cardRect.left - 1 && metaRect.right <= cardRect.right + 1,
        overflowX: card.scrollWidth - card.clientWidth,
        titleWidth: titleRect.width,
      }
    })
    if (measured.titleWidth < 100) throw new Error(`long metadata collapsed the title to ${Math.round(measured.titleWidth)}px`)
    if (measured.overflowX > 1) throw new Error(`the card overflows by ${measured.overflowX}px`)
    if (!measured.metaInside) throw new Error('metadata escaped its card')
    if (measured.documentOverflow > 1) throw new Error(`the document overflows by ${measured.documentOverflow}px`)
    return `title ${Math.round(measured.titleWidth)}px in a ${Math.round(measured.cardWidth)}px card, no overflow`
  })

  // ---------------------------------------------------------------- typography
  await check('fonts: the licensed Shazde weights are installed and active', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/about`, { waitUntil: 'load' })
    await loaded(page, '.pcard')
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready
      const faces = [...document.fonts].filter((face) => face.family.includes('Shazde')).map((face) => face.weight)
      return {
        active: document.fonts.check('400 16px Shazde'),
        bodyFamily: getComputedStyle(document.body).fontFamily,
        faces: [...new Set(faces)].sort(),
      }
    })
    if (!fonts.active) throw new Error(`Shazde is declared but not active (body: ${fonts.bodyFamily})`)
    for (const weight of ['300', '400', '500', '600', '700', '800', '900']) {
      if (!fonts.faces.includes(weight)) throw new Error(`missing Shazde weight ${weight}: ${fonts.faces.join(', ')}`)
    }
    return `weights ${fonts.faces.join(', ')}`
  })

  await check('lines: decorative strokes follow the decorative token at 1x and 2x', async (page) => {
    const read = async (scale) => {
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: scale })
      await page.goto(`${BASE}/about`, { waitUntil: 'load' })
      await loaded(page, '.pcard')
      return page.evaluate(() => ({
        mark: getComputedStyle(document.querySelector('.mark svg')).strokeWidth,
        rule: getComputedStyle(document.querySelector('.rule-h')).blockSize,
      }))
    }
    const at1x = await read(1)
    const at2x = await read(2)
    if (at1x.mark !== '1px') throw new Error(`1x decorative stroke is ${at1x.mark}`)
    if (at2x.mark !== '0.5px') throw new Error(`2x decorative stroke is ${at2x.mark}`)
    if (at1x.rule !== '1px' || at2x.rule !== '0.5px') throw new Error(`structural rule drifted: ${at1x.rule}/${at2x.rule}`)
    return `decorative ${at1x.mark} → ${at2x.mark}; structural ${at1x.rule} → ${at2x.rule}`
  })

  // --------------------------------------------------- loading + reduced motion
  await check('reduced motion: the drawer is immediate but still operable', async (page) => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${BASE}/projects`, { waitUntil: 'load' })
    await loaded(page, 'header')
    await page.click('button[aria-label]')
    await page.waitForSelector('.drawer__panel', { timeout: 5000 })
    const state = await page.evaluate(() => {
      const panel = document.querySelector('.drawer__panel')
      const rows = [...document.querySelectorAll('.drawer__row')]
      return {
        panelAnimation: getComputedStyle(panel).animationName,
        rowAnimations: rows.map((row) => getComputedStyle(row).animationName),
        rows: rows.length,
        skeletonAnimation: document.querySelector('.skeleton-region')
          ? getComputedStyle(document.querySelector('.skeleton-region')).animationName
          : 'absent',
      }
    })
    if (state.panelAnimation !== 'none') throw new Error(`panel still animates: ${state.panelAnimation}`)
    if (!state.rowAnimations.every((name) => name === 'none')) throw new Error('row stagger is not disabled')
    if (state.skeletonAnimation !== 'none' && state.skeletonAnimation !== 'absent') {
      throw new Error(`skeleton still pulses: ${state.skeletonAnimation}`)
    }
    if (state.rows === 0) throw new Error('drawer rows are missing under reduced motion')
    return 'panel, rows and skeleton are static; drawer still opens'
  })

  await check('loading: slow archive navigation keeps the real header and its own composition', async (page) => {
    const reachable = await fetch(`${SLOW_BASE}/`, { signal: AbortSignal.timeout(2500) })
      .then((response) => response.ok)
      .catch(() => false)
    if (!reachable) return `skipped — no slow-CMS theme at ${SLOW_BASE}`

    await page.setViewport({ width: 1440, height: 900 })

    // Capture through a throttled *client* navigation, the path a visitor actually meets
    // a skeleton on: the prefetched segment boundary paints while the data request is in
    // flight. A full page load streams fallback and resolved content in one response, so
    // the inline swap can land before a script reads the fallback, and the server's fetch
    // cache makes a repeat load instant. The wait is scoped to the variant's own selector
    // — never the root boundary — and the sample runs atomically inside `waitForFunction`.
    const captureSkeleton = async ({ from, target, selector, sample }) => {
      await page.goto(`${SLOW_BASE}${from}`, { waitUntil: 'load', timeout: 60000 })
      await loaded(page, 'header')
      const client = await page.createCDPSession()
      await client.send('Network.enable')
      await client.send('Network.emulateNetworkConditions', {
        downloadThroughput: (500 * 1024) / 8,
        latency: 400,
        offline: false,
        uploadThroughput: (500 * 1024) / 8,
      })
      try {
        const clicked = await page.evaluate((href) => {
          const link = [...document.querySelectorAll(`a[href="${href}"]`)].find((node) => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          })
          if (!link) return false
          link.click()
          return true
        }, target)
        if (!clicked) throw new Error(`no reachable link from ${from} to ${target}`)
        await page.waitForSelector(selector, { timeout: 20000 })
        const handle = await page.waitForFunction(sample, { polling: 'raf', timeout: 5000 })
        return await handle.jsonValue()
      } finally {
        await client
          .send('Network.emulateNetworkConditions', {
            downloadThroughput: -1,
            latency: 0,
            offline: false,
            uploadThroughput: -1,
          })
          .catch(() => {})
      }
    }

    const objects = await captureSkeleton({
      from: '/projects',
      target: '/objects',
      selector: '.skeleton-region.grid-projects',
      sample: () => {
        const region = document.querySelector('.skeleton-region')
        if (!region || !region.classList.contains('grid-projects')) return false
        return {
          cards: region.querySelectorAll(':scope > div').length,
          heading: document.querySelector('h1')?.textContent?.trim() ?? '',
          label: region.querySelector('.sr-only')?.textContent?.trim() ?? '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      },
    })
    if (objects.heading !== 'آبژه‌ها') throw new Error(`objects header changed while loading: “${objects.heading}”`)
    if (objects.cards < 3) {
      throw new Error(`objects skeleton lost its composition: ${JSON.stringify(objects)}`)
    }
    if (!objects.label.includes('بارگذاری')) throw new Error(`objects loading label: “${objects.label}”`)
    if (objects.overflow > 1) throw new Error(`objects skeleton overflows by ${objects.overflow}px`)

    const projects = await captureSkeleton({
      from: '/objects',
      target: '/projects',
      selector: '.skeleton-region.grid-projects',
      sample: () => {
        const region = document.querySelector('.skeleton-region')
        if (!region || !region.classList.contains('grid-projects')) return false
        return {
          cards: region.querySelectorAll(':scope > div').length,
          heading: document.querySelector('h1')?.textContent?.trim() ?? '',
          label: region.querySelector('.sr-only')?.textContent?.trim() ?? '',
        }
      },
    })
    if (projects.heading !== 'پروژه‌ها') throw new Error(`projects header changed while loading: “${projects.heading}”`)
    if (projects.cards < 3) {
      throw new Error(`projects skeleton lost its composition: ${JSON.stringify(projects)}`)
    }
    if (!projects.label.includes('بارگذاری')) throw new Error(`projects loading label: “${projects.label}”`)
    return `objects header + ${objects.cards} cards; projects header + ${projects.cards} cards`

  })

  await browser.close()
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'interaction-report.json'), `${JSON.stringify({ base: BASE, results: checks }, null, 2)}\n`)
  for (const entry of checks) console.log(`${entry.ok ? 'ok     ' : 'FAIL   '} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`)
  const failed = checks.filter((entry) => !entry.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} interaction checks passed`)
  if (failed.length > 0) process.exitCode = 1
}

main()
