import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SECTIONS } from '@/lib/theme/sections'

/**
 * The manifest is a *contract file*: the CMS validates it with `parseThemeManifest`
 * (allowlists everywhere, unknown key = rejection) and then executes what it says. So
 * these tests do not restate the parser — they pin the two things that go wrong in a
 * theme repository and that no type checker catches:
 *
 * 1. the manifest drifts from the code (a slot nobody reads, a capability nobody
 *    implements, a build command the parser would now reject), and
 * 2. a key/identifier accidentally ships a customer's or product name.
 *
 * `docs/QA.md` records the stronger check: feeding this exact file to the CMS's own
 * parser and to `@eshobe/site-runtime`'s `contractVersion`.
 */

const raw = readFileSync(new URL('../eshobe.theme.json', import.meta.url), 'utf8')
const manifest = JSON.parse(raw) as Record<string, unknown>

const TOP_LEVEL = new Set([
  'build',
  'capabilities',
  'contentSlots',
  'contractVersion',
  'deployment',
  'design',
  'env',
  'key',
  'locales',
  'name',
  'nameFa',
  'preview',
  'previewUrl',
  'proxiesApi',
  'settings',
  'siteTypes',
])

const BUILD_PACKS = new Set(['dockercompose', 'dockerfile', 'nixpacks', 'static'])
const SITE_TYPES = new Set(['business', 'portfolio', 'store'])
const ENV_SOURCES = new Set(['platform', 'tenant'])
const SLOT_TYPES = new Set(['page', 'post', 'category', 'form', 'media'])
const SETTING_TYPES = new Set(['boolean', 'number', 'select', 'text'])
const SAFE_COMMAND = /^(?:pnpm|npm|yarn|bun|node|npx|next|vite|astro|nuxt|remix|gatsby|serve)(?:\s+[A-Za-z0-9@._:/=,+-]+)*$/
const SCHEMA_KEY = /^[a-z][A-Za-z0-9]{0,63}$/
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/* --- the slots and settings the code actually reads ----------------------- */

const SLOTS_READ_BY_CODE = new Set([...Object.values(SECTIONS).map((section) => section.slot), 'contactForm', 'careersForm'])
const SETTINGS_READ_BY_CODE = new Set(['canvasMotion', 'canvasDensity', 'archiveLayout', 'clockZoneA', 'clockLabelA', 'clockZoneB', 'clockLabelB'])
const CAPABILITIES_IMPLEMENTED = new Set(['projects', 'objects', 'contactForm', 'careersForm', 'team', 'featuredWork'])
/** `source: "platform"` is the only honest source for anything the platform injects. */
const PLATFORM_OWNED = new Set([
  'ESHOBE_ALLOW_HOST_TENANT',
  'ESHOBE_API_KEY',
  'ESHOBE_CMS_URL',
  'ESHOBE_DEFAULT_LOCALE',
  'ESHOBE_LOCALES',
  'ESHOBE_PREVIEW_SECRET',
  'ESHOBE_PUBLIC_ORIGIN',
  'ESHOBE_REVALIDATE_SECRET',
  'ESHOBE_SITE_DOMAIN',
  'ESHOBE_SITE_ID',
])

