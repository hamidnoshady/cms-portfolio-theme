/** Query policy for public reads relayed by `src/app/api/[...path]/route.ts`. */

/**
 * Collections with drafts. The site key can read drafts, and this relay adds the key to
 * a visitor's query, so a public read of these is pinned to published documents — the
 * same filter the theme's own reads apply (`publishedFilter`). Payload ANDs top-level
 * `where` keys, so the visitor's own conditions (including an `or` group) can only
 * narrow the published set, never widen it.
 */
const VERSIONED = new Set(['pages', 'posts'])

/**
 * Query parameters a public read may never carry through the key: `draft` (latest
 * draft instead of published), `trash` (soft-deleted documents) and any visitor-written
 * `_status` condition (replaced by ours for versioned collections).
 */
const isPrivilegedParam = (key: string): boolean =>
  key === 'draft' || key === 'trash' || /^where\[_status\]/u.test(key)

export const publicReadSearch = (search: string, resource: string): string => {
  const params = new URLSearchParams(search)
  for (const key of [...params.keys()]) {
    if (isPrivilegedParam(key)) params.delete(key)
  }
  if (VERSIONED.has(resource)) params.set('where[_status][equals]', 'published')
  const query = params.toString()
  return query ? `?${query}` : ''
}
