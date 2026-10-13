#!/usr/bin/env node
/**
 * Prepares `output: 'standalone'` for `node .next/standalone/server.js`.
 *
 * Next's standalone output contains the server bundle only; the static chunks and the
 * `public/` tree have to be placed next to it, otherwise the browser receives HTML for
 * `/_next/static/...` (the app's catch-all answers), scripts are refused on MIME type
 * and **nothing hydrates** — a failure that is easy to miss because the pages still
 * render server-side.
 *
 * The QA fixture media (`public/qa/`) is excluded unless `ARCH2_INCLUDE_QA=1`, so a
 * production image never ships development placeholders.
 */
import { cp, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const standalone = join(root, '.next', 'standalone')

const exists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(standalone))) {
  console.error('[standalone] .next/standalone is missing — run `npm run build` first.')
  process.exit(1)
}

await rm(join(standalone, '.next', 'static'), { force: true, recursive: true })
await cp(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true })

const includeQa = process.env.ARCH2_INCLUDE_QA === '1'
const filterPublic = (source) => !(source.includes(`${join('public', 'qa')}`) && !includeQa)
await rm(join(standalone, 'public'), { force: true, recursive: true })
await cp(join(root, 'public'), join(standalone, 'public'), { filter: filterPublic, recursive: true })

console.log(`[standalone] prepared .next/standalone/.next/static and public/${includeQa ? ' (including qa fixtures)' : ''}`)
