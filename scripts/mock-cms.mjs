#!/usr/bin/env node
/**
 * Mock CMS for production-build QA.
 *
 * `ESHOBE_DEV_FIXTURES` is deliberately **dev-only** (`NODE_ENV !== 'production'`), so a
 * production build cannot serve fixture data. That is correct for the product, but it
 * means production QA needs a CMS. This script serves the documented REST shapes from
 * the same fixture encoder the app uses in development, as a real HTTP service.
 *
 *   node --experimental-strip-types scripts/mock-cms.mjs [--port 4010] [--delay 0] [--mode fail|slow|empty|holding|nologo|longlabels]
 *   ESHOBE_CMS_URL=http://127.0.0.1:4010 npm run start
 *
 * It is a QA tool: never referenced by the theme at runtime, never published.
 */
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The theme's TypeScript uses extensionless relative imports (a bundler convention),
 * which Node's type stripping does not resolve on its own. This tiny resolve hook adds
 * the extension — nothing else about module resolution changes.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/u.test(specifier) && context.parentURL) {
      for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
        try {
          if (existsSync(fileURLToPath(new URL(candidate, context.parentURL)))) {
            return nextResolve(candidate, context)
          }
        } catch {
          /* fall through to the default resolver */
        }
      }
    }
    return nextResolve(specifier, context)
  },
})

const { fixtureRaw } = await import('../src/lib/cms/fixtures.encode.ts')
const { FIXTURE_MEDIA_FILES } = await import('../src/lib/cms/fixtures.data.ts')

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(flag('port', '4010'))
const delayFlag = Number(flag('delay', '0'))
const mode = flag('mode', 'ok')
// `fail` and `slow` are transport-level switches handled here; every other token is a
// content mode forwarded to the fixture encoder (composable: `--mode holding,nologo`).
const transportModes = new Set(['fail', 'slow'])
const fixtureMode = mode
  .split(',')
  .map((token) => token.trim())
  .filter((token) => token && !transportModes.has(token))
  .join(',')
const failing = mode.split(',').some((token) => token.trim() === 'fail')
const delay = mode.split(',').some((token) => token.trim() === 'slow') && delayFlag === 0 ? 1500 : delayFlag
/**
 * Origin advertised in the site descriptor. Point it at the **theme** (e.g.
 * `http://127.0.0.1:3100`) when the fixture media files are served from the theme's own
 * `public/qa/media/`, so the browser requests them same-origin.
 */
const publicOrigin = flag('origin', '').replace(/\/+$/, '')

/**
 * `where[categories][in][0]=a&where[and][1][slug][equals]=x` → the nested object the
 * fixture encoder expects, with arrays where the query used numeric indices (Payload's
 * array syntax) and primitives at the leaves.
 */
const setPath = (root, segments, value) => {
  let cursor = root
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    const nextIsIndex = /^\d+$/u.test(segments[index + 1])
    if (key === undefined) return
    if (Array.isArray(cursor)) {
      const position = Number(key)
      cursor[position] ??= nextIsIndex ? [] : {}
      cursor = cursor[position]
    } else {
      cursor[key] ??= nextIsIndex ? [] : {}
      cursor = cursor[key]
    }
  }

  const last = segments[segments.length - 1]
  if (last === undefined) return
  if (Array.isArray(cursor)) cursor[Number(last)] = value
  else cursor[last] = value
}

const parseQuery = (searchParams) => {
  const root = {}
  for (const [rawKey, value] of searchParams.entries()) {
    const segments = rawKey.split(/[[\]]/u).filter((segment) => segment !== '')
    setPath(root, segments, value)
  }
  // `{value: 'x'}` leaves become primitives; arrays and objects are rebuilt recursively.
  const unwrap = (node) => {
    if (Array.isArray(node)) return node.map(unwrap)
    if (node && typeof node === 'object') {
      const keys = Object.keys(node)
      if (keys.length === 1 && keys[0] === 'value') return node.value
      return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, unwrap(value)]))
    }
    return node
  }
  return unwrap(root)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? `127.0.0.1:${port}`}`)
  const contentType = url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'

  // Fixture media is served by the mock CMS too, so the theme's media origin check has
  // a real second origin to validate against.
  // Fixture media is also served from the theme's own public folder in production QA,
  // so this path exists mainly for the descriptor-origin variant.
  if (url.pathname.startsWith('/qa/media/') || url.pathname.startsWith('/api/media/file/')) {
    const file = url.pathname.split('/').pop()
    if (!FIXTURE_MEDIA_FILES.includes(file)) {
      response.writeHead(404).end()
      return
    }
    const { readFile } = await import('node:fs/promises')
    try {
      const body = await readFile(new URL(`../public/qa/media/${file}`, import.meta.url))
      response.writeHead(200, { 'cache-control': 'no-store', 'content-type': contentType }).end(body)
    } catch {
      response.writeHead(404).end()
    }
    return
  }

  if (failing) {
    response.writeHead(503, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'mock-cms-unreachable' }))
    return
  }
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

  // A POST body (form submissions) is parsed and handed to the encoder as its
  // "params", so the same file answers both verbs without a second request shape.
  let submitted = {}
  if (request.method === 'POST' || request.method === 'PATCH') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    try {
      submitted = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid-json' }))
      return
    }
  }

  const params = { ...parseQuery(url.searchParams), ...submitted }
  if (process.env.ESHOBE_MOCK_LOG === '1') {
    console.log(`[mock] ${request.method} ${url.pathname} ${JSON.stringify(params).slice(0, 200)}`)
  }
  const origin = publicOrigin || `http://127.0.0.1:${port}`
  const { body, status } = await fixtureRaw(url.pathname, params, origin, fixtureMode)
  response.writeHead(status, { 'content-type': 'application/json', 'x-mock-cms': 'portfolio-fixtures' }).end(body)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`mock CMS listening on http://127.0.0.1:${port} (mode=${mode} delay=${delay}ms)`)
})
