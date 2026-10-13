import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import { cmsEnv, cmsFetchOptional } from '@/lib/cms/client'
import type { Locale, PageDoc, PostDoc } from '@/lib/cms/types'
import { href } from '@/lib/routing/locale'
import { absoluteUrl, hreflangFor } from '@/lib/seo/metadata'

/**
 * Translation presence, asked of the CMS instead of guessed.
 *
 * A document is "translated" in a locale when the localized `title` is non-empty at
 * `fallbackLocale=false` — existence alone is not enough, because Payload returns the
 * document with empty localized fields when a translation is missing. Sitemap
 * entries, `hreflang` and the language switch all consume this single answer, so a
 * missing translation can never be advertised as a URL.
 */

export type DocKind = 'page' | 'post'

/**
 * A document the language switch can point at, described without any locale: its
 * stable id, and how a **locale-neutral** path is built from the slug the document
 * has *in the destination locale* (slugs are localized, so the current page's slug is
 * not the English page's slug). The locale prefix is applied once, by `href`, here —
 * a caller that pre-prefixed its path produced `/en/en/services`.
 */
export type TranslatedDoc = { id: string; kind: DocKind; pathFor: (slug: string) => string }

type LocalizedFacts = { slug: null | string; title: string }

const factsAt = async (kind: DocKind, id: string, locale: Locale, draft: boolean): Promise<LocalizedFacts | null> => {
  const env = cmsEnv()
  const path = kind === 'page' ? `/api/pages/${encodeURIComponent(id)}` : `/api/posts/${encodeURIComponent(id)}`
  const doc = await cmsFetchOptional<PageDoc | PostDoc>(path, {
    draft,
    locale,
    params: { depth: 0, select: { _status: true, slug: true, title: true } },
    revalidate: 300,
    tags: [`cms:${env.tenantKey}:${kind === 'page' ? 'pages' : 'posts'}:${locale}`],
  })
  if (!doc) return null
  // A site key can read drafts; a public switch must not advertise an unpublished one.
  if (!draft && (doc as { _status?: string })._status === 'draft') return null
  const title = doc.title
  if (typeof title !== 'string' || title.trim().length === 0) return null
  const slug = typeof doc.slug === 'string' && doc.slug.trim() ? doc.slug : null
  return { slug, title }
}

/**
 * The locale-neutral path of a document in `locale`, or `null` when it has no
 * published translation there (or the translation has no slug yet). Callers add the
 * locale prefix with `href` — exactly once.
 */
export const translatedDocumentPath = async (
  ctx: SiteContext,
  doc: TranslatedDoc,
  locale: Locale,
): Promise<null | string> => {
  const facts = await factsAt(doc.kind, doc.id, locale, ctx.draft)
  if (!facts?.slug) return null
  return doc.pathFor(facts.slug)
}

export const translatedInLocales = async (
  ctx: SiteContext,
  kind: DocKind,
  id: string,
): Promise<Locale[]> => {
  const results = await Promise.all(
    ctx.site.availableLocales.map(async (locale) => ({
      facts: await factsAt(kind, id, locale, ctx.draft),
      locale,
    })),
  )
  return results.filter((entry) => entry.facts).map((entry) => entry.locale)
}

/**
 * One entry per available locale, the current one included: the data layer answers
 * "where does this document live in each language", and `LanguageSwitch` decides
 * what to show (only the *other* language, never the one being read).
 */
export type SwitchTarget = { href: null | string; label: string; locale: Locale }

const localeLabel = (locale: Locale): string => (locale === 'fa' ? 'فارسی' : 'English')

/**
 * Language-switch targets for a document. A locale where the document does not exist
 * yields `href: null` (rendered as non-interactive text), never a link to the home
 * page dressed up as a translation.
 */
export const switchTargets = async (ctx: SiteContext, doc: TranslatedDoc): Promise<SwitchTarget[]> =>
  Promise.all(
    ctx.site.availableLocales.map(async (locale) => {
      const path = await translatedDocumentPath(ctx, doc, locale)
      return { href: path ? href(path, locale, ctx.site) : null, label: localeLabel(locale), locale }
    }),
  )

/**
 * `hreflang` alternates for a document: one absolute URL per locale where it has a
 * published translation, each built from that locale's own slug. Consumed by
 * `metadataFor` (which only emits the map when there is more than one language).
 */
export const documentLanguages = async (ctx: SiteContext, doc: TranslatedDoc): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    ctx.site.availableLocales.map(async (locale) => [locale, await translatedDocumentPath(ctx, doc, locale)] as const),
  )
  return Object.fromEntries(
    entries.flatMap(([locale, path]) => (path ? [[hreflangFor(locale), absoluteUrl(ctx, path, locale)]] : [])),
  )
}

/** Fallback used by the chrome when the current view has no document (archives). */
export const switchTargetsForPath = (
  ctx: SiteContext,
  pathForLocale: (locale: Locale) => string,
  query = '',
): SwitchTarget[] =>
  ctx.site.availableLocales.map((locale) => ({
    // A query is carried over only when it is locale-neutral — the search term is free
    // text in whatever the visitor typed, while a category slug belongs to one locale
    // and pointing another locale at it would filter by a slug that does not exist there.
    href: href(`${pathForLocale(locale)}${query}`, locale, ctx.site),
    label: localeLabel(locale),
    locale,
  }))
