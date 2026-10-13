# Typography

How the theme loads, maps and applies type. The implementation is
[`src/lib/theme/fonts.ts`](../src/lib/theme/fonts.ts) (loading and the weight map) and
[`src/styles/typography.css`](../src/styles/typography.css) +
[`src/styles/tokens.css`](../src/styles/tokens.css) (roles and values).

## Families

| Locale | Family | Source | Weights |
| --- | --- | --- | --- |
| Persian (`fa`, default) | **Shazde** | Licensed Shazde Pro WOFF2, installed by the deployment under `public/fonts/shazde/` | 300–900 (the licensed family has no 100/200) |
| Persian fallback | **Vazirmatn Variable** | OFL, shipped in `public/fonts/` | 100–900, variable |
| English (`en`) | **Inter Variable** | OFL, shipped in `public/fonts/` | 100–900, variable |

`--font-fa` lists `'Shazde', 'Vazirmatn Variable', …`; `--font-en` lists Inter. English body
copy stays on Inter — Shazde's Latin glyphs are not used for English body text until
`ENGLISH_USES_BRAND_FONT` in `src/lib/theme/fonts.ts` is flipped after a Latin-cut review.

## Installed Shazde files and their real weights

The loader looks for exact filenames at build time; the physical cut placed in each slot
was verified against the font's `OS/2.usWeightClass` (see `public/fonts/shazde/README.md`):

| CSS weight | Installed file | Supplied cut | `usWeightClass` |
| --- | --- | --- | --- |
| 300 | `Shazde-Light.woff2` | Light | 300 |
| 400 | `Shazde-Regular.woff2` | Regular | 400 |
| 500 | `Shazde-Medium.woff2` | Medium | 500 |
| 600 | `Shazde-SemiBold.woff2` | SemiBold | 600 |
| 700 | `Shazde-Bold.woff2` | Bold | 700 |
| 800 | `Shazde-ExtraBold.woff2` | **UltraBold** | 800 |
| 900 | `Shazde-Black.woff2` | Black | 900 |

**Thin (100) and ExtraLight (200) do not exist in the licensed family.** The loader reports
them missing through its local diagnostics and one development-only console line; the health
route is intentionally limited to process readiness and has no font/CMS dependency. The
browser resolves a request below 300 to the nearest installed weight (Light 300).
No weight is ever synthesised, and no file is silently mapped onto another weight.

## Roles and values

Semantic tokens own every text treatment; components never declare raw `font-size` or
family stacks:

| Role | Token | Applied weight | Notes |
| --- | --- | --- | --- |
| Display | `--text-display`, `--leading-display` | `--weight-display` (500) | clamp 2.25–4.25rem |
| Title | `--text-title` | 500 | clamp 1.75–2.625rem |
| Heading | `--text-heading` | 500 | clamp 1.3125–1.75rem |
| Subheading | `--text-subheading` | 500 | clamp 1.125–1.375rem |
| Body / body-lg | `--text-body`, `--text-body-lg` | 400 | Persian leading 1.8 / 1.85 |
| UI / nav / button | `--text-ui` | 500 | 0.875rem |
| Field label | `--text-label` | 500 | 0.8125rem |
| Metadata / caption | `--text-meta`, `--text-caption` | 400 | 0.75–0.8125rem |
| Strong | — | `--weight-strong` (600) | inline emphasis |

Hierarchy is size + space + colour first, weight second: the working scale only calls
**400 / 500 / 600**, which is why the absent 100/200 slots have no visual effect.

- Persian line height is 1.8 (1.85 for large body); English tightens it in
  `html[lang='en']`.
- Letter-spacing is pinned to `normal` on `html[lang='fa']`; label tracking is Latin-only.
- Dates and digits go through `@eshobe/site-runtime` formatters, and numeral strings are
  isolated per the locale helpers — no raw font family switching in components.

## Loading

- `src/app/layout.tsx` emits the `@font-face` CSS by hand (a conditional
  `next/font/local` call would fail the build wherever the licensed files are absent) and
  preloads **one** Persian file (Regular, or the first installed Shazde weight) plus
  nothing else — never all nine weights.
- `font-display: swap`; the skeleton geometry reserves text space so a late font swap does
  not shift layout.
- Missing files never block a build: `fontReport()` is diagnostics, not a gate.

## Verification

- Browser: every installed `Shazde-*.woff2` loads (HTTP 200) and
  `getComputedStyle(body).fontFamily` starts with `Shazde` on the Persian site
  (2026-10-04, against the live `eshobe-cms` dev server).
- `fontReport()` remains a local diagnostic for partial installs; `/api/health` is kept
  process-only so deployment health never depends on fonts or the CMS.
- The scale/screenshots in `docs/QA.md` were captured on Vazirmatn before the licensed
  files were installed; the hero is re-checked after any weight-set change (see
  `docs/LIMITATIONS.md` §1).
