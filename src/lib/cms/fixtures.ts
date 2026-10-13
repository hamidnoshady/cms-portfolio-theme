import 'server-only'

import { headers } from 'next/headers'

import { FIXTURE_ORIGIN_FALLBACK } from './fixtures.data'
import { fixtureRaw as rawFixture } from './fixtures.encode'
import type { QueryParams } from './client'

export { fixturesEnabled } from './fixtures.encode'

/**
 * Development fixture provider (in-app).
 *
 * Purpose: run the whole theme — routing, chrome, archives, detail pages, blocks,
 * forms, states, skeletons — without a live CMS, so browser QA exercises the real
 * components. It is **off** unless both guards pass:
 *
 *   NODE_ENV !== 'production'   (a production build can never serve this code path)
 *   ESHOBE_DEV_FIXTURES === '1' (a developer must ask for it explicitly)
 *
 * The encoder itself lives in `fixtures.encode.ts` (no Next imports) and is shared with
 * `scripts/mock-cms.mjs`; the only thing added here is the request origin, which is
 * needed because fixture media is served same-origin.
 */

/** Media is same-origin in fixtures, so the descriptor origin follows the request. */
const requestOrigin = async (): Promise<string> => {
  try {
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
    if (!host) return FIXTURE_ORIGIN_FALLBACK
    const protocol =
      headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${protocol}://${host}`
  } catch {
    return FIXTURE_ORIGIN_FALLBACK
  }
}

export const fixtureRaw = async (path: string, params: QueryParams = {}) =>
  rawFixture(path, params, await requestOrigin())
