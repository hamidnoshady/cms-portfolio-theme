import 'server-only'

import type { SiteContext } from '@/lib/cms/context'
import type { LexicalNode } from '@/lib/cms/types'

import { referenceHrefs } from './links'

/**
 * Internal links inside rich text (and inside inline blocks) are stored as document
 * references. They are resolved in one batch per rich-text field — never one request
 * per anchor — and through the same resolver the menus and blocks use (`links.ts`), so
 * a page bound to a section lands on its section route here too.
 */

const visit = (node: LexicalNode, fn: (node: LexicalNode) => void): void => {
  fn(node)
  for (const child of node.children ?? []) visit(child, fn)
}

/** Every document reference in `content` → its localized theme URL, keyed `relationTo:id`. */
export const resolveRichTextLinks = async (
  content: null | { root?: { children?: LexicalNode[] } },
  ctx: SiteContext,
): Promise<Map<string, string>> => {
  const references: { relationTo?: null | string; value?: unknown }[] = []
  for (const child of content?.root?.children ?? []) {
    visit(child, (node) => {
      const fields = (node.fields ?? {}) as Record<string, unknown>
      const doc = fields.doc as { relationTo?: string; value?: unknown } | undefined
      if (doc?.value) references.push(doc)
    })
  }
  return referenceHrefs(references, ctx)
}
