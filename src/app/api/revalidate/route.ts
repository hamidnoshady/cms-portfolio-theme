import { revalidatePath, revalidateTag } from 'next/cache'
import { after, NextResponse } from 'next/server'

import { purgeCmsReadCache } from '@/lib/cms/cache'
import { revalidateSecret, verifyRevalidateSignature } from '@/lib/cms/signature'

export const dynamic = 'force-dynamic'

type RevalidatePayload = {
  paths?: unknown[]
  resources?: unknown[]
  tags?: unknown[]
}

const stringValues = (values: unknown[] | undefined): string[] =>
  (values ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0)

/**
 * Signed, asynchronous invalidation.
 *
 * The CMS allows only three seconds and does not retry. Authentication and lightweight
 * JSON validation happen before the acknowledgement; all cache work is registered with
 * Next's `after()` hook so the caller receives its 202 before paths/tags are purged.
 * The signature covers the exact raw body bytes only (not the timestamp header).
 */
export const POST = async (request: Request): Promise<NextResponse> => {
  const secret = revalidateSecret()
  if (!secret) return NextResponse.json({ error: 'revalidation-disabled' }, { status: 503 })

  const raw = Buffer.from(await request.arrayBuffer())
  if (!verifyRevalidateSignature(secret, raw, request.headers.get('x-eshobe-signature'))) {
    return NextResponse.json({ error: 'invalid-signature' }, { status: 401 })
  }

  let payload: RevalidatePayload
  try {
    payload = JSON.parse(raw.toString('utf8')) as RevalidatePayload
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  const paths = stringValues(payload.paths)
  const tags = stringValues(payload.tags)
  const resources = stringValues(payload.resources)

  after(() => {
    try {
      // This includes `/api/site` on every accepted notice: the descriptor carries
      // bindings, theme tokens, locale and branding for every rendered route.
      purgeCmsReadCache({ paths, resources, tags })

      // The process-local read cache above is authoritative for CMS fetches. Keep
      // Next's route/data invalidation in sync for rendered output and custom tags.
      revalidateTag('cms', 'max')
      for (const tag of tags) revalidateTag(tag, 'max')
      for (const path of paths) revalidatePath(path.startsWith('/') ? path : `/${path}`)
    } catch {
      // The CMS intentionally treats delivery as best effort. An in-process cache still
      // has a short expiry, so an invalid value cannot persist indefinitely.
    }
  })

  return NextResponse.json(
    { accepted: true, paths: paths.length, resources: resources.length, tags: tags.length },
    { status: 202 },
  )
}
