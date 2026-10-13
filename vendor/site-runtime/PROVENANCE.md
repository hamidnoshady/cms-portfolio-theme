# Vendored `@eshobe/site-runtime`

Source: `hamidnoshady/eshobe-cms` — `packages/site-runtime`
Commit: `7fde24352905717995cd26d1f8ff29b8cce0cc3b` (2026-10-02)
Version: `0.1.0` · License: MIT (see the CMS repository)

## Why vendored

The package is **not published to npm** (`npm view @eshobe/site-runtime` → 404 at the time of
writing). The CMS project owner distributes it from the CMS repository, and the platform's own
reference theme vendors it the same way (`vendor/site-runtime`). This directory is a verbatim
copy — no source file was edited. `src/` is kept so the implementation can be audited, `dist/`
is what `package.json#exports` resolves.

## Updating

```bash
# from a checkout of hamidnoshady/eshobe-cms
cp -r packages/site-runtime/{src,dist,package.json,LIMITATIONS.md} <theme>/vendor/site-runtime/
```

Then re-run `npm run typecheck && npm test` — `src/lib/runtime/contract.test.ts` pins the
exported surface this theme actually consumes.

## Building

`dist/` is a **build output and is not committed**: `vendor/site-runtime/tsconfig.json` is
included here, and `npm run vendor:build` compiles `src/` to `dist/`. Every npm script that
resolves the package (`typecheck`, `lint`, `test`, `build`) runs that step first, so a fresh
clone works with `npm ci && npm run verify` and nothing has to be kept in sync by hand.

## Verified export surface (this theme relies on)

`contractVersion`, `formatDate`, `formatNumber`, `formatPrice`, `toLocaleDigits`,
`themeCss`, `isHexColor`, `siteBlocks`, `blockSlugsForSiteType`, `dirFor`, `localeHref`,
`slugify`, `slugifyField`, `HOME_SLUG`, `pagePath`, `postPath`, `RESERVED_PAGE_SLUGS`,
`currencies`, `currencyCodes`, `isCurrencyCode`, `parsePrice`, `majorToMinor`,
`minorToMajor`.

**Not exported**, although `docs/THEME_API.md` §11 shows them from this package:
`resolveSiteRoute`, `sitePath`, `siteUrl`, `siteOrigin`, `revalidationPaths`
(those live in the CMS app at `src/lib/slug.ts` / `src/lib/site-url.ts`). This theme
therefore implements route resolution and URL building locally in `src/lib/routing/`.
