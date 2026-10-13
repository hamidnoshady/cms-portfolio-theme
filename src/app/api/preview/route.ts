import { NextResponse } from 'next/server'

import { PREVIEW_COOKIE, previewSecret, previewToken } from '@/lib/cms/preview'

export const dynamic = 'force-dynamic'

/**
 * Draft preview.
 *
 * Disabled unless `ESHOBE_PREVIEW_SECRET` (≥16 chars) is set. The caller presents
 * `?path=/…&token=<hmac>` where `token = HMAC-SHA256(secret, path)` — a token for one
 * path cannot unlock the site root, and nothing here accepts a site key from a visitor.
 * The cookie itself is the *token*, re-verified per request in `getSiteContext`; draft
 * rendering additionally requires the deployment's own site key (drafts are never
 * served from an anonymous read) and is always `no-store` + `noindex`.
 *
 *   node -e "console.log(require('crypto').createHmac('sha256',process.env.ESHOBE_PREVIEW_SECRET).update('/projects/x').digest('hex'))"
 *   GET /api/preview?path=/projects/x&token=…   → cookie set, redirect to the path
 *   GET /api/preview?exit=1                     → cookie cleared
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url)
  const secret = previewSecret()

  if (url.searchParams.has('exit')) {
    const response = NextResponse.redirect(new URL('/', url.origin))
    response.cookies.delete(PREVIEW_COOKIE)
    return response
  }

  if (!secret) return NextResponse.json({ error: 'preview-disabled' }, { status: 404 })

  const path = url.searchParams.get('path') ?? '/'
  const token = url.searchParams.get('token') ?? ''
  const expected = previewToken(secret, path)

  if (token !== expected) return NextResponse.json({ error: 'invalid-token' }, { status: 401 })

  const response = NextResponse.redirect(new URL(path, url.origin))
  response.cookies.set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: url.protocol === 'https:',
  })
  return response
}
