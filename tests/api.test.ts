import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/form-submissions/route'

/**
 * The public form endpoint — the theme's one write path into the CMS.
 *
 * It is a *proxy*, and the properties worth pinning are the ones that make that safe:
 * the visitor's own credentials never reach the CMS, the site key names the tenant, the
 * payload is bounded, and the CMS's answer (status included) is what the browser sees —
 * the theme never invents a success.
 */

const ENV = { ...process.env }
const CMS = 'https://cms.example.test'

type Relay = { body?: unknown; headers: Record<string, string>; method?: string; url: string }

const captured: Relay[] = []

const stubFetch = (status = 201, body = '{"message":"submitted"}') => {
  captured.length = 0
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    const target = String(url)
    if (target.includes('/api/site')) {
      return new Response(
        JSON.stringify({ themeRuntime: { bindings: { contactForm: { id: 'form-contact' }, careersForm: { id: 'form-careers' } } } }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      )
    }
    captured.push({
      body: init?.body,
      headers: (init?.headers ?? {}) as Record<string, string>,
      method: init?.method,
      url: target,
    })
    return new Response(body, { headers: { 'content-type': 'application/json' }, status })
  })
}

beforeEach(() => {
  process.env = { ...ENV, ESHOBE_API_KEY: 'site-key-for-test', ESHOBE_CMS_URL: CMS }
  delete process.env.ESHOBE_DEV_FIXTURES
})

afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

const submit = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://studio.example.test/api/form-submissions', {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })

const payload = { form: 'form-contact', submissionData: [{ field: 'name', value: 'نمونه' }] }

describe('form submissions proxy', () => {
  it('forwards to the documented endpoint and passes the CMS answer through', async () => {
    stubFetch(201)
    const response = await POST(submit(payload))

    expect(captured).toHaveLength(1)
    expect(captured[0]!.url).toBe(`${CMS}/api/form-submissions`)
    expect(captured[0]!.method).toBe('POST')
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ message: 'submitted' })
  })

  it("sends the site key, never the visitor's cookie or authorization header", async () => {
    stubFetch()
    await POST(
      submit(payload, {
        authorization: 'Bearer visitor-supplied',
        cookie: 'eshobe_preview=forged',
      }),
    )

    const headers = captured[0]!.headers
    // The key names the site, so a preview hostname the CMS does not know resolves.
    expect(headers.authorization).toBe('Bearer site-key-for-test')
    const serialised = JSON.stringify(headers).toLowerCase()
    expect(serialised).not.toContain('visitor-supplied')
    expect(serialised).not.toContain('cookie')
  })

  it('refuses a request carrying its own proxy marker instead of looping', async () => {
    stubFetch()
    const response = await POST(submit(payload, { 'x-eshobe-theme-proxy': '1' }))
    expect(response.status).toBe(508)
    await expect(response.json()).resolves.toEqual({ error: 'proxy-recursion-refused' })
    expect(captured).toHaveLength(0)
  })

  it('forwards the declared JSON content type without client credentials', async () => {
    stubFetch()
    await POST(submit(payload))

    const headers = captured[0]!.headers
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-forwarded-host']).toBeUndefined()
  })

  it('is not cacheable', async () => {
    stubFetch()
    const response = await POST(submit(payload))
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('refuses a body over the bound instead of relaying it', async () => {
    stubFetch()
    const response = await POST(submit('x'.repeat(65 * 1024)))
    expect(response.status).toBe(413)
    expect(captured).toHaveLength(0)
  })

  it('answers 503 rather than failing when no CMS is configured', async () => {
    process.env = { ...ENV }
    delete process.env.ESHOBE_CMS_URL
    delete process.env.ESHOBE_API_KEY
    stubFetch()
    const response = await POST(submit(payload))
    expect(response.status).toBe(503)
    expect(captured).toHaveLength(0)
  })

  it('passes a CMS rejection through instead of reporting success', async () => {
    stubFetch(400, '{"errors":[{"message":"required"}]}')
    const response = await POST(submit(payload))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ errors: [{ message: 'required' }] })
  })

  it('absorbs the canonical honeypot without contacting the CMS', async () => {
    stubFetch()
    const response = await POST(
      submit({ form: 'form-contact', submissionData: [{ field: '__eshobe_website_check', value: 'bot' }] }),
    )
    expect(response.status).toBe(200)
    expect(captured).toHaveLength(0)
  })

  it('rejects a form outside this site bindings', async () => {
    stubFetch()
    const response = await POST(submit({ form: 'form-other-site', submissionData: [] }))
    expect(response.status).toBe(400)
  })

  it('accepts without contacting the CMS only when development fixtures are on', async () => {
    process.env.ESHOBE_DEV_FIXTURES = '1'
    stubFetch()
    const response = await POST(submit(payload))
    expect(response.status).toBe(200)
    expect(captured).toHaveLength(0)
  })
})
