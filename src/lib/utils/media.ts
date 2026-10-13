import type { Media, MediaRef } from '@/lib/cms/types'

/** Media resolution and geometry. No component builds a media URL by hand. */

export const MEDIA_SIZES = ['thumbnail', 'small', 'medium', 'large', 'xlarge'] as const
export type MediaSizeName = (typeof MEDIA_SIZES)[number]

export const isMedia = (value: MediaRef): value is Media =>
  Boolean(value) && typeof value === 'object' && 'url' in (value as Media)

export const isSvg = (media: Media): boolean => (media.mimeType ?? '').includes('svg')

/**
 * Allowed media origins. The descriptor's `media.origin` is the CMS's own origin (the
 * object-storage bucket stays private; files stream through `/api/media/file/*`), and
 * `NEXT_PUBLIC_MEDIA_ORIGIN` is an explicit deployment override. Anything else is
 * refused rather than fetched, so a document cannot turn the renderer into an SSRF
 * gadget or a hotlink.
 */
export const mediaOriginAllowed = (candidate: string, allowed: string[]): boolean => {
  // A same-deployment path under the media base is served by this theme's own
  // `/api/media/file/*` relay, whatever host the visitor used.
  if (isMediaPath(candidate)) return true
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return allowed.some((origin) => {
      try {
        return new URL(origin).origin === url.origin
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

export type MediaLike = { height?: null | number; url?: null | string; width?: null | number }

/** Where the CMS serves uploads; the theme relays the same path (`app/api/[...path]`). */
export const MEDIA_BASE_PATH = '/api/media/file/'

const isMediaPath = (value: string): boolean => value.startsWith(MEDIA_BASE_PATH)

/**
 * A CMS upload's URL, **relative** whenever it is a `/api/media/file/*` file.
 *
 * The descriptor's `media.origin` is the site's *primary* domain. Absolutizing
 * against it made a preview deployment (`<id>-preview.theme.eshobe.com`) load every
 * image from production — so a preview depended on the live site, and broke whenever
 * production pointed somewhere else. A relative path is fetched from whichever host
 * is rendering, and that host's relay carries the site key. A URL that is absolute
 * and points at the declared origin's media path is reduced to the same path; an
 * absolute URL anywhere else is left as is (and refused by `mediaOriginAllowed`
 * unless allowed). Callers that need an absolute URL (Open Graph) resolve the
 * result against `ESHOBE_PUBLIC_ORIGIN` — never `ESHOBE_SITE_DOMAIN`.
 */
export const mediaUrl = (media: MediaLike | null | undefined, origin: string): null | string => {
  const raw = media?.url
  if (!raw) return null
  if (isMediaPath(raw)) return raw
  try {
    const resolved = new URL(raw, origin)
    const declared = new URL(origin).origin
    if (resolved.origin === declared && isMediaPath(resolved.pathname)) {
      return `${resolved.pathname}${resolved.search}`
    }
    return resolved.toString()
  } catch {
    return null
  }
}

/** An absolute media URL for consumers outside the page (Open Graph, feeds). */
export const absoluteMediaUrl = (url: null | string, deploymentOrigin: string): null | string => {
  if (!url) return null
  try {
    return new URL(url, deploymentOrigin).toString()
  } catch {
    return null
  }
}

export const sizeUrl = (
  media: Media | null | undefined,
  size: MediaSizeName,
  origin: string,
): null | string => mediaUrl(media?.sizes?.[size] ?? media ?? null, origin)

/**
 * `srcset` from the CMS-rendered sizes. A viewer on a 390px phone downloads the 600w
 * file for a grid card instead of the 1920w original.
 */
export const mediaSrcSet = (
  media: Media | null | undefined,
  origin: string,
  sizes: MediaSizeName[] = ['small', 'medium', 'large'],
): undefined | string => {
  if (!media || isSvg(media)) return undefined
  const entries = sizes
    .map((size) => {
      const candidate = media.sizes?.[size]
      const url = mediaUrl(candidate ?? null, origin)
      const width = candidate?.width
      return url && width ? `${url} ${width}w` : null
    })
    .filter((value): value is string => Boolean(value))
  const original = mediaUrl(media, origin)
  if (original && media.width) entries.push(`${original} ${media.width}w`)
  return entries.length > 1 ? entries.join(', ') : undefined
}

/**
 * What the lightbox needs to know about one image: a resolved `src`, the size ladder,
 * the real dimensions (for a stable frame before the file arrives) and a non-empty
 * accessible name. Plain data — it crosses the server/client boundary as props.
 */
export type LightboxItem = {
  alt: string
  height?: number
  id: string
  src: string
  srcSet?: string
  width?: number
}

/**
 * A CMS medium as a lightbox item, or `null` when it has no resolvable URL. The alt
 * text falls back to the locale's generic «تصویر»/«Photograph» so a trigger button is
 * never nameless.
 */
export const lightboxItem = (media: Media, origin: string, fallbackAlt: string): LightboxItem | null => {
  const src = mediaUrl(media, origin)
  if (!src) return null
  return {
    alt: mediaAlt(media, fallbackAlt),
    height: media.height ?? undefined,
    id: String(media.id),
    src,
    srcSet: mediaSrcSet(media, origin),
    width: media.width ?? undefined,
  }
}

export const aspectRatio = (media: Media | null | undefined): string => {
  const width = media?.width ?? 4
  const height = media?.height ?? 3
  if (!width || !height) return '4 / 3'
  return `${width} / ${height}`
}

export type Orientation = 'landscape' | 'portrait' | 'square'

export const orientationOf = (media: Media | null | undefined): Orientation => {
  const width = media?.width ?? 0
  const height = media?.height ?? 0
  if (!width || !height) return 'landscape'
  const ratio = width / height
  if (ratio > 1.15) return 'landscape'
  if (ratio < 0.87) return 'portrait'
  return 'square'
}

/** Portrait media keeps a portrait frame (3:4); landscape keeps 3:2. */
export const frameRatioFor = (media: Media | null | undefined): string => {
  switch (orientationOf(media)) {
    case 'portrait':
      return '3 / 4'
    case 'square':
      return '1 / 1'
    default:
      return '3 / 2'
  }
}

export const objectPosition = (media: Media | null | undefined): undefined | string => {
  const x = media?.focalX
  const y = media?.focalY
  if (typeof x !== 'number' || typeof y !== 'number') return undefined
  return `${Math.round(x)}% ${Math.round(y)}%`
}

export const mediaAlt = (media: Media | null | undefined, fallback = ''): string =>
  (media?.alt ?? '').trim() || fallback

/* --- the frame sizing rule ---------------------------------------------------
   A frame never takes a photograph's exact pixel ratio at full width: a 1080×1350
   portrait at the content width is taller than two screens. Every framed image
   gets (1) a ratio from a short, deliberate set — chosen by the editor, or derived
   from the photo's orientation — and (2) a height cap in viewport units, so the
   frame narrows instead of growing past the screen. The photo fills the frame
   (`object-fit: cover`, focal point respected).
------------------------------------------------------------------------------ */

export const FRAME_ASPECTS = ['16/9', '3/2', '4/3', '1/1', '4/5', '3/4'] as const
export type FrameAspect = (typeof FRAME_ASPECTS)[number] | 'auto' | 'original'

const asRatio = (value: string): string => value.replace('/', ' / ')

/** The frame ratio for a medium: the editor's choice, else an orientation bucket. */
export const frameRatio = (media: Media | null | undefined, aspect: FrameAspect | null | undefined = 'auto'): string => {
  if (aspect && (FRAME_ASPECTS as readonly string[]).includes(aspect)) return asRatio(aspect)
  const width = media?.width ?? 0
  const height = media?.height ?? 0
  if (aspect === 'original' && width && height) return `${width} / ${height}`
  if (!width || !height) return '3 / 2'
  const ratio = width / height
  if (ratio >= 1.6) return '16 / 9'
  return frameRatioFor(media)
}

export const ratioNumber = (ratio: string): number => {
  const [w, h] = ratio.split('/').map((part) => Number(part.trim()))
  return w && h ? w / h : 1.5
}

export const isFrameAspect = (value: unknown): value is FrameAspect =>
  typeof value === 'string' && (value === 'auto' || value === 'original' || (FRAME_ASPECTS as readonly string[]).includes(value))

export const FRAME_SIZES = ['narrow', 'content', 'wide', 'full'] as const
export type FrameSize = (typeof FRAME_SIZES)[number]

export const isFrameSize = (value: unknown): value is FrameSize =>
  typeof value === 'string' && (FRAME_SIZES as readonly string[]).includes(value)

/** Editor-chosen presentation for a media row/block; every field optional, validated. */
export const mediaPresentation = (
  fields: Record<string, unknown>,
): { aspect: FrameAspect; caption: null | string; size: FrameSize } => ({
  aspect: isFrameAspect(fields.aspect) ? fields.aspect : 'auto',
  caption: typeof fields.caption === 'string' && fields.caption.trim() ? fields.caption.trim() : null,
  size: isFrameSize(fields.size) ? fields.size : 'content',
})
