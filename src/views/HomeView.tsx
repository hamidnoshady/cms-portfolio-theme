import type { Metadata } from 'next'
import Link from 'next/link'

import { CanvasField } from '@/components/home/CanvasField'
import { planCanvas, type CanvasWork } from '@/components/home/canvasPlan'
import { WorkIndex } from '@/components/home/WorkIndex'
import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { Logo } from '@/components/layout/Logo'
import { MobileMenu } from '@/components/layout/MobileMenu'
import { StudioClock } from '@/components/portfolio/StudioClock'
import { StateView } from '@/views/StateView'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getArchive, localizedPostHref } from '@/lib/cms/content'
import { toCaseStudy } from '@/domain/portfolio'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { metadataFor } from '@/lib/seo/metadata'
import { brandName } from '@/lib/theme/brand'
import { getChrome } from '@/lib/theme/chrome'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale, PostDoc } from '@/lib/cms/types'

export const homeMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const ctx = outcome.ctx
  return metadataFor({ context: ctx, description: ctx.site.branding?.tagline ?? null, path: '/', title: brandName(ctx.site) })
}

const canvasDensity = (settings: Record<string, unknown>): number => {
  const value = typeof settings.canvasDensity === 'number' ? settings.canvasDensity : 5
  return Math.min(8, Math.max(3, value))
}

const clockConfig = (settings: Record<string, unknown>): Array<{ label: string; zone: string }> => {
  const aLabel = typeof settings.clockLabelA === 'string' && settings.clockLabelA ? settings.clockLabelA : 'BUE'
  const aZone = typeof settings.clockZoneA === 'string' && settings.clockZoneA ? settings.clockZoneA : 'America/Argentina/Buenos_Aires'
  const bLabel = typeof settings.clockLabelB === 'string' && settings.clockLabelB ? settings.clockLabelB : 'BCN'
  const bZone = typeof settings.clockZoneB === 'string' && settings.clockZoneB ? settings.clockZoneB : 'Europe/Madrid'
  return [
    { label: aLabel, zone: aZone },
    { label: bLabel, zone: bZone },
  ]
}

/**
 * Home: the studio's canvas.
 *
 * A field of photographs, scattered around the wordmark, that never ends — pan it with
 * the wheel, a trackpad, a finger or the arrow keys, and every image opens its own
 * case study. The composition is decided by `canvasPlan.ts` and rendered by the
 * server; the canvas only ever *moves* what is already on screen.
 *
 * Three presentations, one template:
 *
 *  - **canvas** (fine pointer, motion allowed): the field pans forever, the cursor is
 *    the studio's own (`CustomCursor`), the selected-work index is a corner control;
 *  - **static** (no JavaScript, `prefers-reduced-motion: reduce`, or the CMS turning
 *    `canvasMotion` off): the same composition as a single full-height field, the
 *    document scrolls normally and the selected-work index is an open section below
 *    it — this is the presentation the server renders, so nothing depends on a script
 *    having run;
 *  - **empty** (no published work, or no section bindings): a meaningful state and a
 *    link to the archives, never a fabricated tile.
 *
 * Identity comes from the CMS: the wordmark is the site's own display name (or its
 * uploaded mark), the navigation is the CMS header, the clocks are theme settings.
 * Nothing in this file hardcodes a customer name.
 */
export const HomeView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const settings = (ctx.site.themeRuntime?.settings ?? {}) as Record<string, unknown>
  const density = canvasDensity(settings)
  const motionEnabled = settings.canvasMotion !== false
  const chrome = await getChrome(ctx, '/')

  // Featured work: the newest published case studies across both sections, bounded by
  // the CMS density setting. Unpublished, missing and duplicate entries are dropped —
  // never fabricated, never repeated in the index.
  const [projects, objects] = await Promise.all([
    getArchive(ctx, { limit: density, section: 'projects' }).catch(() => ({ docs: [] as PostDoc[] })),
    getArchive(ctx, { limit: density, section: 'objects' }).catch(() => ({ docs: [] as PostDoc[] })),
  ])
  const merged = [...projects.docs, ...objects.docs]
    .sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')) || String(a.slug).localeCompare(String(b.slug)))
  const unique = new Map(merged.map((post) => [String(post.id), post]))

  const works: CanvasWork[] = await Promise.all(
    [...unique.values()].slice(0, density).map(async (post) => {
      const study = toCaseStudy(post)
      return {
        href: await localizedPostHref(post, ctx),
        id: study.id,
        media: study.hero,
        meta: [study.year, study.type].filter(Boolean).join(' · ') || undefined,
        title: study.title,
      } satisfies CanvasWork
    }),
  )
  const plan = planCanvas(works)
  const browseHref = href(THEME_ROUTES.projects, locale, ctx.site)
  const brand = brandName(ctx.site)
  const mark = chrome.logo.home ?? chrome.logo.primary ?? chrome.logo.compact

  return (
    <div className="bang-home" id="bang-home">
      <a className="skip-link" href="#bang-works">
        {t.selectedWork}
      </a>
      <header className="bang-top">
        <Logo context={ctx} mark={{ compact: chrome.logo.compact, primary: chrome.logo.primary }} />
        <nav aria-label={t.menuTitle} className="bang-nav">
          <ul className="bang-nav__list">
            {chrome.headerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  aria-current={link.current ? 'page' : undefined}
                  className="bang-nav__link"
                  href={link.href}
                  rel={link.external ? 'noreferrer' : undefined}
                  target={link.newTab ? '_blank' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="bang-top__utils">
          <LanguageSwitch className="bang-top__language" current={locale} hrefs={chrome.switchTargets} label={t.languageSwitch} />
          <MobileMenu
            dir={ctx.dir}
            labels={{ close: t.close, menu: t.menu, menuTitle: t.menuTitle }}
            links={chrome.headerLinks}
          >
            <LanguageSwitch current={locale} hrefs={chrome.switchTargets} label={t.languageSwitch} />
          </MobileMenu>
        </div>
      </header>

      <main className="bang-stage" id="content">
        <h1 className="bang-wordmark" data-wordmark={mark ? 'logo' : 'wordmark'}>
          {mark ? (
            // An uploaded mark is shown as itself (an `<img>`, never inlined markup) —
            // the blend that makes a *text* wordmark readable over photography would
            // invert a logo instead of protecting it.
            <img alt={brand} className="bang-wordmark__mark" decoding="async" fetchPriority="high" src={mark} />
          ) : (
            <span className="bang-wordmark__text">{brand}</span>
          )}
        </h1>

        {works.length > 0 ? (
          <CanvasField mediaOrigin={ctx.site.media.origin} motionEnabled={motionEnabled} plan={plan} works={works} />
        ) : null}

        <WorkIndex
          browseHref={browseHref}
          browseLabel={t.browseProjects}
          labels={{ count: t.selectedWorkCount(works.length), index: t.selectedWork }}
          works={works}
        />
      </main>

      <footer className="bang-footer">
        <StudioClock clocks={clockConfig(settings)} />
        <div className="bang-footer__end">
          <p className="type-meta">© {brand}</p>
          {chrome.footerLinks.length > 0 ? (
            <ul className="bang-footer__links">
              {chrome.footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    className="bang-footer__link type-meta"
                    href={link.href}
                    rel={link.external ? 'noreferrer' : undefined}
                    target={link.newTab ? '_blank' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
