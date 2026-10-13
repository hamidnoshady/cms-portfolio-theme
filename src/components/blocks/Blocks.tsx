import Link from 'next/link'
import type { ReactNode } from 'react'

import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark, type MarkVariant } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { Type } from '@/components/design/Type'
import { CopyButton } from '@/components/contact/CopyButton'
import { MapFrame } from '@/components/contact/MapFrame'
import { CmsForm } from '@/components/forms/CmsForm'
import { CmsImage, FramedMedia } from '@/components/media/CmsImage'
import { Gallery, galleryColumns, type GalleryItem } from '@/components/media/Gallery'
import { LightboxScope } from '@/components/media/Lightbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import type { SiteContext } from '@/lib/cms/context'
import { getFormById, getPosts, getPostsByIds } from '@/lib/cms/endpoints'
import type { BlockRow, CmsLink, FormDoc, Media, PostDoc } from '@/lib/cms/types'
import { centerFromFields, parseCenter, mapSource } from '@/lib/maps/mapSource'
import { formatNumber, toLocaleDigits } from '@/lib/runtime'
import { localizedPostHref } from '@/lib/cms/content'
import { resolveCmsLink, type LinkInput, type ResolvedLink } from '@/lib/routing/links'
import { cn } from '@/lib/utils/cn'
import { dateText } from '@/lib/utils/dates'
import { isMedia, lightboxItem, mediaPresentation, mediaUrl } from '@/lib/utils/media'
import { lightboxItems } from '@/lib/utils/lexical'
import { labels as dictionary } from '@/lib/theme/labels'
import { TeamBiography } from '@/components/portfolio/TeamBiography'
import { toTeamMember } from '@/domain/portfolio'
import { warnUnknown } from './node'
import { RichText } from './RichText'

/**
 * Page-layout block registry.
 *
 * Rules applied to every block:
 * - The page renders only blocks the **site's own allowlist** permits; anything else
 *   is skipped with a diagnostic (`warnUnknown`), never a crash.
 * - Block order and ids come from the CMS row order; nothing is re-sorted.
 * - Rich text is rendered through `<RichText>`, which keeps each field's own direction.
 * - No block introduces colour, shadows or rounded surfaces; the palette stays
 *   white/black and the line system carries the structure.
 */

export const Blocks = async ({ blocks, context }: { blocks: BlockRow[] | null | undefined; context: SiteContext }) => {
  const allowed = new Set(context.site.blocks)
  const rows = (blocks ?? []).filter((block) => block?.blockType)

  const rendered: ReactNode[] = []
  for (const [index, block] of rows.entries()) {
    const blockType = block.blockType ?? ''
    if (!allowed.has(blockType)) {
      warnUnknown(`${blockType} (not in the site's block allowlist)`)
      continue
    }
    rendered.push(
      <Block context={context} key={block.id ?? `${blockType}-${index}`} row={block} />,
    )
  }
  return <>{rendered}</>
}

const Block = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  switch (row.blockType) {
    case 'content':
      return <ContentBlock context={context} row={row} />
    case 'mediaBlock':
      return <MediaBlock context={context} row={row} />
    case 'cta':
      return <CtaBlock context={context} row={row} />
    case 'features':
      return <FeaturesBlock row={row} />
    case 'testimonials':
      return <TestimonialsBlock context={context} row={row} />
    case 'faq':
      return <FaqBlock context={context} row={row} />
    case 'contact':
      return <ContactBlock context={context} row={row} />
    case 'formBlock':
      return <FormBlock context={context} row={row} />
    case 'gallery':
      return <GalleryBlock context={context} row={row} />
    case 'team':
      return <TeamBlock context={context} row={row} />
    case 'pricing':
      return <PricingBlock context={context} row={row} />
    case 'logos':
      return <LogosBlock context={context} row={row} />
    case 'archive':
      return <ArchiveBlock context={context} row={row} />
    default:
      // Includes `productGrid`: this theme does not claim store support, so a grid of
      // products is skipped rather than half-rendered.
      warnUnknown(row.blockType ?? 'unknown')
      return null
  }
}

