/**
 * The theme's single doorway to `@eshobe/site-runtime`.
 *
 * Every date, number, price, slug and URL rule goes through here, so no component
 * imports `Intl` or re-implements a Persian-safe slug. The package is vendored (it is
 * not published to npm — see `vendor/site-runtime/PROVENANCE.md`) and its real export
 * surface is pinned by `src/lib/runtime/contract.test.ts`.
 */
export {
  contractVersion,
  currencies,
  currencyCodes,
  dirFor,
  formatDate,
  formatNumber,
  formatPrice,
  HOME_SLUG,
  isCurrencyCode,
  isHexColor,
  localeHref,
  majorToMinor,
  minorToMajor,
  pagePath,
  parsePrice,
  postPath,
  RESERVED_PAGE_SLUGS,
  siteBlocks,
  blockSlugsForSiteType,
  slugify,
  slugifyField,
  themeCss,
  toLocaleDigits,
} from '@eshobe/site-runtime'

export type { Theme } from '@eshobe/site-runtime'
