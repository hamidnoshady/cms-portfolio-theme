import Link from 'next/link'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { CmsImage } from '@/components/media/CmsImage'
import type { SiteContext } from '@/lib/cms/context'
import type { PostDoc } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { monthYearOrText, yearOrText } from '@/lib/utils/dates'
import { isMedia } from '@/lib/utils/media'

/**
 * Project card.
 *
 * - Every card has the **same frame** (4:5): photographs of different sizes and
 *   orientations are cropped to it (around the editor's focal point when one is set),
 *   so a row of cards reads as one calm line instead of a ragged skyline. The project
 *   page shows each photograph whole.
 * - The caption is a drawing's title block: a hairline, the title with the year at the
 *   far end, the location beneath. On hover or focus a solid line draws across the
 *   hairline from the start, and the photograph settles in.
 * - Two cards per row on mobile by design (`grid-projects`); every card in a row is
 *   top-aligned, so the frames line up at every width.
 * - Only real data is shown: the location and year when the CMS has them.
 */
export const ProjectCard = ({
  context,
  href,
  post,
}: {
  context: SiteContext
  href: string
  post: PostDoc
}) => {
  const media = isMedia(post.heroImage) ? post.heroImage : null
  const location = post.projectMetadata?.location?.trim() || null
  const year = yearOrText(post.projectMetadata?.date, context.locale)

  return (
    <article className="pcard group">
      <Link className="pcard__link" href={href}>
        <span className="frame pcard__frame">
          <CmsImage
            className="frame__media transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            media={media}
            origin={context.site.media.origin}
            ratio="4 / 5"
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw"
          />
          <DecorativeMark className="bottom-2 end-2 hidden md:block" variant="dash" />
        </span>
        <span className="pcard__caption">
          <span className="pcard__title">{post.title}</span>
          {year ? <span className="pcard__year">{year}</span> : null}
          {location ? <span className="pcard__place">{location}</span> : null}
        </span>
      </Link>
    </article>
  )
}

/** The pairs a project's facts block shows — exactly the non-empty CMS fields, in contract order. */
export const projectFactPairs = (post: PostDoc, locale: SiteContext['locale']): { label: string; value: string }[] => {
  const facts = post.projectMetadata
  if (!facts) return []
  const fa = locale === 'fa'
  const pairs: { label: string; value: string }[] = []
  if (facts.location?.trim()) pairs.push({ label: fa ? 'مکان' : 'Location', value: facts.location.trim() })
  const date = monthYearOrText(facts.date, locale)
  if (date) pairs.push({ label: fa ? 'تاریخ' : 'Date', value: date })
  if (facts.area?.trim()) pairs.push({ label: fa ? 'مساحت' : 'Area', value: facts.area.trim() })
  if (facts.status?.trim()) pairs.push({ label: fa ? 'وضعیت' : 'Status', value: facts.status.trim() })
  if (facts.client?.trim()) pairs.push({ label: fa ? 'کارفرما' : 'Client', value: facts.client.trim() })
  for (const extra of facts.additionalFacts ?? []) {
    if (extra?.label?.trim() && extra.value?.trim()) pairs.push({ label: extra.label.trim(), value: extra.value.trim() })
  }
  return pairs
}

/**
 * The facts block on a project detail page — real fields only, and not a table.
 *
 * A compact drafting-style block (`.facts`): one thin top rule, a tiny tick before
 * each label, the value set closely beside its label, two columns where the width
 * allows and one on narrow phones, capped around 900px so a label is never a
 * screen-width away from its value on a wide display. No cards, no fills, no grid of
 * borders — spacing and type carry the hierarchy.
 */
export const ProjectFacts = ({ className, context, post }: { className?: string; context: SiteContext; post: PostDoc }) => {
  const pairs = projectFactPairs(post, context.locale)
  if (pairs.length === 0) return null
  const title = context.locale === 'fa' ? 'مشخصات پروژه' : 'Project facts'

  return (
    <section aria-label={title} className={cn('facts', className)}>
      <dl className="facts__list">
        {pairs.map((pair) => (
          <div className="facts__item" key={`${pair.label}-${pair.value}`}>
            <dt className="facts__label">{pair.label}</dt>
            <dd className="facts__value" dir={/\p{L}/u.test(pair.value) ? 'auto' : context.dir}>
              {pair.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
