import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Process readiness for Coolify and the CMS deploy verifier.
 *
 * This route is deliberately self-contained: it does not import the CMS client, read a
 * tenant, warm a cache, redirect, or contact any remote service. A deployment can pass
 * its process health probe even while the CMS is temporarily unavailable, and the
 * renderer's stale CMS cache handles that outage separately.
 */
export const GET = (): NextResponse =>
  NextResponse.json(
    { ok: true, status: 'ok' },
    {
      headers: {
        'cache-control': 'no-store',
      },
      status: 200,
    },
  )
