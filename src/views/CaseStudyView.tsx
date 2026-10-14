import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { CmsForm } from '@/components/forms/CmsForm'
import { CmsImage } from '@/components/media/CmsImage'
import { CaseStudyShell } from '@/components/portfolio/CaseStudyShell'
import { MetadataTable } from '@/components/portfolio/MetadataTable'
import { ShareButton } from '@/components/portfolio/ShareButton'
import { toCaseStudy, type CaseStudy } from '@/domain/portfolio'
import { getPostContext, localizedPostHref } from '@/lib/cms/content'
import { getFormById } from '@/lib/cms/endpoints'
import { loadPageContext } from '@/lib/cms/pageContext'
import type { Locale, ProjectMetadata, SiteDescriptor } from '@/lib/cms/types'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { href } from '@/lib/routing/locale'
import { detailPath, THEME_ROUTES, type PortfolioSection } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { toLocaleDigits } from '@/lib/runtime'
import { metadataFor } from '@/lib/seo/metadata'
import { documentLanguages } from '@/lib/seo/translations'
import { labels as dictionary } from '@/lib/theme/labels'
import { yearOrText } from '@/lib/utils/dates'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'

export const closeHrefForCaseStudy = (
  section: PortfolioSection,
  locale: Locale,
  site: Pick<SiteDescriptor, 'defaultLocale'>,
): string => href(section === 'projects' ? THEME_ROUTES.projects : THEME_ROUTES.objects, locale, site)

const FACT_SYNONYMS: Record<string, string> = {
  area: 'area',
  client: 'client',
  collaborator: 'collaborators',
  collaborators: 'collaborators',
  date: 'date',
  location: 'location',
  status: 'status',
  type: 'status',
  typology: 'status',
  year: 'date',
  تاریخ: 'date',
  سال: 'date',
  مکان: 'location',
  مساحت: 'area',
  وضعیت: 'status',
  گونه: 'status',
  کارفرما: 'client',
  همکاران: 'collaborators',
}

const canonicalFactKey = (label: string): string => {
  const normalized = label.trim().toLowerCase()
  return FACT_SYNONYMS[normalized] ?? normalized
}

export const buildCaseStudyFacts = (
  cs: CaseStudy,
  meta: null | ProjectMetadata | undefined,
  locale: Locale,
): { label: string; value: string }[] => {
  const t = dictionary(locale)
  const out: { label: string; value: string }[] = []
  const seenKeys = new Set<string>()

  const pushFact = (key: string, label: string, rawValue: null | string | undefined) => {
    const value = rawValue?.trim()
    if (!value || seenKeys.has(key)) return
    seenKeys.add(key)
    out.push({ label, value })
  }

  pushFact('location', t.factLocation, cs.location ?? meta?.location)
  pushFact('status', t.factStatus, cs.type ?? meta?.status)
  pushFact('area', t.factArea, meta?.area)
  pushFact('collaborators', t.factCollaborators, cs.collaborators ?? meta?.client)
  const rawYear = yearOrText(cs.year ?? meta?.date, locale)
  pushFact('date', t.factDate, rawYear ? toLocaleDigits(rawYear, locale) : null)

  for (const extra of cs.facts) {
    const key = canonicalFactKey(extra.label)
    pushFact(key, extra.label.trim(), extra.value)
  }

  return out
}

export const caseMetadata = async (
  locale: Locale,
  section: PortfolioSection,
  slug: string,
): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, detailPath(section, slug))
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const data = await getPostContext(slug, outcome.ctx)
  if (!data) return { robots: { follow: false, index: false }, title: undefined }
  const { post } = data
  return metadataFor({
    context: outcome.ctx,
    description: post.meta?.description ?? null,
    image: isMedia(post.meta?.image) ? post.meta.image : isMedia(post.heroImage) ? post.heroImage : null,
    languages: await documentLanguages(outcome.ctx, {
      id: post.id,
      kind: 'post',
      pathFor: (s) => detailPath(section, s),
    }),
    path: detailPath(section, slug),
    title: post.title,
    type: 'article',
  })
}

