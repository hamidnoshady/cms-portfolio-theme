import Link from 'next/link'
import type { Metadata } from 'next'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { Rule } from '@/components/design/Rule'
import { FramedMedia } from '@/components/media/CmsImage'
import { TeamBiography } from '@/components/portfolio/TeamBiography'
import { EmptyState } from '@/components/states/States'
import { toTeamMember, type TeamMember } from '@/domain/portfolio'
import { getSectionPage } from '@/lib/cms/content'
import { loadPageContext } from '@/lib/cms/pageContext'
import type { BlockRow, Locale, Media } from '@/lib/cms/types'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { pagePath } from '@/lib/runtime'
import { metadataFor } from '@/lib/seo/metadata'
import { documentLanguages } from '@/lib/seo/translations'
import { brandName } from '@/lib/theme/brand'
import { labels as dictionary } from '@/lib/theme/labels'
import { collectMedia } from '@/lib/utils/lexical'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'

const extractTeamFromLayout = (
  blocks: BlockRow[] | null | undefined,
): { otherBlocks: BlockRow[]; teamHeading: null | string; teamMembers: TeamMember[] } => {
  if (!blocks || blocks.length === 0) {
    return { otherBlocks: [], teamHeading: null, teamMembers: [] }
  }
  const teamMembers: TeamMember[] = []
  const otherBlocks: BlockRow[] = []
  let teamHeading: null | string = null

  for (const block of blocks) {
    if (block.blockType === 'team' || block.blockType === 'people') {
      const rawMembers = ((block as { members?: unknown[]; items?: unknown[] }).members ??
        (block as { items?: unknown[] }).items ??
        []) as Record<string, unknown>[]
      if (!teamHeading && typeof block.heading === 'string' && block.heading.trim()) {
        teamHeading = block.heading.trim()
      }
      for (const [idx, m] of rawMembers.entries()) {
        teamMembers.push(toTeamMember(m, idx))
      }
    } else {
      otherBlocks.push(block)
    }
  }

  return { otherBlocks, teamHeading, teamMembers }
}

const pickPrimaryAboutMedia = (
  heroMedia: unknown,
  heroRichText: unknown,
  blocks: BlockRow[] | null | undefined,
): null | Media => {
  if (isMedia(heroMedia as never)) return heroMedia as Media
  const fromHeroLexical = collectMedia(heroRichText as never).find(isMedia)
  if (fromHeroLexical) return fromHeroLexical
  for (const block of blocks ?? []) {
    if (block.blockType === 'mediaBlock' && isMedia(block.media as never)) {
      return block.media as Media
    }
    if (block.blockType === 'content' && Array.isArray(block.columns)) {
      for (const col of block.columns as { richText?: unknown }[]) {
        const found = collectMedia(col.richText as never).find(isMedia)
        if (found) return found
      }
    }
  }
  return null
}

export const aboutMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('about', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page
      ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: pagePath })
      : undefined,
    path: THEME_ROUTES.about,
    title: page?.meta?.title ?? page?.title ?? dictionary(locale).about,
  })
}

export const AboutView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.about)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('about', ctx)
  const route = resolveLocaleRoute(['about'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, page?.title)

  if (!page) {
    return (
      <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.about} label={t.breadcrumb}>
        <ContentContainer className="py-16">
          <h1 className="type-title mb-6">{t.about}</h1>
          <EmptyState locale={locale} />
        </ContentContainer>
      </InteriorPage>
    )
  }

  const brand = brandName(ctx.site)
  const primaryMedia = pickPrimaryAboutMedia(page.hero?.media, page.hero?.richText, page.layout)
  const { otherBlocks, teamHeading, teamMembers } = extractTeamFromLayout(page.layout)

  const filteredBlocks = primaryMedia
    ? otherBlocks.filter(
        (b, idx) =>
          !(idx === 0 && b.blockType === 'mediaBlock' && isMedia(b.media as never) && (b.media as Media).id === primaryMedia.id),
      )
    : otherBlocks

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={THEME_ROUTES.about}
      label={t.breadcrumb}
      switchDoc={{ id: page.id, kind: 'page', pathFor: pagePath }}
    >
      <section className="bang-about">
        <div className="bang-about__stage">
          <div className="bang-about__rail">
            <header className="bang-about__header">
              <h1 className="bang-about__title" dir="auto">{page.title}</h1>
              <Rule className="mt-4 max-w-[6rem]" />
            </header>

            {page.hero?.richText ? (
              <div className="bang-about__intro prose">
                <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
              </div>
            ) : null}

            {teamMembers.length > 0 ? (
              <div className="bang-about__team">
                <TeamBiography
                  closeLabel={t.close}
                  dir={ctx.dir}
                  heading={teamHeading ?? t.team}
                  members={teamMembers}
                  origin={ctx.site.media.origin}
                />
              </div>
            ) : null}

            <div className="bang-about__cta">
              <Link
                className="link-inline type-ui target-standalone"
                data-cursor="control"
                href={href(THEME_ROUTES.contact, locale, ctx.site)}
              >
                {t.startConversation}
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="bang-about__identity">
            <span>{brand}</span>
          </div>

          {primaryMedia ? (
            <div className="bang-about__media">
              <FramedMedia
                cap={72}
                caption={page.title}
                media={primaryMedia}
                origin={ctx.site.media.origin}
                priority
                size="wide"
                sizes="(min-width: 1024px) 44vw, 94vw"
              />
            </div>
          ) : null}
        </div>
      </section>

      {filteredBlocks.length > 0 ? (
        <div className="pb-16">
          <Blocks blocks={filteredBlocks} context={ctx} pageTitle={page.title} />
        </div>
      ) : null}
    </InteriorPage>
  )
}
