import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { FramedMedia } from '@/components/media/CmsImage'
import { getPageBySlug } from '@/lib/cms/endpoints'
import { loadPageContext } from '@/lib/cms/pageContext'
import { pagePath } from '@/lib/runtime'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'
import { documentLanguages } from '@/lib/seo/translations'

/**
 * Generic CMS page (the catch-all). One canonical URL per document: a page whose slug
 * is a theme section (`about`, `contact`, `projects`…) is served by that section's
 * route, so reaching it through its own slug would be a second URL for the same
 * content — the route layer redirects those before this view runs.
 */
export const pageMetadata = async (locale: Locale, slug: string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, pagePath(slug))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const page = await getPageBySlug(slug, locale, outcome.ctx.draft)
  if (!page) return { robots: { follow: false, index: false } }
  return metadataFor({
    context: outcome.ctx,
    description: page.meta?.description ?? null,
    image: isMedia(page.meta?.image) ? page.meta.image : null,
    languages: await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: pagePath }),
    path: pagePath(page.slug),
    title: page.title,
  })
}

export const PageView = async ({ locale, slug }: { locale: Locale; slug: string }) => {
  const outcome = await loadPageContext(locale, pagePath(slug))
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const page = await getPageBySlug(slug, locale, ctx.draft)
  if (!page) notFound()
  const t = dictionary(locale)

  const heroMedia = isMedia(page.hero?.media) ? page.hero.media : null
  const route = resolveLocaleRoute([slug], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, page.title)
  const showHero = page.hero?.type !== 'none' && page.hero?.type !== 'lowImpact'

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={pagePath(page.slug)}
      label={t.breadcrumb}
     
      switchDoc={{ id: page.id, kind: 'page', pathFor: pagePath }}
    >
      <ContentContainer>
        <h1 className="type-title max-w-[30ch]">{page.title}</h1>
        {page.hero?.richText ? (
          <div className="mt-6">
            <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
          </div>
        ) : null}
        {showHero && heroMedia ? (
          <FramedMedia cap={76} className="mt-10" media={heroMedia} origin={ctx.site.media.origin} priority size="wide" />
        ) : null}
      </ContentContainer>
      <Blocks blocks={page.layout} context={ctx} />
    </InteriorPage>
  )
}
