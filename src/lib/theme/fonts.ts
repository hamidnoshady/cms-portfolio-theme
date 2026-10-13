import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Font provisioning.
 *
 * Persian product type is **Shazde 100–900**. The licensed files are not distributed
 * with this repository, so the loader looks for them in `public/fonts/shazde/` at
 * build time and, when any are absent, keeps Persian on the shipped Vazirmatn
 * variable face — it never maps a missing weight onto another file. Missing filenames
 * are reported (`distinctFonts().missing`) instead of being swallowed.
 *
 * The CSS is emitted by hand rather than through `next/font/local` for one concrete
 * reason: the Shazde step is conditional. A `next/font/local` call needs its `src`
 * list at build time and would fail the build for every deployment that has not
 * dropped in the licensed files — the opposite of "implement the fallback and identify
 * the missing files".
 */

export const SHAZDE_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

const SHAZDE_STEMS: Record<(typeof SHAZDE_WEIGHTS)[number], string> = {
  100: 'Shazde-Thin',
  200: 'Shazde-ExtraLight',
  300: 'Shazde-Light',
  400: 'Shazde-Regular',
  500: 'Shazde-Medium',
  600: 'Shazde-SemiBold',
  700: 'Shazde-Bold',
  800: 'Shazde-ExtraBold',
  900: 'Shazde-Black',
}

const SHAZDE_EXTENSIONS = ['woff2', 'woff'] as const

const fontsDir = () => join(process.cwd(), 'public', 'fonts')
const shazdeDir = () => join(fontsDir(), 'shazde')

export type FontFile = { file: string; weight: number; format: 'woff2' | 'woff' }

export const shazdeFiles = (): { found: FontFile[]; missing: string[] } => {
  const found: FontFile[] = []
  const missing: string[] = []
  for (const weight of SHAZDE_WEIGHTS) {
    const stem = SHAZDE_STEMS[weight]
    const match = SHAZDE_EXTENSIONS.map((ext) => `${stem}.${ext}`).find((name) =>
      existsSync(join(shazdeDir(), name)),
    )
    if (!match) {
      missing.push(`${stem}.woff2`)
      continue
    }
    found.push({ file: match, weight, format: match.endsWith('.woff') ? 'woff' : 'woff2' })
  }
  return { found, missing }
}

/** Files that must be preloaded for first paint: the Persian body face and Latin body. */
export const preloadFiles = (): string[] => {
  const { found } = shazdeFiles()
  return found.length
    ? ['/fonts/shazde/' + (found.find((f) => f.weight === 400)?.file ?? found[0]!.file)]
    : ['/fonts/vazirmatn-arabic.woff2']
}

/* `format('woff2')` is correct for both static and variable WOFF2: the spec dropped the
   `-variations` suffix, and engines that never recognised it (Safari) would skip a
   static Shazde face labelled that way. The variable axis is declared by `font-weight`. */
const face = (family: string, file: string, format: string, weight: string, unicodeRange?: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url('/fonts/${file}') format('${format}');` +
  (unicodeRange ? `unicode-range:${unicodeRange};` : '') +
  '}'

const VAZIRMATN_ARABIC_RANGE =
  'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC'
const VAZIRMATN_LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const INTER_LATIN_RANGE = VAZIRMATN_LATIN_RANGE

/**
 * English body copy. Shazde contains Latin glyphs, but "contains" is not "tested at
 * English body sizes", so English stays on Inter until a design owner validates the
 * Latin cut (`docs/TYPOGRAPHY.md` records the check that would flip this).
 */
export const ENGLISH_USES_BRAND_FONT = false

export type FontReport = {
  persianFamily: 'Shazde' | 'Vazirmatn Variable'
  shazdePresent: boolean
  shazdeMissing: string[]
  englishFamily: 'Inter Variable'
  preload: string[]
}

export const fontReport = (): FontReport => {
  const { found, missing } = shazdeFiles()
  return {
    persianFamily: found.length ? 'Shazde' : 'Vazirmatn Variable',
    shazdePresent: found.length > 0,
    shazdeMissing: missing,
    englishFamily: 'Inter Variable',
    preload: preloadFiles(),
  }
}

export const fontFaceCss = (): string => {
  const { found } = shazdeFiles()
  const parts: string[] = []

  if (found.length) {
    // Only the weights actually present are declared; `--font-fa` lists Shazde first.
    for (const entry of found) {
      parts.push(face('Shazde', `shazde/${entry.file}`, entry.format, String(entry.weight)))
    }
  } else {
    parts.push(face('Vazirmatn Variable', 'vazirmatn-arabic.woff2', 'woff2', '100 900', VAZIRMATN_ARABIC_RANGE))
    parts.push(face('Vazirmatn Variable', 'vazirmatn-latin.woff2', 'woff2', '100 900', VAZIRMATN_LATIN_RANGE))
  }

  parts.push(face('Inter Variable', 'inter-latin.woff2', 'woff2', '100 900', INTER_LATIN_RANGE))

  return parts.join('')
}

/** Reminder used by scripts and `/api/health`; never throws, never blocks a build. */
export const missingFontNotice = (): null | string => {
  const { found, missing } = shazdeFiles()
  if (!missing.length) return null
  // A partially installed family must not claim the Vazirmatn fallback: any installed
  // Shazde weight keeps Persian on Shazde, and an absent weight resolves to the nearest
  // installed one (never a synthesised face).
  const persian = found.length
    ? 'the nearest installed Shazde weight'
    : 'Vazirmatn'
  return `Shazde weights not installed (${missing.length}/9): ${missing.join(', ')} — Persian renders on ${persian}. Drop the licensed files into public/fonts/shazde/.`
}

/** Keeps the directory listing meaningful for the report above. */
export const shazdeDirectoryEntries = (): string[] => {
  const dir = shazdeDir()
  return existsSync(dir) ? readdirSync(dir) : []
}