describe('eshobe.theme.json', () => {
  it('declares only keys the CMS parser knows', () => {
    for (const key of Object.keys(manifest)) expect(TOP_LEVEL.has(key), `unknown key ${key}`).toBe(true)
  })

  it('declares the contract this theme was built against', () => {
    expect(manifest.contractVersion).toBe(1)
  })

  it('uses a neutral key and a name that cannot be mistaken for a customer', () => {
    const key = String(manifest.key)
    expect(key).toMatch(/^[a-z][a-z0-9-]{1,40}$/)
    expect(key).toBe('bang-portfolio')
    // A studio identity belongs to the CMS, never to the theme package.
    expect(raw.toLowerCase()).not.toMatch(/graphite|arch-theme-cms/)
  })

  it('claims only implemented site types, locales and capabilities', () => {
    expect(Array.isArray(manifest.siteTypes)).toBe(true)
    for (const type of manifest.siteTypes as string[]) expect(SITE_TYPES.has(type)).toBe(true)
    expect(manifest.locales).toEqual(['fa', 'en'])
    expect(manifest.proxiesApi).toBe(true)

    const capabilities = manifest.capabilities as Record<string, boolean>
    for (const [name, value] of Object.entries(capabilities)) {
      expect(CAPABILITIES_IMPLEMENTED.has(name), `capability ${name} is not implemented`).toBe(true)
      expect(value).toBe(true)
    }
    expect(Object.keys(capabilities).sort()).toEqual([...CAPABILITIES_IMPLEMENTED].sort())
  })

  it('describes a build the parser accepts and this repository can actually run', () => {
    const build = manifest.build as Record<string, unknown>
    expect(BUILD_PACKS.has(String(build.buildPack))).toBe(true)
    expect(build.buildPack).toBe('dockerfile')
    expect(build.dockerfileLocation).toBe('Dockerfile')
    expect(build.port).toBe(3000)
    expect(build.healthCheckPath).toBe('/api/health')
    for (const command of ['installCommand', 'buildCommand', 'startCommand']) {
      expect(SAFE_COMMAND.test(String(build[command])), `unsafe ${command}`).toBe(true)
    }
    // The three commands must be exactly the ones this repository runs, and the npm
    // scripts they call must exist.
    const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts as Record<string, string>
    expect(build.installCommand).toBe('npm ci')
    expect(build.buildCommand).toBe('npm run build')
    expect(build.startCommand).toBe('npm run start:standalone')
    expect(scripts.build).toBeDefined()
    expect(scripts['start:standalone']).toBeDefined()
  })

  it('declares environment variables as platform-owned and runtime-only', () => {
    const env = manifest.env as { key: string; secret: boolean; source: string }[]
    const seen = new Set<string>()
    for (const entry of env) {
      expect(entry.key).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/)
      expect(seen.has(entry.key)).toBe(false)
      seen.add(entry.key)
      expect(ENV_SOURCES.has(entry.source)).toBe(true)
      // Nothing the theme can be tricked into supplying a value for.
      expect(PLATFORM_OWNED.has(entry.key)).toBe(true)
      expect(entry.source).toBe('platform')
    }
    expect(env.some((entry) => entry.secret)).toBe(true)
  })

  it('keeps settings and content slots in step with the code', () => {
    const settings = manifest.settings as Record<string, { type: string }>
    expect(Array.isArray(settings)).toBe(false)
    for (const [key, setting] of Object.entries(settings)) {
      expect(SETTINGS_READ_BY_CODE.has(key), `${key} is declared but unread`).toBe(true)
      expect(SCHEMA_KEY.test(key)).toBe(true)
      expect(SETTING_TYPES.has(setting.type)).toBe(true)
    }
    const keys = new Set<string>()
    for (const slot of manifest.contentSlots as { key: string; required: boolean; type: string }[]) {
      expect(SCHEMA_KEY.test(slot.key)).toBe(true)
      expect(SLOT_TYPES.has(slot.type)).toBe(true)
      expect(keys.has(slot.key)).toBe(false)
      keys.add(slot.key)
      // Every declared slot must be one the theme resolves, and every slot the theme
      // resolves must be declared — otherwise an operator sees a binding form that
      // does nothing, or a working slot they cannot bind.
      expect(SLOTS_READ_BY_CODE.has(slot.key)).toBe(true)
    }
    expect([...SLOTS_READ_BY_CODE].sort()).toEqual([...keys].sort())
  })

  it('keeps the design tokens inside the white/black, square system', () => {
    const design = manifest.design as Record<string, string | number>
    for (const value of Object.values(design)) {
      if (typeof value === 'string' && value.startsWith('#')) expect(COLOR.test(value)).toBe(true)
    }
    expect(design.radius).toBe('none')
    expect(Number(design.lineHeight)).toBeGreaterThanOrEqual(1.4)
    expect(Number(design.lineHeight)).toBeLessThanOrEqual(2.4)
    expect(design.background).toBe('#ffffff')
    expect(design.foreground).toBe('#000000')
  })

  it('declares the immutable GHCR image that CI builds and registers', () => {
    expect(manifest.deployment).toEqual({
      strategy: 'registry_image',
      registryProvider: 'ghcr',
      registryImageRepository: 'ghcr.io/hamidnoshady/cms-portfolio-theme',
      registryVisibility: 'public',
    })
    expect(manifest.preview ?? manifest.previewUrl ?? null).toBeNull()
  })
})
