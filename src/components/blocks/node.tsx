import type { ReactNode } from 'react'

import { CmsImage, FramedMedia } from '@/components/media/CmsImage'
import { galleryColumns, gridMediaClass } from '@/components/media/Gallery'
import { LightboxTrigger } from '@/components/media/Lightbox'
import type { SiteContext } from '@/lib/cms/context'
import type { LexicalNode, Media } from '@/lib/cms/types'
import type { ContentLightbox } from '@/lib/utils/lexical'
import { toLocaleDigits } from '@/lib/runtime'
import { safeCustomUrl } from '@/lib/routing/safeUrl'
import { frameRatio, isFrameAspect, isMedia, mediaPresentation } from '@/lib/utils/media'

/**
 * Inline lexical blocks (the `BlocksFeature` inside `posts.content`): `mediaBlock`,
 * `mediaGrid`, `banner` and `code`. Page-level blocks live in `Blocks.tsx`; splitting the two keeps
 * the rich-text renderer free of a circular import.
 *
 * `lightbox` is the enclosing field's lightbox sequence (see `RichText`): a media
 * block or a grid cell looks its own medium up there and becomes a trigger of the
 * shared lightbox, so inline media never has a static implementation of its own.
 */
/**
 * The name the editor gave the block in the CMS (Payload's `blockName`), e.g. the floor
 * a set of renders belongs to. Payload stores it on the block's `fields`; a node-level
 * copy is read too so either serialisation shows the label.
 */
const blockTitle = (node: LexicalNode): null | string => {
  const fields = (node.fields ?? {}) as Record<string, unknown>
  const raw = fields.blockName ?? (node as unknown as Record<string, unknown>).blockName
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/**
 * The label row above a named media block: the editor's block name, a hairline to the
 * far edge and, for a set of several images, a two-digit count. A single image gets no
 * count — "01" would say nothing.
 */
const MediaLabel = ({ count, id, locale, title }: { count?: number; id: string; locale: string; title: string }) => (
  <div className="media-grid__head" id={id}>
    <span className="media-grid__title" dir="auto">
      {title}
    </span>
    <span aria-hidden="true" className="media-grid__rule" />
    {count ? (
      <span aria-hidden="true" className="media-grid__count">
        {toLocaleDigits(String(count).padStart(2, '0'), locale)}
      </span>
    ) : null}
  </div>
)

export const renderBlockNode = (
  node: LexicalNode,
  context: SiteContext,
  lightbox: ContentLightbox | null = null,
  anchorId?: string,
): ReactNode => {
  const fields = (node.fields ?? {}) as Record<string, unknown>
  const blockType = (fields.blockType as string | undefined) ?? ''

  switch (blockType) {
    case 'mediaBlock': {
      const media = fields.media
      if (!isMedia(media as never)) {
        warnUnknown(`mediaBlock without populated media`)
        return null
      }
      const { aspect, caption, size } = mediaPresentation(fields)
      const figure = (
        <FramedMedia
          aspect={aspect}
          cap={size === 'full' ? 82 : 70}
          caption={caption}
          lightbox={lightbox?.indexOf.get(media as Media)}
          media={media as Media}
          origin={context.site.media.origin}
          size={size}
        />
      )
      const title = blockTitle(node)
      if (!title) return figure
      // Named like a set of images: the same label row, then the one frame under it.
      const labelId = anchorId ? `${anchorId}-label` : `media-block-${(media as Media).id}`
      return (
        <div aria-labelledby={labelId} className={`media-titled media-titled--${size}`} id={anchorId} role="group">
          <MediaLabel id={labelId} locale={context.locale} title={title} />
          {figure}
        </div>
      )
    }

    case 'mediaGrid': {
      // Several photographs side by side inside an article: one shared ratio so the
      // row reads as a composed set, never a ragged strip of exact image sizes. The
      // grid is the same `.grid-media` as a gallery block (2 columns on phones and
      // tablets); the editor's `columns` only applies on desktop and defaults to 3.
      const images = (Array.isArray(fields.images) ? fields.images : []).filter((item): item is Media =>
        isMedia(item as never),
      )
      if (images.length === 0) {
        warnUnknown('mediaGrid without populated images')
        return null
      }
      const columns = galleryColumns(fields.columns)
      const aspect = isFrameAspect(fields.aspect) && fields.aspect !== 'original' ? fields.aspect : '4/5'
      const ratio = frameRatio(images[0], aspect)
      const caption = typeof fields.caption === 'string' && fields.caption.trim() ? fields.caption.trim() : null
      const title = blockTitle(node)
      const labelId = title ? (anchorId ? `${anchorId}-label` : `media-grid-${images[0]!.id}`) : undefined
      return (
        <figure aria-labelledby={labelId} className="media-grid" id={anchorId}>
          {title && labelId ? <MediaLabel count={images.length} id={labelId} locale={context.locale} title={title} /> : null}
          <ul className={gridMediaClass(columns)}>
            {images.map((image, position) => (
              <li key={`${image.id}-${position}`}>
                <LightboxTrigger
                  className="gallery-item frame"
                  index={lightbox?.indexOf.get(image)}
                  style={{ aspectRatio: ratio }}
                >
                  <CmsImage
                    className="frame__media"
                    media={image}
                    origin={context.site.media.origin}
                    ratio={ratio}
                    sizes={`(min-width: 64rem) ${Math.round(60 / columns)}rem, 50vw`}
                  />
                </LightboxTrigger>
              </li>
            ))}
          </ul>
          {caption ? <p className="media-figure__caption type-caption">{caption}</p> : null}
        </figure>
      )
    }

    case 'banner': {
      const content = fields.content
      const link = safeCustomUrl(fields.url, context.locale, context.site)
      const url = link?.href ?? null
      return (
        <aside className="notice">
          <RichTextContent content={content} context={context} />
          {url ? (
            <a className="link-inline type-ui target-standalone" href={url} rel="noopener noreferrer" target="_blank">
              {url}
            </a>
          ) : null}
        </aside>
      )
    }

    case 'code': {
      const code = typeof fields.code === 'string' ? fields.code : ''
      if (!code) return null
      return (
        <pre className="overflow-x-auto border border-line-structural p-4 text-start" dir="ltr">
          <code>{code}</code>
        </pre>
      )
    }

    default:
      warnUnknown(blockType || String(node.type ?? 'unknown'))
      return null
  }
}

/** Minimal rich-text renderer for inline block payloads (no nested blocks). */
const RichTextContent = ({ content, context }: { content: unknown; context: SiteContext }): ReactNode => {
  const root = (content as { root?: { children?: LexicalNode[]; direction?: string } } | null)?.root
  const children = root?.children ?? []
  if (children.length === 0) return null
  return (
    <div className="prose" dir={root?.direction ?? context.dir}>
      {children.map((child, index) => (
        <p key={`banner-${index}`}>
          {(child.children ?? []).map((text, textIndex) => (
            <span className="bidi-isolate" key={`banner-${index}-${textIndex}`}>
              {text.text ?? ''}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}

/**
 * Unknown/unsupported blocks are skipped with a diagnostic instead of crashing the
 * page — a customer's page must still render if the CMS offers a block this theme
 * version does not know. Development only: production stays quiet.
 */
export const warnUnknown = (blockType: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[theme] skipping unsupported block: "${blockType}"`)
  }
}
