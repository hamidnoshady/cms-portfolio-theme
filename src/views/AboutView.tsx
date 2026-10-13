import type { Metadata } from 'next'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { FramedMedia } from '@/components/media/CmsImage'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { EmptyState } from '@/components/states/States'
import { getArchive, getSectionPage, localizedPostHref } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { formatNumber } from '@/lib/runtime'
import { collectMedia } from '@/lib/utils/lexical'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import type { Locale } from '@/lib/cms/types'
import type { Media } from '@/lib/cms/types'
import { documentLanguages } from '@/lib/seo/translations'

/**
 * About — sparse by design: breadcrumbs, a modest title, one short introduction, one
 * small studio image (~42% of desktop content width) with its inset frame, one discreet
 * contact link, and a lot of white space.
 *
 * CMS blocks are still rendered *after* that composition when the page really has them —
 * the sparse default never deletes a customer's content to look like a sample.
 */
export const aboutMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('about', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page
      ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.about })
      : undefined,
    path: THEME_ROUTES.about,
    title: page?.title ?? dictionary(locale).about,
  })
}

export const AboutView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('about', ctx)
  const route = resolveLocaleRoute(['about'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)

  if (!page) {
    return (
      <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.about} label={t.breadcrumb}>
        <ContentContainer>
          <EmptyState locale={locale} />
        </ContentContainer>
      </InteriorPage>
    )
  }

  // Selected work: the three newest projects, from the same archive the Projects page
  // reads. Nothing is invented — no projects, no section.
  const work = await getArchive(ctx, { limit: 3, section: 'projects' })
  const projectsHref = href(THEME_ROUTES.projects, locale, ctx.site)
  const contactHref = href(THEME_ROUTES.contact, locale, ctx.site)

  const heroMedia = isMedia(page.hero?.media) ? page.hero.media : null
  const inlineMedia = (collectMedia(page.hero?.richText as never)[0] ?? null) as Media | null
  const image = heroMedia ?? inlineMedia

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={THEME_ROUTES.about}
      label={t.breadcrumb}
     
      switchDoc={{ id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.about }}
    >
      <ContentContainer>
        <div className="relative">
          <DecorativeMark className="top-2 -start-1 hidden md:block" variant="offset-l" />
          <h1 className="type-title max-w-[24ch] ps-4 md:ps-6">{page.title}</h1>
        </div>
        <Rule className="my-10" />

        <div className="about-composition">
          <div className="min-w-0">
            {page.hero?.richText ? (
              <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
            ) : (
              <p className="type-lede">
                {page.meta?.description ?? ''}
              </p>
            )}
          </div>

          <div className="relative">
            {image ? (
              <FramedMedia
                cap={70}
                media={image}
                origin={ctx.site.media.origin}
                size="wide"
                sizes="(min-width: 1024px) 42vw, 100vw"
              />
            ) : (
              <span aria-hidden="true" className="skeleton block" style={{ aspectRatio: '4 / 5' }} />
            )}
          </div>
        </div>

        {work.docs.length > 0 ? (
          <section aria-labelledby="about-work" className="mt-20">
            <Rule className="mb-8" />
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="type-heading" id="about-work">
                {t.selectedWork}
                {/* The count describes the cards below: “3 of 12” when the grid is a
                    selection from a larger archive, the plain number when it is all of it. */}
                <span className="type-meta ms-3">
                  {work.totalDocs > work.docs.length
                    ? t.selectedWorkShown(work.docs.length, work.totalDocs)
                    : formatNumber(work.docs.length, locale)}
                </span>
              </h2>
              <a className="link-inline type-ui target-standalone" href={projectsHref}>
                {t.allProjects}
              </a>
            </div>
            <div className="about-work">
              {await Promise.all(
                work.docs.map(async (post) => (
                  <ProjectCard
                    context={ctx}
                    href={await localizedPostHref(post, ctx)}
                    key={post.id}
                    post={post}
                  />
                )),
              )}
            </div>
          </section>
        ) : null}

        {/* The page ends on one large line rather than a small link: the next step is
            the point of the page. The arrow follows the reading direction. */}
        <p className="mt-20">
          <a className="about-talk target-standalone" href={contactHref}>
            {t.startConversation}
            <span aria-hidden="true" className="about-talk__arrow">
              {locale === 'fa' ? '←' : '→'}
            </span>
          </a>
        </p>
      </ContentContainer>

      {page.layout && page.layout.length > 0 ? <Blocks blocks={page.layout} context={ctx} /> : null}
    </InteriorPage>
  )
}