/* --- shared block furniture ---------------------------------------------- */

const intro = (row: BlockRow): { heading: null | string; intro: null | string } => ({
  heading: typeof row.heading === 'string' ? row.heading : null,
  intro: typeof row.intro === 'string' ? row.intro : null,
})

const BlockShell = ({
  children,
  heading,
  introText,
  mark,
  tone = 'default',
}: {
  children: ReactNode
  heading?: null | string
  introText?: null | string
  mark?: MarkVariant
  tone?: 'default' | 'tight'
}) => (
  <ContentContainer as="section" className={cn(tone === 'tight' ? 'section--tight py-10' : 'section')}>
    {heading || introText ? (
      <div className="relative mb-8">
        <DecorativeMark className="top-2 -start-1 hidden md:block" variant={mark ?? 'dash'} />
        {heading ? <Type className="ps-4 md:ps-6" role="heading">{heading}</Type> : null}
        {introText ? <p className="type-body mt-3 max-w-[60ch] ps-4 text-ink-secondary md:ps-6">{introText}</p> : null}
      </div>
    ) : null}
    {children}
  </ContentContainer>
)

/**
 * Anchor scope for a rich-text field inside a block: the row id the CMS assigned
 * (unique within the page and stable across renders), plus the field's place in the
 * row. Without a row id the field falls back to its content hash (see `RichText`).
 */
const rowScope = (row: BlockRow, part = ''): string | undefined =>
  typeof row.id === 'string' && row.id ? `${row.id}${part ? `-${part}` : ''}` : undefined

const asMedia = (value: unknown): Media | null => (isMedia(value as never) ? (value as Media) : null)

/* --- blocks --------------------------------------------------------------- */

/**
 * Column widths are the editor's: each column spans part of a 12-track grid on wide
 * screens and stacks on phones. Written out in full so Tailwind generates every class.
 */
const COLUMN_SPAN: Record<string, string> = {
  full: 'lg:col-span-12',
  half: 'lg:col-span-6',
  oneQuarter: 'lg:col-span-3',
  oneThird: 'lg:col-span-4',
  threeQuarters: 'lg:col-span-9',
  twoThirds: 'lg:col-span-8',
}
const TABLET_SPAN: Record<string, string> = {
  full: 'md:col-span-6',
  half: 'md:col-span-3',
  oneQuarter: 'md:col-span-3',
  oneThird: 'md:col-span-3',
  threeQuarters: 'md:col-span-6',
  twoThirds: 'md:col-span-6',
}

const ContentBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const columns = Array.isArray(row.columns)
    ? (row.columns as { enableLink?: boolean; link?: CmsLink; richText?: unknown; size?: string }[])
    : []
  if (columns.length === 0) return null
  const links = await Promise.all(
    columns.map((column) => (column.enableLink && column.link ? resolveCmsLink(column.link, context) : null)),
  )
  return (
    <BlockShell>
      <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-6 lg:grid-cols-12">
        {columns.map((column, index) => {
          const size = column.size && COLUMN_SPAN[column.size] ? column.size : 'oneThird'
          return (
            <div className={cn('min-w-0', TABLET_SPAN[size], COLUMN_SPAN[size])} key={`column-${index}`}>
              <RichText anchorScope={rowScope(row, `c${index}`)} content={column.richText as never} context={context} fallbackDir={context.dir} />
              {column.link && links[index] ? (
                <CmsLinkAnchor className="link-inline type-ui mt-4 target-standalone" link={links[index]}>
                  {linkLabel(column.link, links[index])}
                </CmsLinkAnchor>
              ) : null}
            </div>
          )
        })}
      </div>
    </BlockShell>
  )
}

