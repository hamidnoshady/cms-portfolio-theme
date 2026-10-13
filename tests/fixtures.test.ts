import { describe, expect, it } from 'vitest'

import { fixtureRaw } from '@/lib/cms/fixtures.encode'
import { FIXTURE_PAGES, FIXTURE_POSTS } from '@/lib/cms/fixtures.data'
import type { QueryParams, QueryValue } from '@/lib/cms/client'

/**
 * The fixture encoder is development/QA tooling, but it is what the browser evidence is
 * captured against, so its query semantics are tested too: if it silently widened a
 * filter, the QA run would "verify" a blog index that also contained project entries.
 */

/** Same nesting rule the mock CMS applies to a query string. */
const fromQuery = (query: string): QueryParams => {
  const root: Record<string, QueryValue> = {}
  const setPath = (segments: string[], value: string): void => {
    let cursor: QueryValue = root
    for (let index = 0; index < segments.length - 1; index += 1) {
      const key = segments[index] as string
      const nextIsIndex = /^\d+$/u.test(segments[index + 1] ?? '')
      if (Array.isArray(cursor)) {
        const position = Number(key)
        cursor[position] ??= nextIsIndex ? [] : {}
        cursor = cursor[position]
      } else if (cursor && typeof cursor === 'object') {
        const record = cursor as Record<string, QueryValue>
        record[key] ??= nextIsIndex ? [] : {}
        cursor = record[key]
      }
    }
    const last = segments.at(-1)
    if (last === undefined) return
    if (Array.isArray(cursor)) cursor[Number(last)] = value
    else if (cursor && typeof cursor === 'object') (cursor as Record<string, QueryValue>)[last] = value
  }

  for (const pair of query.split('&')) {
    if (!pair) continue
    const [rawKey, rawValue = ''] = pair.split('=')
    if (!rawKey) continue
    setPath(rawKey.split(/[[\]]/u).filter(Boolean), decodeURIComponent(rawValue))
  }
  return root
}

const list = async (path: string, query: string) => {
  const response = await fixtureRaw(path, fromQuery(query), 'http://localhost:3000')
  const body = JSON.parse(response.body) as { docs?: { slug: string }[]; totalDocs?: number }
  return { docs: body.docs ?? [], status: response.status, totalDocs: body.totalDocs ?? 0 }
}

describe('fixture query semantics', () => {
  it('filters by a plain equals clause', async () => {
    const result = await list('/api/posts', 'where[slug][equals]=notes-on-lines&limit=12')
    expect(result.docs.map((doc) => doc.slug)).toEqual(['notes-on-lines'])
  })

  it('reads `exists=false` as false, not as the truthy string "false"', async () => {
    // The bug this guards: comparing `exists` by truthiness made an archive's
    // second OR clause match everything, so unrelated entries showed up.
    const result = await list('/api/posts', 'where[categories][exists]=false&limit=12')
    expect(result.docs).toHaveLength(0)
  })

  it('keeps projects and objects in separate subtrees', async () => {
    const projects = (await list('/api/posts', 'where[categories][in][0]=cat-projects&limit=12')).docs.map((doc) => doc.slug)
    expect(projects).not.toContain('raw-lamp')
    const objects = (await list('/api/posts', 'where[categories][in][0]=cat-lamps&limit=12')).docs.map((doc) => doc.slug)
    expect(objects).toContain('raw-lamp')
  })

  it('filters a category subtree with `in`', async () => {
    const result = await list('/api/posts', 'where[categories][in][0]=cat-workshops&limit=12')
    expect(result.docs).toHaveLength(FIXTURE_POSTS.filter((post) => post.categories.includes('cat-workshops')).length)
  })

  it('paginates deterministically, newest first', async () => {
    const first = await list('/api/posts', 'limit=2&page=1&sort=-publishedAt')
    const second = await list('/api/posts', 'limit=2&page=2&sort=-publishedAt')
    expect(first.docs).toHaveLength(2)
    expect(second.docs).toHaveLength(2)
    expect(first.docs[0]?.slug).not.toBe(second.docs[0]?.slug)
  })

  it('answers the documented descriptor and 404 shapes', async () => {
    const site = JSON.parse((await fixtureRaw('/api/site', {}, 'http://localhost:3000')).body) as { contractVersion: number }
    expect(site.contractVersion).toBe(1)
    expect((await fixtureRaw('/api/pages/does-not-exist', {}, 'http://localhost:3000')).status).toBe(404)
    expect((await fixtureRaw('/api/not-a-documented-path', {}, 'http://localhost:3000')).status).toBe(404)
  })

  it('serves every fixture page by id and by slug', async () => {
    for (const page of FIXTURE_PAGES) {
      expect((await fixtureRaw(`/api/pages/${page.id}`, {}, 'http://localhost:3000')).status, page.id).toBe(200)
      const bySlug = await fixtureRaw('/api/pages', { where: { slug: { equals: page.slug } } }, 'http://localhost:3000')
      expect((JSON.parse(bySlug.body) as { docs: unknown[] }).docs, page.slug).toHaveLength(1)
    }
  })
})
