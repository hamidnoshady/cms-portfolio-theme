# Shazde — drop-in slot

The theme is designed for **Shazde** as the Persian product family across weights
**100–900**. Those files are licensed and are not part of the open fonts the repository
redistributes, so the loader looks for them here at build time and reports any absent
weight (`GET /api/health` → `fonts.missing`, plus a development-only boot warning).

## Installed weights

The licensed **Shazde Pro** WOFF2 statics are installed for weights **300–900**:

| CSS weight | File | Supplied cut |
| --- | --- | --- |
| 300 | `Shazde-Light.woff2` | Light |
| 400 | `Shazde-Regular.woff2` | Regular |
| 500 | `Shazde-Medium.woff2` | Medium |
| 600 | `Shazde-SemiBold.woff2` | SemiBold |
| 700 | `Shazde-Bold.woff2` | Bold |
| 800 | `Shazde-ExtraBold.woff2` | **UltraBold** (the family's true 800 cut, `usWeightClass = 800`) |
| 900 | `Shazde-Black.woff2` | Black |

Notes:

- **Thin (100) and ExtraLight (200) are not part of the licensed family.** The loader
  reports both missing; a request below 300 resolves to the nearest installed weight
  (Light 300). Nothing is ever synthesised. The theme's scale only calls 400/500/600.
- The family's own `ExtraBold` cut is **not** installed: its OS/2 weight is also 900, and
  the Black cut fills the theme's 900 slot.
- To install a different set, drop the files here using exactly the nine names below.

## Expected filenames

```text
public/fonts/shazde/Shazde-Thin.woff2        /* 100 */
public/fonts/shazde/Shazde-ExtraLight.woff2  /* 200 */
public/fonts/shazde/Shazde-Light.woff2       /* 300 */
public/fonts/shazde/Shazde-Regular.woff2     /* 400 */
public/fonts/shazde/Shazde-Medium.woff2      /* 500 */
public/fonts/shazde/Shazde-SemiBold.woff2    /* 600 */
public/fonts/shazde/Shazde-Bold.woff2        /* 700 */
public/fonts/shazde/Shazde-ExtraBold.woff2   /* 800 */
public/fonts/shazde/Shazde-Black.woff2       /* 900 */
```

Rules the loader enforces (`src/lib/theme/fonts.ts`):

- A missing file is **not** substituted with another weight. The theme reports the exact
  missing filenames and, when nothing is installed, falls back to Vazirmatn for Persian.
  No weight is ever synthesized.
- Shazde is used for Persian UI and for the brand lockup in both languages. English body
  text stays on Inter; Shazde's Latin glyphs are not used for English body copy.
- Declare Latin quality before switching English to Shazde: change
  `ENGLISH_USES_BRAND_FONT` in `src/lib/theme/fonts.ts`.
