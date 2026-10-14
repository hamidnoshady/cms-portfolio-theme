import type { Metadata } from 'next'

import { BrandWordmark } from '@/components/home/BrandWordmark'
import { CanvasField } from '@/components/home/CanvasField'
import { planCanvas, type CanvasWork } from '@/components/home/canvasPlan'
import { LanguageSwitch } from '@/components/layout/LanguageSwitch'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { EmptyState, ErrorState } from '@/components/states/States'
import { toCaseStudy } from '@/domain/portfolio'
import { getArchive, localizedPostHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import type { Locale, PostDoc } from '@/lib/cms/types'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { metadataFor } from '@/lib/seo/metadata'
import { brandName } from '@/lib/theme/brand'
import { getChrome } from '@/lib/theme/chrome'
import { labels as dictionary } from '@/lib/theme/labels'
import { StateView } from '@/views/StateView'

export const homeMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const ctx = outcome.ctx
  return metadataFor({
    context: ctx,
    description: ctx.site.branding?.tagline ?? null,
    path: '/',
    title: brandName(ctx.site),
  })
}

const canvasDensity = (settings: Record<string, unknown>): number => {
  const value = typeof settings.canvasDensity === 'number' ? settings.canvasDensity : 5
  return Math.min(8, Math.max(3, value))
}

export type ArchiveFetchStatus = 'ready' | 'empty' | 'error'

export const classifyHomeArchiveOutcome = ({
  objectsError,
  projectsError,
  worksCount,
}: {
  objectsError: boolean
  projectsError: boolean
  worksCount: number
}): ArchiveFetchStatus => {
  if (worksCount > 0) return 'ready'
  if (projectsError && objectsError) return 'error'
  return 'empty'
}

export const HomeView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, '/')
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const settings = (ctx.site.themeRuntime?.settings ?? {}) as Record<string, unknown>
  const density = canvasDensity(settings)
  const motionEnabled = settings.canvasMotion !== false
  const chrome = await getChrome(ctx, '/')

  const [projects, objects] = await Promise.all([
    getArchive(ctx, { limit: density, section: 'projects' })
      .then((res) => ({ docs: res.docs, failed: false }))
      .catch(() => ({ docs: [] as PostDoc[], failed: true })),
    getArchive(ctx, { limit: density, section: 'objects' })
      .then((res) => ({ docs: res.docs, failed: false }))
      .catch(() => ({ docs: [] as PostDoc[], failed: true })),
  ])
  const projectsError = projects.failed
  const objectsError = objects.failed

  const merged = [...projects.docs, ...objects.docs].sort(
    (a, b) =>
      String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')) ||
      String(a.slug).localeCompare(String(b.slug)),
  )
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

  const archiveStatus = classifyHomeArchiveOutcome({
    objectsError,
    projectsError,
    worksCount: works.length,
  })
  const plan = planCanvas(works)
  const brand = brandName(ctx.site)
  const browseHref = href(THEME_ROUTES.projects, locale, ctx.site)

  return (
    <div className="bang-home" id="bang-home">
      <a className="skip-link" href={works.length > 0 ? '#bang-works' : '#content'}>
        {works.length > 0 ? t.selectedWork : t.skipToContent}
      </a>

      <SiteHeader
        context={ctx}
        floating
        links={chrome.headerLinks}
        logo={chrome.logo}
        switchTargets={chrome.switchTargets}
      />

      <main className="bang-stage" id="content">
        <BrandWordmark brand={brand} />

        {archiveStatus === 'ready' ? (
          <CanvasField
            brand={brand}
            deploymentOrigin={ctx.deploymentOrigin}
            mediaOrigin={ctx.site.media.origin}
            motionEnabled={motionEnabled}
            plan={plan}
            works={works}
          />
        ) : archiveStatus === 'error' ? (
          <div className="bang-home__state" id="bang-works">
            <ErrorState locale={locale} />
          </div>
        ) : (
          <div className="bang-home__state" id="bang-works">
            <EmptyState
              action={{ href: browseHref, label: t.browseProjects }}
              body={t.emptyArchiveBody}
              locale={locale}
              title={t.emptyArchiveTitle}
            />
          </div>
        )}
      </main>

      <div className="bang-corner-lang">
        <LanguageSwitch current={locale} hrefs={chrome.switchTargets} label={t.languageSwitch} />
      </div>
    </div>
  )
}
