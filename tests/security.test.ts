import { afterEach, describe, expect, it } from 'vitest'

import { previewEnabled, previewSecret, previewToken, verifyPreviewToken } from '@/lib/cms/preview'
import {
  revalidateSecret,
  revalidateSignature,
  verifyRevalidateSignature,
} from '@/lib/cms/signature'
import { cmsEnv, isLocaleServed, isSiteServing } from '@/lib/cms/client'
import type { SiteDescriptor } from '@/lib/cms/types'

const SECRET = 'a-sufficiently-long-secret'
const ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ENV }
})

describe('preview signing', () => {
  it('is disabled without a sufficiently long secret', () => {
    delete process.env.ESHOBE_PREVIEW_SECRET
    expect(previewSecret()).toBeNull()
    expect(previewEnabled()).toBe(false)
    process.env.ESHOBE_PREVIEW_SECRET = 'short'
    expect(previewSecret()).toBeNull()
  })

  it('scopes a token to one path', () => {
    const token = previewToken(SECRET, '/projects/nur')
    expect(verifyPreviewToken(SECRET, '/projects/nur', token)).toBe(true)
    expect(verifyPreviewToken(SECRET, '/about', token)).toBe(false)
    expect(verifyPreviewToken('another-long-secret', '/projects/nur', token)).toBe(false)
  })

  it('rejects tampered and malformed tokens without throwing', () => {
    const token = previewToken(SECRET, '/')
    expect(verifyPreviewToken(SECRET, '/', `${token}0`)).toBe(false)
    expect(verifyPreviewToken(SECRET, '/', '')).toBe(false)
    expect(verifyPreviewToken(SECRET, '/', '💥')).toBe(false)
  })
})

describe('signed revalidation', () => {
  it('rejects everything when the deployment has no secret', () => {
    process.env.ESHOBE_REVALIDATE_SECRET = ''
    expect(revalidateSecret()).toBeNull()
  })

  it('signs the raw body, not a re-encoded one', () => {
    const raw = '{"paths":["/blog"]}'
    const signature = revalidateSignature(SECRET, raw)
    expect(verifyRevalidateSignature(SECRET, raw, signature)).toBe(false)
    expect(verifyRevalidateSignature(SECRET, '{"paths":["/blog"], "x":1}', `sha256=${signature}`)).toBe(false)
    expect(verifyRevalidateSignature(SECRET, raw, `sha256=${signature}`)).toBe(true)
    expect(verifyRevalidateSignature(SECRET, raw, null)).toBe(false)
    expect(verifyRevalidateSignature(SECRET, raw, 'deadbeef')).toBe(false)
  })
})

describe('CMS environment and tenant rules', () => {
  it('derives the tenant from the configured site id, never from the request', () => {
    process.env.ESHOBE_API_KEY = 'site-key'
    process.env.ESHOBE_SITE_ID = 'site_123'
    process.env.ESHOBE_SITE_DOMAIN = 'shop.example.com'
    process.env.ESHOBE_CMS_URL = 'https://cms.example.com/'
    const env = cmsEnv()
    expect(env.cmsUrl).toBe('https://cms.example.com')
    expect(env.tenantKey).toBe('site_123')
    // The tenant signature is the key; the client has no code path that reads a tenant
    // out of a visitor-supplied query or body.
    expect(env.allowHostTenant).toBe(false)
  })

  it('allows the host fallback only for local, key-less development', () => {
    delete process.env.ESHOBE_API_KEY
    process.env.ESHOBE_SITE_DOMAIN = 'shop.example.com'
    process.env.ESHOBE_ALLOW_HOST_TENANT = 'true'
    expect(cmsEnv().allowHostTenant).toBe(true)

    // …and the two tenant proofs are mutually exclusive: a key always wins.
    process.env.ESHOBE_API_KEY = 'site-key'
    expect(cmsEnv().allowHostTenant).toBe(false)
  })

  it('answers lifecycle and locale questions without guessing', () => {
    const base = {
      availableLocales: ['fa', 'en'],
      defaultLocale: 'fa',
      status: 'active',
    } as unknown as SiteDescriptor
    expect(isSiteServing(base)).toBe(true)
    expect(isSiteServing({ ...base, status: 'suspended' })).toBe(false)
    expect(isSiteServing({ ...base, status: 'archived' })).toBe(false)
    expect(isLocaleServed(base, 'en' as never)).toBe(true)
    expect(isLocaleServed({ ...base, availableLocales: ['fa'] } as never, 'en' as never)).toBe(false)
  })
})
