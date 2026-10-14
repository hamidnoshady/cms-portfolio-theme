import type { Metadata } from 'next'

import { Blocks } from '@/components/blocks/Blocks'
import { RichText } from '@/components/blocks/RichText'
import { Rule } from '@/components/design/Rule'
import { CmsForm } from '@/components/forms/CmsForm'
import { EmptyState } from '@/components/states/States'
import { getSectionPage } from '@/lib/cms/content'
import { getFormById } from '@/lib/cms/endpoints'
import { loadPageContext } from '@/lib/cms/pageContext'
import type { BlockRow, Locale } from '@/lib/cms/types'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { resolveLocaleRoute } from '@/lib/routing/resolve'
import { metadataFor } from '@/lib/seo/metadata'
import { documentLanguages } from '@/lib/seo/translations'
import { labels as dictionary } from '@/lib/theme/labels'
import { isMedia } from '@/lib/utils/media'
import { InteriorPage } from '@/views/InteriorPage'
import { StateView } from '@/views/StateView'

export const careersMetadata = async (locale: Locale): Promise<Metadata> => {
  const outcome = await loadPageContext(locale, THEME_ROUTES.careers)
  if (!outcome.ok) return { robots: { follow: false, index: false } }
  const { page } = await getSectionPage('careers', outcome.ctx)
  return metadataFor({
    context: outcome.ctx,
    description: page?.meta?.description ?? null,
    image: page && isMedia(page.meta?.image) ? page.meta.image : null,
    languages: page
      ? await documentLanguages(outcome.ctx, { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.careers })
      : undefined,
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
    (formBlock && typeof formBlock.form === 'string'
      ? formBlock.form
      : (formBlock?.form as { id?: string } | null)?.id) ??
    formBinding?.id ??
    null
  const form = formId ? await getFormById(formId, locale, ctx.draft) : null
  const otherBlocks = blockRows.filter((row) => row.blockType !== 'formBlock')
  const pageTitle = page?.title ?? t.careers

  return (
    <InteriorPage
      context={ctx}
      crumbs={crumbs}
      currentPath={THEME_ROUTES.careers}
      label={t.breadcrumb}
      switchDoc={page ? { id: page.id, kind: 'page', pathFor: () => THEME_ROUTES.careers } : undefined}
    >
      <section className="bang-contact">
        <div className="bang-contact__panel">
          <header className="bang-contact__head">
            <h1 className="bang-contact__title" dir="auto">{pageTitle}</h1>
            <Rule className="mt-4 max-w-[5rem]" />
            {page?.hero?.richText ? (
              <div className="bang-contact__intro prose mt-5">
                <RichText anchorScope="hero" content={page.hero.richText} context={ctx} fallbackDir={ctx.dir} />
              </div>
            ) : null}
          </header>

          <div className="bang-contact__form">
            {form ? (
              <CmsForm form={form} locale={locale} />
            ) : (
              <EmptyState body={t.careersFormMissingBody} locale={locale} title={t.careersFormMissingTitle} />
            )}
          </div>
        </div>
      </section>

      {otherBlocks.length > 0 ? <Blocks blocks={otherBlocks} context={ctx} pageTitle={pageTitle} /> : null}
    </InteriorPage>
  )
}
