import { DecorativeMark } from '@/components/design/DecorativeMark'
import { LightboxScope, LightboxTrigger, type LightboxLabels } from '@/components/media/Lightbox'
import type { Locale } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { frameRatioFor, type LightboxItem } from '@/lib/utils/media'

/**
 * Gallery = the 2/2/3 media grid (`.grid-media`) of `LightboxTrigger`s inside one
 * `LightboxScope`. There is no gallery logic of its own: clicking, previous/next,
 * Arrow keys, Escape, focus return and every animation live in `Lightbox.tsx`, which
 * inline media grids and prose uploads share.
 *
 * `columns` is an editor's explicit desktop choice (the gallery block's `columns`
 * field); phones and tablets always show two.
 */

export type GalleryItem = LightboxItem
export type GalleryColumns = 2 | 3 | 4

/** Thumbnails follow the frame rule's orientation buckets, not each photo's exact size. */
const thumbRatio = (item: { height?: number; width?: number }): string =>
  frameRatioFor({ height: item.height ?? null, id: '', width: item.width ?? null })

/** The CMS `columns` string (`"2" | "3" | "4"`) as a desktop column count; the contract's 3 otherwise. */
export const galleryColumns = (value: unknown): GalleryColumns => (value === '2' ? 2 : value === '4' ? 4 : 3)

export const gridMediaClass = (columns: GalleryColumns = 3): string =>
  cn('grid-media', columns === 2 && 'grid-media--2', columns === 4 && 'grid-media--4')

export const Gallery = ({
  className,
  columns = 3,
  items,
  labels,
  locale,
}: {
  className?: string
  columns?: GalleryColumns
  items: GalleryItem[]
  labels: LightboxLabels
  locale: Locale
}) => {
  if (items.length === 0) return null

  return (
    <LightboxScope items={items} labels={labels} locale={locale}>
      <ul className={cn(gridMediaClass(columns), className)}>
        {items.map((item, index) => (
          <li key={`${item.id}-${index}`}>
            <LightboxTrigger
              className="gallery-item frame"
              index={index}
              style={{ aspectRatio: thumbRatio(item) }}
            >
              <DecorativeMark className="top-1 end-1 hidden md:block" variant="corner" />
              <img
                alt={item.alt}
                className="frame__media"
                decoding="async"
                height={item.height}
                loading="lazy"
                sizes="(min-width: 64rem) 33vw, 50vw"
                src={item.src}
                srcSet={item.srcSet}
                style={{ aspectRatio: thumbRatio(item) }}
                width={item.width}
              />
            </LightboxTrigger>
          </li>
        ))}
      </ul>
    </LightboxScope>
  )
}
