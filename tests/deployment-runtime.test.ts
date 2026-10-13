import { createServer } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as health } from '@/app/api/health/route'
import { GET as proxyGet, POST as proxyPost } from '@/app/api/[...path]/route'
import { cachedCmsRead, clearCmsReadCache, purgeCmsReadCache } from '@/lib/cms/cache'
import { nativeRequestOptions } from '@/lib/cms/client'

const ENV = { ...process.env }

afterEach(() => {
  clearCmsReadCache()
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const response = (body: string, status = 200) => ({
  body,
  headers: new Headers({ 'content-type': 'application/json' }),
  status,
})

describe('deployment readiness and CMS cache', () => {
  it('answers health directly without a CMS read or redirect', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    process.env.ESHOBE_CMS_URL = 'https://cms.example.test'

    const result = health()
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('no-store')
    await expect(result.json()).resolves.toEqual({ ok: true, status: 'ok' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reuses a successful CMS read, then purges resources and the site descriptor together', async () => {
    let calls = 0
    const load = async () => response(JSON.stringify({ value: ++calls }))

    await cachedCmsRead({ key: 'site', load, path: '/api/site', tags: ['cms:site:site'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    expect(calls).toBe(2)

    expect(purgeCmsReadCache({ resources: ['page'] })).toBe(2)
    await cachedCmsRead({ key: 'site', load, path: '/api/site', tags: ['cms:site:site'] })
    await cachedCmsRead({ key: 'page', load, path: '/api/pages', tags: ['cms:site:pages:fa'] })
    expect(calls).toBe(4)
  })
})

describe('direct-mode API proxy', () => {
  it('proxies documented CMS reads with the original customer Host and caches GETs', async () => {
    const seen: { host?: string; url?: string; xForwardedHost?: string }[] = []
    const cms = createServer((request, response) => {
      const forwarded = request.headers['x-forwarded-host']
      seen.push({
        host: request.headers.host,
        url: request.url,
        xForwardedHost: Array.isArray(forwarded) ? forwarded[0] : forwarded,
      })
      response.setHeader('content-type', 'application/json')
      response.end('{"docs":[]}')
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`

    try {
      const request = () =>
        new Request('https://customer.example/api/products?limit=2', {
          headers: { host: 'customer.example' },
        })
      const context = { params: Promise.resolve({ path: ['products'] }) }

      await proxyGet(request(), context)
      await proxyGet(request(), context)

      expect(seen).toEqual([
        { host: 'customer.example', url: '/api/products?limit=2', xForwardedHost: 'customer.example' },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  })

  it('relays media files byte for byte with the customer Host', async () => {
    // A JPEG header plus bytes that are invalid UTF-8: decoding them as text replaced
    // each with U+FFFD and every CMS image on a direct deployment arrived corrupt.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x80, 0x9f, 0xc3, 0xff, 0xd9])
    const hosts: (string | undefined)[] = []
    const cms = createServer((request, response) => {
      hosts.push(request.headers.host)
      response.setHeader('content-type', 'image/jpeg')
      response.setHeader('cache-control', 'public, max-age=31536000')
      response.end(jpeg)
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`

    try {
      const context = { params: Promise.resolve({ path: ['media', 'file', 'photo.jpg'] }) }
      const request = () =>
        new Request('https://customer.example/api/media/file/photo.jpg', { headers: { host: 'customer.example' } })

      const first = await proxyGet(request(), context)
      expect(first.status).toBe(200)
      expect(first.headers.get('content-type')).toBe('image/jpeg')
      expect(first.headers.get('cache-control')).toBe('public, max-age=31536000')
      expect(Buffer.from(await first.arrayBuffer()).equals(jpeg)).toBe(true)

      // Not held in the text read cache: a second request goes upstream again.
      await proxyGet(request(), context)
      expect(hosts).toEqual(['customer.example', 'customer.example'])
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  })

  it('forwards public checkout POSTs but does not cache them', async () => {
    const calls: { body: string; host?: string; url?: string }[] = []
    const cms = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        calls.push({ body: Buffer.concat(chunks).toString('utf8'), host: request.headers.host, url: request.url })
        response.setHeader('content-type', 'application/json')
        response.end('{"ok":true}')
      })
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`

    try {
      const context = { params: Promise.resolve({ path: ['checkout'] }) }
      const request = () =>
        new Request('https://customer.example/api/checkout', {
          body: '{"product":"product-id"}',
          headers: { 'content-type': 'application/json', host: 'customer.example' },
          method: 'POST',
        })

      await proxyPost(request(), context)
      await proxyPost(request(), context)

      expect(calls).toEqual([
        { body: '{"product":"product-id"}', host: 'customer.example', url: '/api/checkout' },
        { body: '{"product":"product-id"}', host: 'customer.example', url: '/api/checkout' },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  })
})

describe('keyed relay (preview hostnames)', () => {
  type Seen = { authorization?: string; host?: string; marker?: string; xForwardedHost?: string }

  const withCms = async (
    status: number,
    run: (seen: Seen[]) => Promise<void>,
    contentType = 'image/jpeg',
  ) => {
    const seen: Seen[] = []
    const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
    const cms = createServer((request, response) => {
      seen.push({
        authorization: one(request.headers.authorization),
        host: request.headers.host,
        marker: one(request.headers['x-eshobe-theme-proxy']),
        xForwardedHost: one(request.headers['x-forwarded-host']),
      })
      response.statusCode = status
      response.setHeader('content-type', contentType)
      response.end(status === 200 ? 'bytes' : '{"errors":[{"message":"Forbidden"}]}')
    })
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    const address = cms.address()
    if (!address || typeof address === 'string') throw new Error('test CMS did not expose a TCP port')
    process.env.ESHOBE_CMS_URL = `http://127.0.0.1:${address.port}`
    process.env.ESHOBE_API_KEY = 'site-key-for-test'
    try {
      await run(seen)
    } finally {
      await new Promise<void>((resolve, reject) => cms.close((error) => (error ? reject(error) : resolve())))
    }
  }

  const previewHost = 'abc123def456-cms-arch3-theme-preview.theme.eshobe.com'
  const mediaRequest = (headers: Record<string, string> = {}) =>
    new Request(`https://${previewHost}/api/media/file/photo.jpg`, { headers: { host: previewHost, ...headers } })
  const mediaContext = () => ({ params: Promise.resolve({ path: ['media', 'file', 'photo.jpg'] }) })

  it('sends the site key on media requests, keeps the CMS Host and never forwards the browser credential', async () => {
    await withCms(200, async (seen) => {
      const response = await proxyGet(mediaRequest({ authorization: 'Bearer visitor-supplied' }), mediaContext())
      expect(response.status).toBe(200)
      expect(response.headers.get('authorization')).toBeNull()
      expect(seen).toHaveLength(1)
      expect(seen[0]!.authorization).toBe('Bearer site-key-for-test')
      expect(seen[0]!.host).toBe(new URL(process.env.ESHOBE_CMS_URL!).host)
      expect(seen[0]!.xForwardedHost).toBe(previewHost)
      expect(seen[0]!.marker).toBe('1')
    })
  })

  it('sends the site key on JSON reads too', async () => {
    await withCms(
      200,
      async (seen) => {
        const request = new Request(`https://${previewHost}/api/pages`, { headers: { host: previewHost } })
        await proxyGet(request, { params: Promise.resolve({ path: ['pages'] }) })
        expect(seen[0]!.authorization).toBe('Bearer site-key-for-test')
        expect(seen[0]!.host).not.toBe(previewHost)
      },
      'application/json',
    )
  })

  it('returns the CMS error status instead of a generic 503', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await withCms(403, async () => {
      const response = await proxyGet(mediaRequest(), mediaContext())
      expect(response.status).toBe(403)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('403'))
    })
    warn.mockRestore()
  })

  it('answers 503 only when the CMS cannot be reached', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.ESHOBE_CMS_URL = 'http://127.0.0.1:1'
    process.env.ESHOBE_API_KEY = 'site-key-for-test'
    const response = await proxyGet(mediaRequest(), mediaContext())
    expect(response.status).toBe(503)
    error.mockRestore()
  })

  it('refuses a request carrying its own proxy marker without contacting the CMS', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await withCms(200, async (seen) => {
      const response = await proxyGet(mediaRequest({ 'x-eshobe-theme-proxy': '1' }), mediaContext())
      expect(response.status).toBe(508)
      await expect(response.json()).resolves.toEqual({ error: 'proxy-recursion-refused' })
      expect(seen).toHaveLength(0)
    })
    error.mockRestore()
  })
})

describe('native CMS request options', () => {
  it('uses the CMS hostname as TLS SNI, not the visitor host it sends as Host', () => {
    const options = nativeRequestOptions('https://cms.eshobe.com/api/site', 'customer.example')
    expect(options.servername).toBe('cms.eshobe.com')
    expect(options.headers.host).toBe('customer.example')
  })

  it('omits the Host override when none is given, and never sets an IP as SNI', () => {
    const options = nativeRequestOptions('https://10.0.0.5:8443/api/site', null)
    expect(options.headers).not.toHaveProperty('host')
    expect(options).not.toHaveProperty('servername')
  })
})
