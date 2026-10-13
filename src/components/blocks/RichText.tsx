import Link from 'next/link'
import type { ReactNode } from 'react'

import { FramedMedia } from '@/components/media/CmsImage'
import { LightboxScope } from '@/components/media/Lightbox'
import type { SiteContext } from '@/lib/cms/context'
import type { LexicalNode, Media } from '@/lib/cms/types'
import { cn } from '@/lib/utils/cn'
import { contentLightbox, contentOutline, defaultAnchorScope, type AnchorScope, type ContentLightbox } from '@/lib/utils/lexical'
import { isMedia } from '@/lib/utils/media'
import { referenceKey, safeCustomUrl } from '@/lib/routing/links'
import { resolveRichTextLinks } from '@/lib/routing/richText'
import { labels as dictionary } from '@/lib/theme/labels'

import { renderBlockNode } from './node'

/**
 * Lexical renderer for CMS rich text.
 *
 * Direction is taken from the **field** (`root.direction`), falling back to the page
 * locale — an English quotation inside a Persian page keeps its own direction. Text
 * runs use `unicode-bidi: plaintext` (`.bidi-isolate`) so a Latin product name inside
 * a Persian sentence does not drag the punctuation to the wrong end.
 *
 * Images are rendered **once, where the editor put them**, and every one of them —
 * an `upload` node, an inline `mediaBlock`, each cell of a `mediaGrid` — is a trigger
 * of one `LightboxScope` per field. So the photographs of a project narrative open as
 * one sequence with previous/next across all of them, and no view needs to collect
 * them again into a second gallery.
 */
export const RichText = async ({
  anchorScope,
  className,
  content,
  context,
  fallbackDir,
}: {
  /**
   * Namespace for this field's heading anchors. `null` marks the page's primary
   * narrative (`section-n`, what `SectionNav` links to); a block passes its CMS row
   * id; omitted, the field's content hash keeps ids unique across fields.
   */
  anchorScope?: AnchorScope
  className?: string
  content: null | { root?: { children?: LexicalNode[]; direction?: 'ltr' | 'rtl' | null } }
  context: SiteContext
  fallbackDir: 'ltr' | 'rtl'
}) => {
  const children = content?.root?.children ?? []
  if (children.length === 0) return null
  const direction = content?.root?.direction ?? fallbackDir
  const t = dictionary(context.locale)
  const links = await resolveRichTextLinks(content, context)
  const lightbox = contentLightbox(content, context.site.media.origin, t.photoAt)
  const scope = anchorScope === undefined ? defaultAnchorScope(content) : anchorScope
  const anchors = new Map<LexicalNode, string>(contentOutline(content, scope).map((item) => [item.node, item.id]))
  const nodeScope: NodeScope = { anchors, lightbox, links }

  const body = (
    <div className={cn('prose', className)} dir={direction}>
      {children.map((node, index) => (
        <Node context={context} key={nodeKey(node, index)} node={node} scope={nodeScope} />
      ))}
    </div>
  )

  if (!lightbox) return body

  return (
    <LightboxScope
      items={lightbox.items}
      labels={{ close: t.close, next: t.next, previous: t.previous, title: t.gallery }}
      locale={context.locale}
    >
      {body}
    </LightboxScope>
  )
}

/** What every node render needs besides the node: resolved links and the field's lightbox. */
export type NodeScope = {
  /** Anchor ids of the headings and named grids the in-page navigation points at. */
  anchors: Map<LexicalNode, string>
  lightbox: ContentLightbox | null
  links: Map<string, string>
}

const nodeKey = (node: LexicalNode, index: number): string =>
  typeof node.text === 'string' ? `${node.type ?? 'text'}-${index}-${node.text.slice(0, 12)}` : `${node.type ?? 'node'}-${index}`

const Node = ({
  context,
  node,
  scope,
}: {
  context: SiteContext
  node: LexicalNode
  scope: NodeScope
}): ReactNode => {
  switch (node.type) {
    case 'paragraph':
      return <p>{childrenOf(node, context, scope)}</p>

    case 'heading': {
      const tag = (node.tag as string | undefined) ?? 'h2'
      const Tag = (['h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) ? tag : 'h2') as 'h2'
      return <Tag id={scope.anchors.get(node)}>{childrenOf(node, context, scope)}</Tag>
    }

    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return <Tag>{childrenOf(node, context, scope)}</Tag>
    }

    case 'listitem':
      return <li>{childrenOf(node, context, scope)}</li>

    case 'quote':
      return <blockquote>{childrenOf(node, context, scope)}</blockquote>

    case 'horizontalrule':
      return <hr />

    case 'linebreak':
      return <br />

    case 'link': {
      // Same contract as menus and blocks: a document reference resolves to its
      // localized URL, a custom URL must pass the scheme/path check, and a link that
      // resolves to nothing renders its text without a fake `#` target.
      const fields = (node.fields ?? {}) as Record<string, unknown>
      const key = fields.linkType === 'custom' ? null : referenceKey(fields.doc as never)
      const internal = key ? scope.links.get(key) : undefined
      const custom = internal ? null : safeCustomUrl(fields.url, context.locale, context.site)
      const url = internal ?? custom?.href
      if (!url) return <>{childrenOf(node, context, scope)}</>
      const newTab = Boolean(fields.newTab)
      if (custom?.external || newTab) {
        return (
          <a href={url} rel={custom?.external ? 'noopener noreferrer' : undefined} target={newTab ? '_blank' : undefined}>
            {childrenOf(node, context, scope)}
          </a>
        )
      }
      return <Link href={url}>{childrenOf(node, context, scope)}</Link>
    }

    case 'upload': {
      const value = node.value as Media | null | undefined
      if (isMedia(value)) {
        return (
          <FramedMedia
            cap={70}
            lightbox={scope.lightbox?.indexOf.get(value)}
            media={value}
            origin={context.site.media.origin}
            size="content"
          />
        )
      }
      return null
    }

    case 'block':
    case 'blocknode':
      return renderBlockNode(node, context, scope.lightbox, scope.anchors.get(node))

    case 'text': {
      return <span className="bidi-isolate">{formatText(node)}</span>
    }

    default:
      return node.children ? <>{childrenOf(node, context, scope)}</> : null
  }
}

const childrenOf = (node: LexicalNode, context: SiteContext, scope: NodeScope): ReactNode =>
  (node.children ?? []).map((child, index) => (
    <Node context={context} key={nodeKey(child, index)} node={child} scope={scope} />
  ))

/** Lexical stores emphasis as a bitmask on the text node. */
const formatText = (node: LexicalNode): ReactNode => {
  const text = node.text ?? ''
  const format = typeof node.format === 'number' ? node.format : 0
  let output: ReactNode = text
  if (format & 16) output = <code>{output}</code>
  if (format & 8) output = <u>{output}</u>
  if (format & 4) output = <s>{output}</s>
  if (format & 2) output = <em>{output}</em>
  if (format & 1) output = <strong>{output}</strong>
  return output
}
