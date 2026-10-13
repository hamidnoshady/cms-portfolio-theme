import type { Metadata } from 'next'
import Link from 'next/link'
import { CanvasStage, type CanvasWork } from '@/components/portfolio/CanvasStage'
import { StudioClock } from '@/components/portfolio/StudioClock'
import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { Logo } from '@/components/layout/Logo'
import { StateView } from '@/views/StateView'
import { getHeader } from '@/lib/cms/endpoints'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getArchive, localizedPostHref } from '@/lib/cms/content'
import { navLinks, brandLogo } from '@/lib/routing/nav'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { metadataFor } from '@/lib/seo/metadata'
import { switchTargetsForPath } from '@/lib/seo/translations'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale } from '@/lib/cms/types'
import { toCaseStudy } from '@/domain/portfolio'
import { brandName } from '@/lib/theme/brand'

export const homeMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const ctx = outcome.ctx
  return metadataFor({ context: ctx, description: ctx.site.branding?.tagline ?? null, path: '/', title: brandName(ctx.site) })
}

/** Home: curated CMS-driven image composition + clear Browse Projects action. */
export const HomeView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const header = await getHeader(locale, ctx.draft)
  const links = await navLinks(header?.navItems, ctx, '/')
  const settings = (ctx.site.themeRuntime?.settings ?? {}) as Record<string, unknown>
  const density = typeof settings.canvasDensity === 'number' ? Math.min(8, Math.max(3, settings.canvasDensity)) : 6

  // Featured work: newest published case studies across both sections (bounded,
  // unpublished/missing ignored, never fabricated).
  const [projects, objects] = await Promise.all([
    getArchive(ctx, { limit: density, section: 'projects' }).catch(() => ({ docs: [] as never[] })),
    getArchive(ctx, { limit: density, section: 'objects' }).catch(() => ({ docs: [] as never[] })),
  ])
  const merged = [...(projects as { docs: never[] }).docs, ...(objects as { docs: never[] }).docs]
    .sort((a: never, b: never) => String((b as { publishedAt?: string }).publishedAt ?? '').localeCompare(String((a as { publishedAt?: string }).publishedAt ?? '')))
    .slice(0, density)
  const works: CanvasWork[] = await Promise.all(
    (merged as Parameters<typeof toCaseStudy>[0][]).map(async (post) => ({
      href: await localizedPostHref(post, ctx),
      title: toCaseStudy(post).title,
      media: toCaseStudy(post).hero,
    })),
  )

  const logo = brandLogo(ctx)
  const clocks = clockConfig(settings)
  const browseHref = href(THEME_ROUTES.projects, locale, ctx.site)

  return (
    <div className="flex min-h-svh flex-col">
      <a className="skip-link" href="#content">{t.skipToContent}</a>
      <header className="bang-top">
        <Logo context={ctx} mark={logo} />
        <nav aria-label={t.menuTitle}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link aria-current={l.current ? 'page' : undefined} href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitch current={locale} hrefs={switchTargetsForPath(ctx, () => THEME_ROUTES.home)} label={t.languageSwitch} />
      </header>
      <main className="flex-1" id="content">
        <CanvasStage browseHref={browseHref} browseLabel={t.browseProjects} locale={locale} origin={ctx.site.media.origin} works={works} />
        <p className="type-meta mt-4 text-center" aria-hidden="true">estudiobang</p>
      </main>
      <footer className="bang-footer">
        <div className="bang-footer__utils">
          <StudioClock clocks={clocks} />
          <p className="type-meta">© {brandName(ctx.site)}</p>
        </div>
      </footer>
    </div>
  )
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
