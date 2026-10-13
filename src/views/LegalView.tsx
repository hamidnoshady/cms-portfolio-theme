import type { Metadata } from 'next'
import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { EmptyState } from '@/components/states/States'
import { getSectionPage } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'
import { documentLanguages } from '@/lib/seo/translations'

export const legalMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.legal)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('legal', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.legal }) : undefined,
    path: THEME_ROUTES.legal,
    title: page?.title ?? dictionary(locale).legal,
  })
}

/** CMS-authored long-form legal page. No fixed controls cover the text. */
export const LegalView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.legal)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('legal', ctx)
  const route = resolveLocaleRoute(['legal'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  if (!page) {
    return (
      <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.legal} label={t.breadcrumb}>
        <ContentContainer>
          <EmptyState body={t.missingContentBody} locale={locale} title={t.missingContentTitle} />
        </ContentContainer>
      </InteriorPage>
    )
  }
  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.legal} label={t.breadcrumb} switchDoc={{ id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.legal }}>
      <ContentContainer>
        <h1 className="type-title">{page.title}</h1>
        <div className="mt-8 max-w-[72ch] space-y-6">
          {page.hero?.richText ? <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} /> : null}
        </div>
      </ContentContainer>
      {page.layout && page.layout.length > 0 ? <Blocks blocks={page.layout} context={ctx} /> : null}
    </InteriorPage>
  )
}
