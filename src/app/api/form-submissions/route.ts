import { NextResponse } from 'next/server'
import { cmsEnv, cmsFetchOptional, relayIdentity, requestWithHost, THEME_PROXY_MARKER } from '@/lib/cms/client'
import { fixturesEnabled } from '@/lib/cms/fixtures'
import { readBoundedText } from '@/lib/http/body'

export const dynamic = 'force-dynamic'

/**
 * Public form submissions, proxied to the CMS.
 *
 * - Bounded body, no cookies/auth forwarding, private no-store responses.
 * - Canonical honeypot `__eshobe_website_check`: a filled value is accepted
 *   without contacting the CMS (bots get no signal, CMS gets no spam).
 * - `company` is legitimate and is never treated as spam.
 * - The target form must be one of this site's bound forms (contactForm /
 *   careersForm) so the relay cannot become a cross-site submission path.
 *   The CMS remains authoritative: it derives the tenant from the persisted
 *   form document and validates fields/options/rate limits server-side.
 * - Portfolio/CV URLs are shape-checked only; the server never fetches a
 *   visitor-supplied URL.
 * - Process-local rate limit guards a single instance; multi-replica
 *   deployments should add edge throttling (documented in DEPLOYMENT.md).
 */
const MAX_BODY_BYTES = 64 * 1024
const HONEYPOT = '__eshobe_website_check'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u

const hits = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

const limited = (key: string): boolean => {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

const clientKey = (req: Request): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

export const POST = async (request: Request) => {
  if (fixturesEnabled()) {
    return NextResponse.json({ message: 'fixture-submission-accepted', ok: true })
  }
  const env = cmsEnv()
  if (!env.cmsUrl) return NextResponse.json({ error: 'cms-unconfigured' }, { status: 503 })
  if (request.headers.get(THEME_PROXY_MARKER)) {
    console.error('[cms-proxy] recursion refused for /api/form-submissions')
    return NextResponse.json({ error: 'proxy-recursion-refused' }, { status: 508 })
  }
  if (limited(clientKey(request))) {
    return NextResponse.json({ error: 'rate-limited' }, { headers: { 'cache-control': 'no-store' }, status: 429 })
  }
  const bounded = await readBoundedText(request, MAX_BODY_BYTES)
  if (!bounded.ok) {
    return NextResponse.json({ error: 'payload-too-large' }, { headers: { 'cache-control': 'no-store' }, status: 413 })
  }
  let body: unknown
  try {
    body = JSON.parse(bounded.text)
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { headers: { 'cache-control': 'no-store' }, status: 400 })
  }
  const record = body as { form?: unknown; submissionData?: unknown }
  if (typeof record.form !== 'string' || !record.form) {
    return NextResponse.json({ error: 'missing-form' }, { headers: { 'cache-control': 'no-store' }, status: 400 })
  }
  const data = Array.isArray(record.submissionData) ? (record.submissionData as Array<{ field?: unknown; value?: unknown }>) : []
  // Honeypot short-circuit before any CMS traffic.
  const trap = data.find((e) => e?.field === HONEYPOT)
  if (trap && String(trap.value ?? '').trim().length > 0) {
    return NextResponse.json({ message: 'accepted', ok: true }, { headers: { 'cache-control': 'no-store' } })
  }
  // Shape-check visitor URLs/emails without fetching them.
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') {
      return NextResponse.json({ error: 'malformed-entry' }, { headers: { 'cache-control': 'no-store' }, status: 400 })
    }
    const field = String((entry as { field?: unknown }).field ?? '')
    const value = String((entry as { value?: unknown }).value ?? '')
    if (!field || value.length > 5000) {
      return NextResponse.json({ error: 'invalid-entry' }, { headers: { 'cache-control': 'no-store' }, status: 400 })
    }
    if (/url|portfolio|website|link/i.test(field) && value.trim()) {
      try {
        const u = new URL(value.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return NextResponse.json({ errors: [{ field, message: 'Enter a valid http(s) URL.' }] }, { headers: { 'cache-control': 'no-store' }, status: 400 })
        }
      } catch {
        return NextResponse.json({ errors: [{ field, message: 'Enter a valid URL.' }] }, { headers: { 'cache-control': 'no-store' }, status: 400 })
      }
    }
    if (/email/i.test(field) && value.trim() && !EMAIL_RE.test(value.trim())) {
      return NextResponse.json({ errors: [{ field, message: 'Enter a valid email address.' }] }, { headers: { 'cache-control': 'no-store' }, status: 400 })
    }
  }
  // The form must belong to this site's bindings (contactForm / careersForm).
  try {
    const site = await cmsFetchOptional<{ themeRuntime?: { bindings?: Record<string, { id?: string } | null> } | null }>('/api/site', {
      tags: [`cms:${env.tenantKey}:site`],
      revalidate: 30,
    })
    const bindings = site?.themeRuntime?.bindings ?? {}
    const allowed = new Set(
      [bindings.contactForm?.id, bindings.careersForm?.id].filter((id): id is string => Boolean(id)),
    )
    if (allowed.size > 0 && !allowed.has(record.form)) {
      return NextResponse.json({ error: 'unknown-form' }, { headers: { 'cache-control': 'no-store' }, status: 400 })
    }
  } catch {
    // If the site descriptor cannot be read, fail closed only when bindings are
    // required; otherwise let the CMS (authoritative) reject unknown forms.
  }

  const target = `${env.cmsUrl.replace(/\/$/, '')}/api/form-submissions`
  const relay = relayIdentity(env, request.headers.get('host'))
  const headers = { 'content-type': request.headers.get('content-type') ?? 'application/json', ...relay.headers }
  try {
    const response = relay.host
      ? await requestWithHost(target, relay.host, { body: bounded.text, headers, method: 'POST' })
      : await fetch(target, { body: bounded.text, cache: 'no-store', headers, method: 'POST', signal: AbortSignal.timeout(8000) }).then(
          async (upstream) => ({ body: await upstream.text(), status: upstream.status }),
        )
    if (response.status >= 400) console.warn(`[cms-proxy] CMS answered ${response.status} for POST /api/form-submissions`)
    return new NextResponse(response.body, {
      headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
      status: response.status,
    })
  } catch (error) {
    console.error(`[cms-proxy] CMS unreachable for POST /api/form-submissions: ${error instanceof Error ? error.message : String(error)}`)
    return NextResponse.json({ error: 'cms-unavailable' }, { headers: { 'cache-control': 'no-store' }, status: 503 })
  }
}
