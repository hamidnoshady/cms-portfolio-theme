import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer-core'

/**
 * Interaction audit — the behaviours a screenshot cannot prove.
 *
 * The brief asks for specific *behaviour*: a canvas whose works are all reachable
 * without a pointer, a drag that pans instead of opening a work and a click that opens
 * the one under the pointer, a drawer that traps focus, closes on Escape, restores
 * focus, unlocks scrolling and closes on navigation, and a form that cannot be
 * submitted twice.
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
  /**
   * The home page is a canvas now, not a slider: no dots, no rotating featured work, no
   * pause control. What this audit still owns here is the *accessible* half of the
   * experience — the canonical list of works, the walk from the canvas into the
   * archives, the language switch, the separation of a drag from a click, and the fact
   * that all of it is reached with a keyboard. The endless field itself (coverage,
   * wrapping, no teleports, momentum, the custom cursor, reduced motion, no-JS) is
   * audited in `home-canvas-audit.mjs`, and its motion is recorded by
   * `home-canvas-motion.mjs`; a screenshot-free audit is not the place to duplicate it.
   */
  await check('home: the canvas serves the works themselves — no carousel left over', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const state = await page.evaluate(() => ({
      dots: document.querySelectorAll('.bang-dot, .bang-canvas__dots').length,
      pressed: document.querySelectorAll('.bang-canvas__actions button[aria-pressed]').length,
      tiles: document.querySelectorAll('.bang-canvas__tile').length,
      visible: [...document.querySelectorAll('.bang-canvas__tile')].filter((tile) => {
        const rect = tile.getBoundingClientRect()
        return rect.width > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
      }).length,
    }))
    if (state.dots > 0 || state.pressed > 0) throw new Error('a carousel control survived the rewrite')
    if (state.tiles === 0 || state.visible < 2) throw new Error(`a canvas with ${state.tiles} tiles, ${state.visible} on screen, is not a field`)
    return `${state.tiles} tiles, ${state.visible} on screen, no carousel controls`
  })

  await check('home: every work is reachable without a pointer, from the served HTML', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const state = await page.evaluate(() => {
      const field = document.querySelector('.bang-canvas')
      const links = [...document.querySelectorAll('.bang-index__link')]
      return {
        fieldHidden: field?.getAttribute('aria-hidden') === 'true',
        focusableTiles: [...document.querySelectorAll('.bang-canvas__tile')].filter((tile) => tile.getAttribute('tabindex') !== '-1').length,
        hrefs: links.map((link) => link.getAttribute('href')),
      }
    })
    const unique = new Set(state.hrefs)
    if (!state.fieldHidden) throw new Error('the repeated visual field is exposed to assistive technology')
    if (state.focusableTiles > 0) throw new Error(`${state.focusableTiles} duplicated tiles are in the tab order`)
    if (state.hrefs.length === 0 || unique.size !== state.hrefs.length) throw new Error(`the work list is missing or repeats: ${state.hrefs.join(', ')}`)
    // Keyboard: the first tab stop after the skip link is the work list itself.
    await page.keyboard.press('Tab')
    const restored = await page.evaluate(() => document.activeElement?.getAttribute('href'))
    if (restored !== '#bang-works') throw new Error(`the first tab stop is ${restored}, not the work list`)
    return `${state.hrefs.length} works, one destination each, first tab stop is the list`
  })

  await check('home: a drag pans and a click opens the work under the pointer', async (page) => {
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await loaded(page, '.bang-canvas')
    const target = await page.evaluate(() => {
      for (const node of document.querySelectorAll('.bang-canvas__tile')) {
        const rect = node.getBoundingClientRect()
        if (rect.width < 140 || rect.height < 90) continue
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        if (document.elementFromPoint(x, y)?.closest('.bang-canvas__tile') !== node) continue
        return { href: node.getAttribute('href'), x, y }
      }
      return null
    })
    if (!target) throw new Error('no tile of the field is reachable to click')
    // Drag the same tile: the field moves, nothing opens.
    await page.mouse.move(target.x, target.y)
    await page.mouse.down()
    await page.mouse.move(target.x - 90, target.y - 50, { steps: 10 })
    await page.mouse.up()
    await sleep(400)
    if (await page.evaluate(() => location.pathname) !== '/') throw new Error('a drag opened a work')
    // Then click it: that work opens, over the canvas.
    const moved = await page.evaluate((href) => {
      for (const node of document.querySelectorAll('.bang-canvas__tile')) {
        if (node.getAttribute('href') !== href) continue
        const rect = node.getBoundingClientRect()
        if (rect.width < 140 || rect.height < 90) continue
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      }
      return null
    }, target.href)
    if (!moved) throw new Error('the work that was dragged is no longer on screen to click')
    await page.mouse.click(moved.x, moved.y)
    await page.waitForSelector('.bang-overlay', { timeout: 15000 })
    const opened = await page.evaluate(() => location.pathname)
    const expected = new URL(target.href, BASE).pathname
    if (opened !== expected) throw new Error(`clicking opened ${opened} instead of ${expected}`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.bang-overlay'), { timeout: 15000 })
    return `drag stayed on /, click opened ${opened}, Escape closed it`
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

    // Client navigation through the real header: the layout (and its header) stays
    // mounted by construction, so whatever fallback the archive paints is sampled
    // with the genuine chrome around it — the navbar rule, the archive heading and
    // the grid geometry must all survive the slow collection read.
    const captureSkeleton = async ({ from, heading, href }) => {
      const client = await page.createCDPSession()
      await client.send('Network.enable')
      await client.send('Network.emulateNetworkConditions', {
        downloadThroughput: (500 * 1024) / 8,
        latency: 400,
        offline: false,
        uploadThroughput: (500 * 1024) / 8,
      })
      try {
        await page.goto(`${SLOW_BASE}${from}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForSelector('header nav a', { timeout: 30000 })
        const clicked = await page.evaluate((target) => {
          const link = [...document.querySelectorAll('header a')].find(
            (a) => a.getAttribute('href') === target && a.getBoundingClientRect().width > 0,
          )
          if (!link) return false
          link.click()
          return true
        }, href)
        if (!clicked) throw new Error(`no reachable header link to ${href} on ${from}`)
        // The archive boundary resolves its chrome context first (a generic
        // skeleton), then paints its own grid skeleton while the collection read
        // is in flight — the grid is the composition this check samples.
        await page.waitForSelector('.skeleton-region.grid-projects', { timeout: 25000 })
        const handle = await page.waitForFunction(
          (want) => {
            const region = document.querySelector('.skeleton-region')
            if (!region || !region.classList.contains('grid-projects')) return false
            if ((document.querySelector('h1')?.textContent?.trim() ?? '') !== want) return false
            return {
              cards: region.querySelectorAll(':scope > div').length,
              header: Boolean(document.querySelector('header')),
              label: region.querySelector('.sr-only')?.textContent?.trim() ?? '',
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            }
          },
          { polling: 'raf', timeout: 10000 },
          heading,
        )
        return { ...(await handle.jsonValue()), heading }
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

    const objects = await captureSkeleton({ from: '/projects', heading: 'آبژه‌ها', href: '/objects' })
    if (!objects.header) throw new Error('objects skeleton lost the header')
    if (objects.cards < 3) throw new Error(`objects skeleton lost its composition: ${JSON.stringify(objects)}`)
    if (!objects.label.includes('بارگذاری')) throw new Error(`objects loading label: “${objects.label}”`)
    if (objects.overflow > 1) throw new Error(`objects skeleton overflows by ${objects.overflow}px`)

    const projects = await captureSkeleton({ from: '/en/objects', heading: 'Projects', href: '/en/projects' })
    if (!projects.header) throw new Error('projects skeleton lost the header')
    if (projects.cards < 3) throw new Error(`projects skeleton lost its composition: ${JSON.stringify(projects)}`)
    if (!projects.label.includes('Loading')) throw new Error(`projects loading label: “${projects.label}”`)
    return `objects header + ${objects.cards} cards; en projects header + ${projects.cards} cards`
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
