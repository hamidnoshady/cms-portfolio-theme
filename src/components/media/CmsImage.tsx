import type { CSSProperties, ReactNode } from 'react'

import { DecorativeMark } from '@/components/design/DecorativeMark'
import { LightboxTrigger } from '@/components/media/Lightbox'
import type { Media } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import {
  aspectRatio,
  frameRatio,
  frameRatioFor,
  ratioNumber,
  type FrameAspect,
  type FrameSize,
  isSvg,
  mediaAlt,
  mediaOriginAllowed,
  mediaSrcSet,
  mediaUrl,
  objectPosition,
} from '@/lib/utils/media'

/**
 * CMS media, rendered without Next's image optimizer on purpose: the tenant's media
 * origin is only known at runtime, and an optimizer allowlist wide enough to cover it
 * (`hostname: '**'`) would make `/api/media/file/*` an open proxy. The CMS already
 * produced the size ladder, so `srcset` + explicit `width`/`height` + CSS
 * `aspect-ratio` deliver the same result with no layout shift and no extra surface.
 *
 * The origin is validated against the descriptor's `media.origin` (plus the optional
 * `NEXT_PUBLIC_MEDIA_ORIGIN` override) — a document cannot make the page fetch from
 * an arbitrary host.
 */

export const CmsImage = ({
  alt,
  className,
  media,
  origin,
  overrideOrigin,
  priority = false,
  ratio,
  sizes = '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw',
  style,
}: {
  alt?: string
  className?: string
  media: Media | null | undefined
  origin: string
  overrideOrigin?: null | string
  priority?: boolean
  ratio?: string
  sizes?: string
  style?: CSSProperties
}) => {
  const allowed = [origin, overrideOrigin].filter((value): value is string => Boolean(value))
  const direct = mediaUrl(media, origin)

  if (!media || !direct || !mediaOriginAllowed(direct, allowed)) {
    return (
      <div
        aria-hidden="true"
        className={cn('skeleton', className)}
        style={{ aspectRatio: ratio ?? frameRatioFor(media), ...style }}
      />
    )
  }

  const vector = isSvg(media)

  return (
    <img
      alt={alt ?? mediaAlt(media)}
      className={className}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      height={vector ? undefined : (media.height ?? undefined)}
      loading={priority ? 'eager' : 'lazy'}
      sizes={vector ? undefined : sizes}
      src={direct}
      srcSet={vector ? undefined : mediaSrcSet(media, origin)}
      style={{
        aspectRatio: ratio ?? frameRatioFor(media),
        objectFit: 'cover',
        objectPosition: objectPosition(media),
        ...style,
      }}
      width={vector ? undefined : (media.width ?? undefined)}
    />
  )
}

/** A framed image: the 5px inset structural rectangle lives in `lines.css`. */
export const MediaFrame = ({
  className,
  frameClassName,
  fragmented = false,
  ...props
}: Parameters<typeof CmsImage>[0] & {
  className?: string
  fragmented?: boolean
  frameClassName?: string
}) => (
  <span
    className={cn('frame', fragmented && 'frame--fragmented', className)}
    style={{ aspectRatio: props.ratio ?? aspectRatio(props.media) }}
  >
    <CmsImage className={cn('frame__media', frameClassName)} {...props} />
  </span>
)

/**
 * The one way a page shows a standalone photograph (hero, media block, image in an
 * article): a ratio from the frame rule and a viewport-height cap, so a portrait never
 * outgrows the screen and frames stay a consistent family instead of every image's
 * exact pixel size. `size` sets how wide the figure may run inside its container.
 *
 * `lightbox` is the figure's index in the enclosing `LightboxScope`: when set, the
 * frame becomes a `LightboxTrigger` and the photograph opens in the same lightbox as
 * every other content image. Heroes leave it unset — they are composition, not content.
 */
export const FramedMedia = ({
  aspect = 'auto',
  cap = 72,
  caption,
  className,
  lightbox,
  mark = true,
  media,
  origin,
  priority = false,
  size = 'content',
  sizes,
}: {
  aspect?: FrameAspect | null
  /** Maximum frame height, in `svh`. */
  cap?: number
  caption?: ReactNode
  className?: string
  /** Index inside the enclosing `LightboxScope`; omit for a non-interactive frame. */
  lightbox?: number
  mark?: boolean
  media: Media
  origin: string
  priority?: boolean
  size?: FrameSize
  sizes?: string
}) => {
  const ratio = frameRatio(media, aspect)
  const style = { '--ar': ratioNumber(ratio), '--frame-cap': `${cap}svh`, aspectRatio: ratio } as CSSProperties
  const frame = (
    <span className="frame frame--capped" style={style}>
      {mark ? <DecorativeMark className="top-1 end-1 hidden md:block" variant="corner" /> : null}
      <CmsImage
        className="frame__media"
        media={media}
        origin={origin}
        priority={priority}
        ratio={ratio}
        sizes={sizes ?? (size === 'full' ? '100vw' : size === 'narrow' ? '(min-width: 768px) 36rem, 100vw' : '(min-width: 1440px) 1360px, 100vw')}
      />
    </span>
  )
  return (
    <figure className={cn('media-figure', `media-figure--${size}`, className)}>
      {lightbox === undefined ? frame : <LightboxTrigger index={lightbox}>{frame}</LightboxTrigger>}
      {caption ? <figcaption className="media-figure__caption type-caption">{caption}</figcaption> : null}
    </figure>
  )
}