/**
 * A standalone photograph is content too, so it opens in the same lightbox as a
 * gallery — a scope of one, with no previous/next controls.
 */
const MediaBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const media = asMedia(row.media)
  if (!media) {
    warnUnknown('mediaBlock with unpopulated media')
    return null
  }
  const { aspect, caption, size } = mediaPresentation(row as Record<string, unknown>)
  const t = dictionary(context.locale)
  const item = lightboxItem(media, context.site.media.origin, t.photo)
  const figure = (
    <FramedMedia
      aspect={aspect}
      cap={size === 'full' ? 82 : 72}
      caption={caption}
      lightbox={item ? 0 : undefined}
      media={media}
      origin={context.site.media.origin}
      size={size}
    />
  )
  return (
    <BlockShell tone="tight">
      {item ? (
        <LightboxScope
          items={[item]}
          labels={{ close: t.close, next: t.next, previous: t.previous, title: t.gallery }}
          locale={context.locale}
        >
          {figure}
        </LightboxScope>
      ) : (
        figure
      )}
    </BlockShell>
  )
}

const CtaBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const entries = Array.isArray(row.links) ? (row.links as Record<string, unknown>[]) : []
  const links = (
    await Promise.all(
      entries.map(async (entry) => {
        const link = entry.link as (LinkInput & Record<string, unknown>) | undefined
        const resolved = link ? await resolveCmsLink(link, context) : null
        // A button whose destination does not resolve is left out rather than shown
        // as a control that goes nowhere.
        return link && resolved ? { link, resolved } : null
      }),
    )
  ).filter((entry): entry is { link: LinkInput & Record<string, unknown>; resolved: ResolvedLink } => Boolean(entry))
  return (
    <BlockShell tone="tight">
      <Rule className="mb-8" />
      <div className="flex flex-col items-start gap-6">
        <RichText anchorScope={rowScope(row)} content={row.richText as never} context={context} fallbackDir={context.dir} />
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {links.map(({ link, resolved }, index) => (
              <Button asChild key={`cta-${index}`} variant={link.appearance === 'outline' ? 'quiet' : 'default'}>
                <CmsLinkAnchor link={resolved}>{linkLabel(link, resolved)}</CmsLinkAnchor>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </BlockShell>
  )
}

const FeaturesBlock = ({ row }: { row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  const columns = typeof row.columns === 'string' ? row.columns : '3'
  return (
    <BlockShell heading={heading} introText={introText} mark="pair">
      <ul className={cn('grid gap-x-8 gap-y-10', columns === '2' ? 'md:grid-cols-2' : columns === '4' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')}>
        {items.map((item, index) => (
          <li className="relative border-t border-line-structural pt-5" key={`feature-${index}`}>
            <DecorativeMark className="top-5 -start-1 hidden md:block" variant="tick" />
            <h3 className="type-subheading ps-3">{String(item.title ?? '')}</h3>
            {item.description ? <p className="type-body mt-2 ps-3 text-ink-secondary">{String(item.description)}</p> : null}
          </li>
        ))}
      </ul>
    </BlockShell>
  )
}

const TestimonialsBlock = ({ row }: { context: SiteContext; row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <ul className="grid gap-10 md:grid-cols-2">
        {items.map((item, index) => (
          <li className="border-t border-line-structural pt-5" key={`quote-${index}`}>
            <blockquote className="type-body-lg">«{String(item.quote ?? '')}»</blockquote>
            {item.author ? (
              <p className="type-meta mt-3">
                {String(item.author)}
                {item.role ? ` — ${String(item.role)}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </BlockShell>
  )
}

const FaqBlock = ({ row }: { context: SiteContext; row: BlockRow }) => {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <Accordion className="border-t border-line-structural" collapsible type="single">
        {items.map((item, index) => (
          <AccordionItem key={`faq-${index}`} value={`faq-${index}`}>
            <AccordionTrigger>{String(item.question ?? '')}</AccordionTrigger>
            <AccordionContent>{String(item.answer ?? '')}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </BlockShell>
  )
}

const ContactBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const { heading, intro: introText } = intro(row)
  const t = dictionary(context.locale)
  const phones = Array.isArray(row.phones) ? row.phones.filter((phone): phone is string => typeof phone === 'string' && phone.trim() !== '') : []
  const email = typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null
  const address = typeof row.address === 'string' && row.address.trim() ? row.address : null
  const hours = typeof row.hours === 'string' && row.hours.trim() ? row.hours : null
  const mapUrl = typeof row.mapUrl === 'string' && /^https:\/\//u.test(row.mapUrl) ? row.mapUrl : null
  const blockCenter = centerFromFields(row.latitude, row.longitude)

  // The map is opt-in per site through runtime settings (provider, public key, centre);
  // with none set it is OpenStreetMap, which is free and needs no key. Coordinates come
  // from the site setting, else the block's own latitude/longitude, else its map link.
  // A block that has no usable coordinates keeps the plain link, as before.
  const settings = context.site.themeRuntime?.settings ?? {}
  const map = mapSource({
    address,
    apiKey: typeof settings.mapApiKey === 'string' ? settings.mapApiKey : null,
    center: parseCenter(settings.mapCenter) ?? blockCenter,
    mapUrl,
    provider: typeof settings.mapProvider === 'string' ? settings.mapProvider : null,
    zoom: typeof settings.mapZoom === 'number' ? settings.mapZoom : null,
  })

  if (!email && phones.length === 0 && !address && !hours && !mapUrl && !blockCenter) {
    // A `contact` block whose CMS fields are all empty is a content problem, not a
    // rendering one — say so rather than leaving a silently blank column.
    warnUnknown('contact block with no address, email, phones, hours, coordinates or map link')
    return null
  }

  const copyLabels = { copied: t.copied, label: t.copy }
  const plain: { label: string; value: ReactNode }[] = []
  if (address) plain.push({ label: t.contact, value: address })
  if (hours) plain.push({ label: t.hours, value: hours })
  if (mapUrl && !map) {
    plain.push({
      label: t.map,
      value: (
        <a className="link-inline target-standalone" href={mapUrl} rel="noreferrer" target="_blank">
          {t.map}
        </a>
      ),
    })
  }

  return (
    <BlockShell heading={heading} introText={introText} mark="offset-l">
      {/* Email and phone are why most visitors come: set large, one per row, with a
          copy control beside the link. Numbers keep their own left-to-right order. */}
      {email || phones.length > 0 ? (
        <dl className="reach">
          {email ? (
            <div className="reach__row">
              <dt className="type-label">{t.email}</dt>
              <dd className="reach__value">
                <a className="reach__link target-standalone" dir="ltr" href={`mailto:${email}`}>
                  {email}
                </a>
                <CopyButton copiedLabel={copyLabels.copied} label={copyLabels.label} value={email} />
              </dd>
            </div>
          ) : null}
          {phones.map((phone) => (
            <div className="reach__row" key={phone}>
              <dt className="type-label">{t.phone}</dt>
              <dd className="reach__value">
                <a className="reach__link target-standalone" dir="ltr" href={`tel:${phone.replace(/\s+/gu, '')}`}>
                  {toLocaleDigits(phone, context.locale)}
                </a>
                <CopyButton copiedLabel={copyLabels.copied} label={copyLabels.label} value={phone.replace(/\s+/gu, '')} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {plain.length > 0 ? (
        <dl className="grid gap-x-10 md:grid-cols-2">
          {plain.map((entry) => (
            <div className="border-t border-line-structural py-4" key={entry.label}>
              <dt className="type-label">{entry.label}</dt>
              <dd className="type-body mt-1">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {map ? (
        <MapFrame
          href={map.href}
          kind={map.kind}
          labels={{ open: t.openMap, show: t.showMap, title: t.map }}
          src={map.src}
        />
      ) : null}
    </BlockShell>
  )
}

const FormBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const formRef = row.form
  const id = typeof formRef === 'string' ? formRef : ((formRef as { id?: string } | null)?.id ?? null)
  if (!id) return null
  const form: FormDoc | null = await getFormById(id, context.locale, context.draft)
  if (!form) {
    warnUnknown('formBlock pointing at a missing form')
    return null
  }
  return (
    <BlockShell tone="tight">
      {row.enableIntro && row.introContent ? (
        <RichText anchorScope={rowScope(row, 'intro')} className="mb-8" content={row.introContent as never} context={context} fallbackDir={context.dir} />
      ) : null}
      <CmsForm className="max-w-[36rem]" form={form} locale={context.locale} />
    </BlockShell>
  )
}

/**
 * A gallery row's medium. The contract documents `images` as populated media
 * (`[<Media>…]`); a Payload *array* field delivers rows instead (`[{ image: <Media> }]`).
 * Both are real shapes a site can send, so both are read — an id-only entry (depth 0)
 * is skipped rather than guessed at.
 */
const galleryMedia = (entry: unknown): Media | null => {
  if (!entry || typeof entry === 'string') return null
  const direct = asMedia(entry)
  if (direct) return direct
  const row = entry as { image?: unknown; media?: unknown }
  return asMedia(row.image) ?? asMedia(row.media)
}

const GalleryBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const images = (Array.isArray(row.images) ? row.images : []).map(galleryMedia).filter((media): media is Media => Boolean(media))
  const { heading, intro: introText } = intro(row)
  const t = dictionary(context.locale)
  const items: GalleryItem[] = lightboxItems(images, context.site.media.origin, t.photoAt)
  if (items.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText} mark="pair">
      <Gallery
        columns={galleryColumns(row.columns)}
        items={items}
        labels={{ close: t.close, next: t.next, previous: t.previous, title: t.gallery }}
        locale={context.locale}
      />
    </BlockShell>
  )
}

const TeamBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const members = Array.isArray(row.members) ? (row.members as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  const t = dictionary(context.locale)
  if (members.length === 0) return null
  return (
    <BlockShell heading={heading ?? t.team} introText={introText}>
      <ul className="grid gap-x-8 gap-y-10 md:grid-cols-3">
        {members.map((raw, index) => {
          const member = toTeamMember(raw, index)
          return (
            <li key={member.id}>
              {member.photo ? (
                <span className="frame mb-4 block" style={{ aspectRatio: '3 / 4' }}>
                  <CmsImage className="frame__media" media={member.photo} origin={context.site.media.origin} sizes="(min-width: 768px) 30vw, 100vw" alt={member.name} />
                </span>
              ) : null}
              <p className="type-subheading">{member.name}</p>
              {member.role ? <p className="type-meta mt-1">{member.role}</p> : null}
              {member.bio ? <p className="type-body mt-2 text-ink-secondary line-clamp-3">{member.bio}</p> : null}
              <div className="mt-3">
                <TeamBiography labels={{ biography: t.biography, close: t.close, open: t.openBiography }} member={member} origin={context.site.media.origin} />
              </div>
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const PricingBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const plans = Array.isArray(row.plans) ? (row.plans as Record<string, unknown>[]) : []
  const { heading, intro: introText } = intro(row)
  if (plans.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText}>
      <ul className="grid gap-8 md:grid-cols-3">
        {plans.map((plan, index) => {
          const price = typeof plan.price === 'number' ? plan.price : null
          const unit = typeof plan.unit === 'string' ? plan.unit : ''
          const features = Array.isArray(plan.features) ? (plan.features as unknown[]).filter((f): f is string => typeof f === 'string') : []
          return (
            <li className={cn('border-t border-line-structural pt-5', plan.featured === true && 'border-t-[1px] border-t-ink')} key={`plan-${index}`}>
              <h3 className="type-subheading">{String(plan.name ?? '')}</h3>
              {price !== null ? (
                <p className="type-body-lg mt-3" dir="auto">
                  {formatNumber(price, context.locale)} {unit}
                </p>
              ) : null}
              {plan.period ? <p className="type-meta mt-1">{String(plan.period)}</p> : null}
              {features.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {features.map((feature) => (
                    <li className="type-body text-ink-secondary" key={feature}>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const LogosBlock = ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const logos = (Array.isArray(row.logos) ? row.logos : []).map((entry) => asMedia(entry)).filter((media): media is Media => Boolean(media))
  const { heading, intro: introText } = intro(row)
  if (logos.length === 0) return null
  return (
    <BlockShell heading={heading} introText={introText} tone="tight">
      <ul className="flex flex-wrap items-center gap-10">
        {logos.map((media) => {
          const src = mediaUrl(media, context.site.media.origin)
          if (!src) return null
          return (
            <li key={String(media.id)}>
              <img alt={media.alt ?? ''} className="h-10 w-auto opacity-80" loading="lazy" src={src} />
            </li>
          )
        })}
      </ul>
    </BlockShell>
  )
}

const ArchiveBlock = async ({ context, row }: { context: SiteContext; row: BlockRow }) => {
  const limit = typeof row.limit === 'number' ? Math.min(Math.max(row.limit, 1), 24) : 6
  const selected = Array.isArray(row.selectedDocs)
    ? (row.selectedDocs as { value?: string }[]).map((entry) => entry.value).filter((id): id is string => Boolean(id))
    : []

  let posts: PostDoc[] = []
  if (row.populateBy === 'selection' && selected.length > 0) {
    posts = await getPostsByIds(selected, context.locale, context.draft)
  } else {
    const categoryIds = Array.isArray(row.categories)
      ? (row.categories as unknown[]).map((entry) => (typeof entry === 'string' ? entry : (entry as { id?: string })?.id)).filter((id): id is string => Boolean(id))
      : []
    const result = await getPosts(
      context.locale,
      { limit, where: categoryIds.length ? { categories: { in: categoryIds } } : {} },
      context.draft,
    )
    posts = result.docs
  }

  const { heading, intro: introText } = intro(row)
  if (posts.length === 0) return null

  return (
    <BlockShell heading={heading} introText={introText}>
      <ul>
        {posts.map((post) => (
          <ArchiveRow context={context} key={post.id} post={post} />
        ))}
      </ul>
    </BlockShell>
  )
}

const ArchiveRow = async ({ context, post }: { context: SiteContext; post: PostDoc }) => {
  const href = await localizedPostHref(post, context)
  return (
    <li className="border-b border-line-structural">
      <Link className="card__link flex items-baseline justify-between gap-6 py-5" href={href}>
        <span className="type-body">{post.title}</span>
        {dateText(post.publishedAt, context.locale) ? (
          <span className="type-meta">{dateText(post.publishedAt, context.locale)}</span>
        ) : null}
      </Link>
    </li>
  )
}

/* --- link helpers (blocks store `link` groups like navigation) ------------ */

const linkLabel = (link: Record<string, unknown>, resolved: ResolvedLink): string =>
  (typeof link.label === 'string' && link.label.trim()) || resolved.href

/** A resolved CMS link: client navigation inside the site, a plain anchor outside it. */
const CmsLinkAnchor = ({
  children,
  className,
  link,
  ...rest
}: {
  children: ReactNode
  className?: string
  link: ResolvedLink
}) => {
  const target = link.newTab ? '_blank' : undefined
  if (link.external) {
    return (
      <a {...rest} className={className} href={link.href} rel="noopener noreferrer" target={target}>
        {children}
      </a>
    )
  }
  return (
    <Link {...rest} className={className} href={link.href} rel={link.newTab ? 'noopener' : undefined} target={target}>
      {children}
    </Link>
  )
}