export const CaseStudyView = async ({
  locale,
  section,
  slug,
  variant = 'page',
}: {
  locale: Locale
  section: PortfolioSection
  slug: string
  variant?: 'overlay' | 'page'
}) => {
  const path = detailPath(section, slug)
  const outcome = await loadPageContext(locale, path)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const data = await getPostContext(slug, ctx)
  if (!data) notFound()
  const { post, related } = data

  if (!ctx.draft && data.section && data.section !== section) {
    redirect(await localizedPostHref(post, ctx))
  }
  if (!ctx.draft && !data.section) notFound()

  const cs = toCaseStudy(post)
  const route = resolveLocaleRoute([section, slug], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site, post.title)
  const hero = isMedia(post.heroImage) ? post.heroImage : null
  const facts = buildCaseStudyFacts(cs, post.projectMetadata, locale)
  const closeHref = closeHrefForCaseStudy(section, locale, ctx.site)
  const contactFormId = ctx.site.themeRuntime?.bindings?.contactForm?.id ?? null
  const contactForm = contactFormId ? await getFormById(contactFormId, locale, ctx.draft) : null
  const shareUrl = `${ctx.canonicalOrigin}${href(path, locale, ctx.site)}`
  const shareLabels = {
    copied: t.copied,
    copyLink: t.copyLink,
    done: t.shareDone,
    failed: t.shareFailed,
    share: t.share,
  }

  const content = (
    <ContentContainer className="bang-case py-10">
      <div className="bang-case__head">
        {variant === 'page' ? (
          <div className="bang-case__bar">
            <ShareButton labels={shareLabels} title={post.title} url={shareUrl} />
            <Link
              className="bang-case__action target-standalone"
              data-cursor="control"
              href={closeHref}
            >
              {t.close}
            </Link>
          </div>
        ) : null}

        <div className="bang-case__marquee" dir="auto">
          <h1 className="bang-case__title" dir="auto">{post.title}</h1>
          <p aria-hidden="true" className="bang-case__repeat" data-marquee>
            <span className="bang-case__marquee-track">
              <span>{post.title} — </span>
              <span>{post.title} — </span>
              <span>{post.title} — </span>
              <span>{post.title} — </span>
            </span>
          </p>
        </div>
      </div>

      {hero ? (
        <div className="bang-case__hero">
          <CmsImage
            alt={post.title}
            media={hero}
            origin={ctx.site.media.origin}
            priority
            ratio="16 / 9"
            sizes="(min-width:1280px) 70vw, 100vw"
          />
        </div>
      ) : null}

      <div className="bang-case__grid">
        <div className="bang-case__meta">
          <MetadataTable facts={facts} />
          <div className="mt-6">
            <Link
              className="bang-case__inquiry target-standalone"
              data-cursor="control"
              href={href(THEME_ROUTES.contact, locale, ctx.site)}
            >
              {t.inquiry}
            </Link>
          </div>
        </div>
        <div className="bang-case__narrative">
          {post.content ? (
            <div className="max-w-[70ch]">
              <RichText anchorScope="content" content={post.content} context={ctx} fallbackDir={ctx.dir} />
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-label={t.relatedWork} className="bang-case__related mt-16">
          <h2 className="type-heading">{t.relatedWork}</h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {await Promise.all(
              related.map(async (r) => (
                <li key={r.id}>
                  <Link
                    className="link-inline type-ui target-standalone"
                    data-cursor="control"
                    href={await localizedPostHref(r, ctx)}
                  >
                    {r.title}
                  </Link>
                </li>
              )),
            )}
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
  )

  if (variant === 'overlay') {
    return (
      <CaseStudyShell
        closeLabel={t.close}
        dir={ctx.dir}
        labels={shareLabels}
        shareUrl={shareUrl}
        title={post.title}
      >
        {content}
      </CaseStudyShell>
    )
  }

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={path}
      label={t.breadcrumb}
      switchDoc={{ id: post.id, kind: 'post', pathFor: (s) => detailPath(section, s) }}
    >
      {content}
    </InteriorPage>
  )
}
