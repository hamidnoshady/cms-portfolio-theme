import type { Metadata } from 'next'
import { ContentContainer } from '@/components/design/Container'
import { PortfolioArchive, type ArchiveEntry } from '@/components/portfolio/ArchiveViews'
import { EmptyState } from '@/components/states/States'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getArchive, localizedPostHref } from '@/lib/cms/content'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { archivePath, type PortfolioSection } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { toCaseStudy } from '@/domain/portfolio'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'
import { brandName } from '@/lib/theme/brand'

export const archiveMetadata = async (locale: Locale, section: PortfolioSection): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, archivePath(section))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const t = dictionary(locale)
  const title = section === 'projects' ? t.projects : t.objects
  return metadataFor({ context: outcome.ctx, description: null, path: archivePath(section), title: `${title} — ${brandName(outcome.ctx.site)}` })
}

export const PortfolioArchiveView = async ({ locale, section }: { locale: Locale; section: PortfolioSection }) => {
  const path = archivePath(section)
  const outcome = await loadPageContext(locale, path)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const archive = await getArchive(ctx, { limit: 48, section })
  const route = resolveLocaleRoute([section], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  const title = section === 'projects' ? t.projects : t.objects

  const entries: ArchiveEntry[] = await Promise.all(
    archive.docs.map(async (post) => {
      const cs = toCaseStudy(post)
      return {
        href: await localizedPostHref(post, ctx),
        title: cs.title,
        year: cs.year,
        location: cs.location,
        type: cs.facts.find((f) => /type|typ|نوع/i.test(f.label))?.value ?? cs.type,
        collaborators: cs.collaborators,
        media: cs.hero,
      }
    }),
  )

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={path} label={t.breadcrumb}>
      <ContentContainer>
        <h1 className="type-title">{title}</h1>
        {entries.length === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <PortfolioArchive entries={entries} locale={locale} origin={ctx.site.media.origin} />
        )}
      </ContentContainer>
    </InteriorPage>
  )
}
