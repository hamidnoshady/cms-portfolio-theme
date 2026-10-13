import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as submitForm } from '@/app/api/form-submissions/route'
import { GET as proxyGet, POST as proxyPost } from '@/app/api/[...path]/route'
import { publicReadSearch } from '@/lib/cms/proxyPolicy'
import { readBoundedText } from '@/lib/http/body'

/**
 * The public API relay adds the **site key** to a visitor's request, and a site key
 * can read drafts and is not a visitor. So the relay — not the CMS's anonymous policy
 * — decides what a visitor may ask through it: published documents only, no `draft` or
 * `trash` switches, no content writes, and write bodies bounded in bytes.
 */

const ENV = { ...process.env }
const CMS = 'https://cms.example.test'
const seen: { method?: string; url: string }[] = []

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_API_KEY: 'site-key-for-test', ESHOBE_CMS_URL: CMS }
  delete process.env.ESHOBE_DEV_FIXTURES
  seen.length = 0
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    seen.push({ method: init?.method, url: String(url) })
    return new Response('{"docs":[]}', { headers: { 'content-type': 'application/json' }, status: 200 })
  })
})

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const context = (path: string[]) => ({ params: Promise.resolve({ path }) })

describe('public read policy', () => {
  it('pins versioned collections to published documents and drops privileged switches', () => {
    const params = new URLSearchParams(
      publicReadSearch('?draft=true&trash=true&where[_status][equals]=draft&where[slug][equals]=a&locale=en', 'posts').slice(1),
    )
    expect(params.get('draft')).toBeNull()
    expect(params.get('trash')).toBeNull()
    expect(params.getAll('where[_status][equals]')).toEqual(['published'])
    expect(params.get('where[slug][equals]')).toBe('a')
    expect(params.get('locale')).toBe('en')
  })

  it('does not add a `_status` filter to collections that have none', () => {
    expect(publicReadSearch('?draft=true&limit=2', 'products')).toBe('?limit=2')
    expect(publicReadSearch('', 'header')).toBe('')
  })

  it('relays a draft request as a published read', async () => {
    await proxyGet(
      new Request('https://customer.example/api/pages?draft=true&where[or][0][_status][equals]=draft', {
        headers: { host: 'customer.example' },
      }),
      context(['pages']),
    )
    const url = new URL(seen[0]!.url)
    expect(url.searchParams.get('draft')).toBeNull()
    expect(url.searchParams.get('where[_status][equals]')).toBe('published')
  })

  it('refuses content writes through the key and still relays checkout', async () => {
    const write = await proxyPost(
      new Request('https://customer.example/api/pages', { body: '{"title":"x"}', method: 'POST' }),
      context(['pages']),
    )
    expect(write.status).toBe(405)
    expect(seen).toHaveLength(0)

    const checkout = await proxyPost(
      new Request('https://customer.example/api/checkout', { body: '{"items":[]}', method: 'POST' }),
      context(['checkout']),
    )
    expect(checkout.status).toBe(200)
    expect(seen.map((entry) => entry.method)).toEqual(['POST'])
  })

  it('bounds relayed write bodies', async () => {
    const response = await proxyPost(
      new Request('https://customer.example/api/checkout', { body: 'x'.repeat(65 * 1024), method: 'POST' }),
      context(['checkout']),
    )
    expect(response.status).toBe(413)
    expect(seen).toHaveLength(0)
  })
})

describe('byte-bounded bodies', () => {
  it('counts bytes, not characters', async () => {
    // 40,000 Persian letters: under 64 Ki characters, ~80 KB of UTF-8.
    const persian = 'س'.repeat(40_000)
    expect(persian.length).toBeLessThan(64 * 1024)
    const response = await submitForm(
      new Request('https://studio.example.test/api/form-submissions', {
        body: JSON.stringify({ form: 'form-contact', submissionData: [{ field: 'message', value: persian }] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    expect(response.status).toBe(413)
    expect(seen).toHaveLength(0)
  })

  it('stops reading a stream as soon as it passes the bound', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled > 100) controller.close()
        else controller.enqueue(new Uint8Array(1024))
      },
    })
    const request = new Request('https://x.test', { body: stream, duplex: 'half', method: 'POST' } as RequestInit)
    await expect(readBoundedText(request, 4 * 1024)).resolves.toEqual({ ok: false, reason: 'too-large' })
    expect(pulled).toBeLessThan(100)
  })

  it('refuses a declared length over the bound before reading', async () => {
    const request = new Request('https://x.test', { body: 'short', headers: { 'content-length': '999999' }, method: 'POST' })
    await expect(readBoundedText(request, 1024)).resolves.toEqual({ ok: false, reason: 'too-large' })
  })

  it('returns the decoded text when within the bound', async () => {
    const request = new Request('https://x.test', { body: 'سلام', method: 'POST' })
    await expect(readBoundedText(request, 1024)).resolves.toEqual({ ok: true, text: 'سلام' })
  })
})
