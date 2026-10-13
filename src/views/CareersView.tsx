import type { Metadata } from 'next'
import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { ContentContainer } from '@/components/design/Container'
import { CmsForm } from '@/components/forms/CmsForm'
import { EmptyState } from '@/components/states/States'
import { getFormById } from '@/lib/cms/endpoints'
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
import type { BlockRow, Locale } from '@/lib/cms/types'
import { documentLanguages } from '@/lib/seo/translations'

export const careersMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.careers)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('careers', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.careers }) : undefined,
    path: THEME_ROUTES.careers,
    title: page?.title ?? dictionary(locale).careers,
  })
}

export const CareersView = async ({ locale }: { locale: Locale }) => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.careers)
  if (!outcome.ok) return <StateView locale={locale} outcome={outcome} />
  const ctx = outcome.ctx
  const t = dictionary(locale)
  const { page } = await getSectionPage('careers', ctx)
  const route = resolveLocaleRoute(['careers'], locale, ctx.site)
  const crumbs = breadcrumbsFor(route, ctx.site)
  const blockRows: BlockRow[] = page?.layout ?? []
  const formBlock = blockRows.find((row) => row.blockType === 'formBlock')
  const formBinding = ctx.site.themeRuntime?.bindings?.careersForm ?? null
  const formId =
    (formBlock && typeof formBlock.form === 'string' ? formBlock.form : (formBlock?.form as { id?: string } | null)?.id) ??
    formBinding?.id ?? null
  const form = formId ? await getFormById(formId, locale, ctx.draft) : null
  const otherBlocks = blockRows.filter((row) => row.blockType !== 'formBlock')

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={THEME_ROUTES.careers} label={t.breadcrumb} switchDoc={page ? { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.careers } : undefined}>
      <ContentContainer>
        <h1 className="type-title">{page?.title ?? t.careers}</h1>
        {page?.hero?.richText ? (
          <div className="mt-6 max-w-[70ch]">
            <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
          </div>
        ) : null}
        <div className="mt-10 max-w-[40rem]">
          {form ? (
            <CmsForm form={form} locale={locale} />
          ) : (
            <EmptyState body={t.careersFormMissingBody} locale={locale} title={t.careersFormMissingTitle} />
          )}
        </div>
      </ContentContainer>
      {otherBlocks.length > 0 ? <Blocks blocks={otherBlocks} context={ctx} /> : null}
    </InteriorPage>
  )
}
