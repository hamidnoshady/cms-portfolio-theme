import type { Metadata } from 'next'

import { ContentContainer } from '@/components/design/Container'
import { Pagination } from '@/components/design/Pagination'
import { PortfolioArchive, type ArchiveEntry } from '@/components/portfolio/ArchiveViews'
import { EmptyState } from '@/components/states/States'
import { toCaseStudy } from '@/domain/portfolio'
import { getArchive, localizedPostHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import type { Locale } from '@/lib/cms/types'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { archivePath, type PortfolioSection } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { brandName } from '@/lib/theme/brand'
import { labels as dictionary } from '@/lib/theme/labels'
import { resolveThemeSettings } from '@/lib/theme/settings'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'

const ARCHIVE_PAGE_LIMIT = 24

export const parseArchivePage = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(String(raw ?? '1'), 10)
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1
}

export const archiveMetadata = async (locale: Locale, section: PortfolioSection): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, archivePath(section))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const t = dictionary(locale)
  const title = section === 'projects' ? t.projects : t.objects
  return metadataFor({
    context: outcome.ctx,
    description: null,
    path: archivePath(section),
    title: `${title} — ${brandName(outcome.ctx.site)}`,
  })
}

export const PortfolioArchiveView = async ({
  locale,
  page,
  pageParam,
  section,
}: {
  locale: Locale
  page?: number
  pageParam?: string | string[]
  section: PortfolioSection
}) => {
  const path = archivePath(section)
  const outcome = await loadPageContext(locale, path)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const currentPage = page ?? parseArchivePage(pageParam)
  const settings = resolveThemeSettings(ctx.site)

  const archive = await getArchive(ctx, { limit: ARCHIVE_PAGE_LIMIT, page: currentPage, section })
  const route = resolveLocaleRoute([section], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  const title = section === 'projects' ? t.projects : t.objects

  const entries: ArchiveEntry[] = await Promise.all(
    archive.docs.map(async (post) => {
      const cs = toCaseStudy(post)
      return {
        collaborators: cs.collaborators,
        href: await localizedPostHref(post, ctx),
        location: cs.location,
        media: cs.hero,
        title: cs.title,
        type: cs.facts.find((f) => /type|typ|نوع/i.test(f.label))?.value ?? cs.type,
        year: cs.year,
      }
    }),
  )

  const startNumber = ((archive.page ?? currentPage) - 1) * ARCHIVE_PAGE_LIMIT + 1
  const switchQuery = currentPage > 1 ? `?page=${currentPage}` : ''

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={path}
      label={t.breadcrumb}
      switchQuery={switchQuery}
    >
      <ContentContainer className="bang-archive-page py-8">
        <h1 className="type-title mb-6" dir="auto">{title}</h1>
        {entries.length === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <>
            <PortfolioArchive
              entries={entries}
              layout={settings.archiveLayout}
              origin={ctx.site.media.origin}
              sectionKey={section}
              startIndex={startNumber}
            />
            <Pagination
              basePath={path}
              currentPage={archive.page ?? currentPage}
              label={t.breadcrumb}
              labels={{ next: t.next, previous: t.previous }}
              locale={locale}
              totalPages={archive.totalPages ?? 1}
            />
          </>
        )}
      </ContentContainer>
    </InteriorPage>
  )
}
