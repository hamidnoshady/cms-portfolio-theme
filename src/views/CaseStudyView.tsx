import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { CmsImage } from '@/components/media/CmsImage'
import { Gallery } from '@/components/media/Gallery'
import { MetadataTable } from '@/components/portfolio/MetadataTable'
import { ShareButton } from '@/components/portfolio/ShareButton'
import { CmsForm } from '@/components/forms/CmsForm'
import { loadPageContext } from '@/lib/cms/pageContext'
import { getPostContext, localizedPostHref } from '@/lib/cms/content'
import { getFormById } from '@/lib/cms/endpoints'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { detailPath, type PortfolioSection } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { labels as dictionary } from '@/lib/theme/labels'
import { toCaseStudy } from '@/domain/portfolio'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'
import { documentLanguages } from '@/lib/seo/translations'
import type { Locale } from '@/lib/cms/types'
import { collectMedia } from '@/lib/utils/lexical'
import { isMedia, lightboxItem } from '@/lib/utils/media'

export const caseMetadata = async (locale: Locale, section: PortfolioSection, slug: string): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, detailPath(section, slug))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const data = await getPostContext(slug, outcome.ctx)
  if (!data) return { robots: { follow: false, index: false }, title: undefined }
  const { post } = data
  return metadataFor({
    context: outcome.ctx,
    description: post.meta?.description ?? null,
    image: isMedia(post.meta?.image) ? post.meta.image : isMedia(post.heroImage) ? post.heroImage : null,
    languages: await documentLanguages(outcome.ctx, { id: post.id, kind: 'post', pathFor: (s) => detailPath(section, s) }),
    path: detailPath(section, slug),
    title: post.title,
    type: 'article',
  })
}

export const CaseStudyView = async ({ locale, section, slug }: { locale: Locale; section: PortfolioSection; slug: string }) => {
  const path = detailPath(section, slug)
  const outcome = await loadPageContext(locale, path)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const data = await getPostContext(slug, ctx)
  if (!data) notFound()
  const { post, related } = data
  // Section membership: wrong section redirects to canonical; orphan 404s.
  if (!ctx.draft && data.section && data.section !== section) {
    redirect(await localizedPostHref(post, ctx))
  }
  if (!ctx.draft && !data.section) notFound()

  const cs = toCaseStudy(post)
  const route = resolveLocaleRoute([section, slug], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, post.title)
  const hero = isMedia(post.heroImage) ? post.heroImage : null
  const galleryMedia = collectMedia(post.content as never).filter(isMedia)
  const galleryItems = galleryMedia
    .map((m, i) => lightboxItem(m, ctx.site.media.origin, `${t.photo} ${i + 1}`))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const yearRow = cs.year ? [{ label: 'Year', value: cs.year }] : []
  const baseFacts = [
    ...(cs.location ? [{ label: 'Location', value: cs.location }] : []),
    ...(cs.type ? [{ label: 'Type', value: cs.type }] : []),
    ...(cs.collaborators ? [{ label: 'Collaborators', value: cs.collaborators }] : []),
    ...yearRow,
    ...cs.facts,
  ]
  const contactFormId = ctx.site.themeRuntime?.bindings?.contactForm?.id ?? null
  const contactForm = contactFormId ? await getFormById(contactFormId, locale, ctx.draft) : null
  const shareUrl = `${ctx.canonicalOrigin}${path}`

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={path}
      label={t.breadcrumb}
      switchDoc={{ id: post.id, kind: 'post', pathFor: (s) => detailPath(section, s) }}
    >
      <ContentContainer>
        <h1 className="bang-case__title">{post.title}</h1>
        <p aria-hidden="true" className="bang-case__repeat">{post.title} — {post.title}</p>
        <MetadataTable facts={baseFacts} />
        {hero ? (
          <CmsImage media={hero} origin={ctx.site.media.origin} priority ratio="16 / 9" sizes="(min-width:1280px) 70vw, 100vw" alt={post.title} />
        ) : null}
        {post.content ? (
          <div className="mt-10 max-w-[70ch]">
            <RichText anchorScope="content" content={post.content} context={ctx} fallbackDir={ctx.dir} />
          </div>
        ) : null}
        {galleryItems.length > 0 ? (
          <section aria-label={t.gallery} className="mt-12">
            <Gallery items={galleryItems} locale={locale} labels={{ close: t.close, next: t.next, previous: t.previous, title: t.gallery }} />
          </section>
        ) : null}
        <div className="mt-12 flex flex-wrap gap-4">
          <ShareButton labels={{ copied: t.copied, copyLink: t.copyLink, done: t.shareDone, failed: t.shareFailed, share: t.share }} title={post.title} url={shareUrl} />
          <Link className="bang-btn" href={`/${locale === ctx.site.defaultLocale ? '' : locale + '/'}contact`.replace('//', '/')}>{t.inquiry}</Link>
          <Link className="bang-btn bang-btn--ghost" href={section === 'projects' ? '/projects' : '/objects'}>{t.close}</Link>
        </div>
        {related.length > 0 ? (
          <section aria-label={t.relatedWork} className="mt-16">
            <h2 className="type-heading">{t.relatedWork}</h2>
            <ul className="mt-6 grid gap-6 md:grid-cols-3">
              {await Promise.all(related.map(async (r) => (
                <li key={r.id}>
                  <Link className="link-inline type-ui target-standalone" href={await localizedPostHref(r, ctx)}>{r.title}</Link>
                </li>
              )))}
            </ul>
          </section>
        ) : null}
        {contactForm ? (
          <section aria-label={t.contact} className="mt-16 max-w-[40rem]">
            <h2 className="type-heading">{t.inquiry}</h2>
            <CmsForm form={contactForm} locale={locale} />
          </section>
        ) : null}
      </ContentContainer>
    </InteriorPage>
  )
}
