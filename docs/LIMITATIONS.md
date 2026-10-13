# Limitations and deviations

> Honest inventory of everything in this theme that is **not** verified, **not** the
> obvious choice, or **not** possible in the environment it was built in. Written for
> whoever installs it next: every entry states what was done, why, and what it would take
> to close the gap. Nothing here is a wish list — each item is a decision that was made
> deliberately after the alternative failed or was rejected.

Verified against: `Eshobe CMS` @ `7fde2435` (`contractVersion = 1`), Node 22.22, Next 16.3.8.
Evidence for the claims below is in [`docs/QA.md`](./QA.md) and `docs/screenshots/`.

---

## 1. Fonts — Shazde is installed locally (licences stay the deployment's)

**The brief asks for Shazde 100–900, used only at weights whose licensed files exist.**

Shazde is a commercial Persian family. No licensed WOFF2 file is obtainable in this build
environment, and generating a substitute was explicitly rejected (faux weights are a
visual defect, not a fallback). So:

- **Persian renders on Vazirmatn Variable** (SIL OFL, files committed under
  `public/fonts/`, provenance in `public/fonts/PROVENANCE.txt`). It is a variable font, so
  the full 100–900 range is real — no synthesised weights, no oblique faking.
- **The `@font-face` list is data, not markup.** `src/lib/theme/fonts.ts` declares the nine
  Shazde weights with their documented `Shazde-<Weight>.woff2` filenames and a per-weight
  licence note. Dropping licensed files with those names into `public/fonts/shazde/`
  switches the Persian family over with no code change; see `public/fonts/shazde/README.md`.
- **Missing weights are reported, never guessed.** At boot, `fontReport()` lists which
  weights are absent and the theme logs one line in development. A weight that is not
  licensed falls back to the *nearest licensed* weight rather than a synthesised one.
- **English uses Inter Variable** (OFL) — one central family, per the brief.
- **Persian never gets letter-spacing** (`letter-spacing: normal` is pinned on
  `html[lang='fa']`), and no Persian text is set in a weight above the licensed range.

**Originally unverified (superseded below):** at the time of this build the theme had never
rendered in Shazde. The typographic *scale* it was designed against (size, leading, measure,
hierarchy) was verified on Vazirmatn, which is metric-different. The hero and 1440px display
sizes were re-checked after the licensed files were installed — see the update note below.

> **Update — 2026-10-04 (local dev).** The licensed **Shazde Pro** files are now installed
> in `public/fonts/shazde/` (weights 300–900) and the theme was re-run against the
> `eshobe-cms` dev server. All seven installed faces load (`Shazde-*.woff2`, HTTP 200),
> Persian resolves to Shazde as the first face in `--font-fa`, and the home hero renders on
> real Shazde metrics. Thin (100) and ExtraLight (200) are not part of the licensed family
> and are reported missing; the type scale never requests them. Mapping and provenance:
> `public/fonts/shazde/README.md`.

## 2. Development-mode hydration cannot be verified in this sandbox

`next dev` in this environment serves a client bundle whose HMR websocket the sandbox
proxy answers with `ERR_INVALID_HTTP_RESPONSE`, so React never hydrates **in dev**. This is
a sandbox networking property, not a theme defect: `next dev` is unmodified, no HMR code
was touched, and the exact same source hydrates correctly in a production build.

Consequences:

- All interactive behaviour (home entrance → menu, drawer, focus trap, form states,
  reduced motion) is verified against `next build` output served by
  `.next/standalone/server.js`. See §7 of `docs/QA.md`.
- **`npm run dev` is still the documented development command**, and the fixture layer
  (`ESHOBE_DEV_FIXTURES=1`) exists for it. What could not be verified here is dev-mode
  hydration specifically — expect it to work (nothing is conditional on the build mode
  except HMR itself), but it was not observed.

> **Update — 2026-10-04.** On a host without the sandbox websocket limit, `next dev` was
> observed hydrating and behaving: the contact form produced field-level errors on an
> invalid submit (no native GET), and the interaction audit passed 9/9 against the live dev
> server at the time (it now runs 21 checks — `docs/QA.md` §2).

## 3. The fixture layer is development-only, so production QA needs a mock CMS

`ESHOBE_DEV_FIXTURES=1` is gated by `NODE_ENV !== 'production'` **by design** — a production
build must never be able to serve synthetic content. That is correct for the product, and
inconvenient for QA, so the same fixture encoder is also exposed as a real HTTP service:

```bash
node --experimental-strip-types scripts/mock-cms.mjs --port 4010 --origin http://127.0.0.1:3200
```

`scripts/mock-cms.mjs` and `scripts/qa-servers.sh` are **QA tools**: never imported by the
theme at runtime, never referenced from `src/`, and not part of the production bundle. The
frozen fixture documents contain only placeholder identity (`استودیوی نمونه`, `example.com`,
`+98 21 1234 5678`) — no customer name, logo, address or project data.

**Unverified:** the theme has never been pointed at the real CMS. Everything derived from
`docs/THEME_API.md` is implemented and unit-tested against recorded shapes, and the mock
serves those same shapes, but a real descriptor with real data has not been read.

## 4. Redirects and status codes need the proxy

`redirect()` and `notFound()` inside a Server Component always produce a **streamed 200**
once a `loading.tsx` boundary exists, and an early return from `generateMetadata` does not
set a status either. Both were measured. Therefore the *real* status codes live in
`src/proxy.ts`:

- unknown single-segment paths → the designed 404 page with a real `404` status
  (via an internal rewrite to `/arch-not-found`);
- `/posts/<slug>` → a real `307` to `/blog/<slug>`, `/home` → `307` to `/`;
- a locale prefix the site does not serve → `404`;
- `suspended` / `archived` sites → `200` + `noindex` holding, no portfolio content.

**Cost:** the proxy performs one CMS probe (`/api/pages?where[slug][equals]=…`) with a 4s
timeout and a 30s revalidation window to tell "a CMS page that exists" from "unknown path".
It is skipped in preview mode and when dev fixtures are on. If a deployment strips the
proxy (for example by putting the theme behind a host that rewrites before Next sees it),
those statuses degrade to 200-with-designed-body.

**Also note:** `error.tsx` catches render errors, but Next's client-side error boundary is
not a 500 responder in the streaming model; a genuine server failure returns the error page
with whatever status the framework assigns.

## 5. `next start` vs `.next/standalone`

The theme ships `output: 'standalone'`. `next start` works for a local smoke test but does
**not** include `public/` or `.next/static` in the relocated bundle, so a bare
`next start` from the standalone directory serves HTML with no CSS and no hydration.
`npm run prepare:standalone` copies both into `.next/standalone`, and that is what
`npm run start:standalone`, the manifest's `startCommand` and every QA run use. An operator
following a generic Next tutorial will hit this — it is documented in `README.md` and is
why the manifest does not use plain `next start`.

## 6. Route resolution and URL building are implemented locally

`docs/THEME_API.md` §11 shows `resolveSiteRoute`, `sitePath`, `siteUrl`, `siteOrigin` and
`revalidationPaths` as coming from `@eshobe/site-runtime`. They are **not exported by the
published package** (verified against the vendored source). The theme therefore implements
route resolution, canonical URLs and breadcrumbs in `src/lib/routing/`, and
`vendor/site-runtime/PROVENANCE.md` records the exact divergence. When the runtime exports
them, `src/lib/routing/` is the single place to delete.

`@eshobe/site-runtime` is **vendored** (`file:vendor/site-runtime`) because it is not
published to npm. `vendor/site-runtime/dist` is a build output and is not committed;
`npm run vendor:build` (wired into `typecheck`, `build`, `lint` and `test`) compiles it from
the committed `src/`.

## 7. Media, images and `next/image`

There is **no `images` block in `next.config.ts`**, by design: the theme does not proxy or
re-encode media. `CmsImage` renders a plain `<img>` against the CMS media origin with a
`srcSet` built from the CMS's own size names, because the documented media contract already
publishes sized variants and adding `next/image` would put a second cache in front of a
CDN that already exists.

Consequences and their honest status:

- `mediaOriginAllowed()` validates the resolved URL against `site.media.origin`; a mismatch
  renders the alt text rather than a broken image. Covered by `tests/media.test.ts`.
- **Unverified:** behaviour against the real CDN's size names and cache headers. The
  fixtures serve same-origin files from `public/qa/media/`.
- Photos keep their colour (the QA placeholders were regenerated as colour precisely so
  this is visible in the screenshots).
- **The lightbox shows the medium's largest documented size.** It is a plain `<img>` with
  the same `srcSet` as the thumbnail and `sizes="100vw"`; there is no separate
  "original" request and no zoom/pan. Captions are not repeated inside the lightbox — the
  figure's caption stays on the page where the editor wrote it.
- **The gallery block's rows are read in two shapes.** The contract documents `images` as
  populated media; a Payload array field delivers `{ image: <Media> }` rows (the fixtures
  do). Both render; an id-only entry (depth 0) is skipped rather than guessed at.
- **Logo artwork with internal transparent padding reads smaller than the token.** The
  mark is sized by height (`--logo-block`, 42/46/52px) with `width: auto`; the theme
  never crops or scales an asset by its visible bounds, so padding inside the file is the
  customer's to trim. A very wide wordmark-style asset is capped by `--logo-max-inline`
  and letterboxed with `object-fit: contain` rather than allowed to push the navigation.
- **Six long Persian nav labels wrap at 768px.** The fixture header's six labels need
  ~579px of list width at tablet size, more than the bar can give them next to the mark
  and the language switch, so the desktop nav list wraps onto a second row by design
  (`flex-wrap`) and the bar grows instead of overflowing. This was already the case on
  the previous layout in this environment (513px of room, measured on the base commit);
  the refactor leaves the list 51px more (564px). The earlier committed `07-projects-768`
  shot shows the same labels on one line, so label metrics evidently differed on that
  machine. Not a layout defect — nothing overflows and the rule below the bar stays
  aligned — but a header with six items this long is at the limit of what 768px holds.

## 8. Store, payments and e-commerce

The manifest claims `siteTypes: ["portfolio"]` and five capabilities (`blog`,
`contactForm`, `education`, `projects`, `search`). **Nothing commercial is claimed or
implemented**: no cart, no checkout, no prices, no `productGrid` rendering (the block is
skipped with a diagnostic if a site's allowlist includes it). `site.store.currency` is read
only so a price field, if one ever arrives, is formatted correctly by
`src/lib/runtime/`.

## 9. What the theme deliberately does not do

Kept here because each one looks like an omission until you know it was a decision:

- **No dark mode.** `prefers-color-scheme: dark` renders the identical designed appearance;
  the token layer has no dark branch to switch on.
- **No gradients, no coloured panels, no shadows, no rounded corners** on any surface. The
  shadow token scale is intentionally empty and `radius: 0` is forced globally.
- **No newsletter, no fake statistics, no marketing sections, no "team" prose.** The About
  page is the sparse composition the brief specifies; CMS-configured blocks still render
  below it, because dropping customer content is worse than an extra section.
- **No map embed.** A `contact` block's `mapUrl` is rendered as a real link; an iframe would
  need a `frame-src` CSP entry and would ship the visitor's IP to the map provider on load.
- **No second animation engine.** One library (Motion) for the interactions that need it;
  CSS handles the rest. Adding a second would double the bundle for no interaction the
  brief asks for.
- **No `global-not-found.js`.** Deliberate: it escapes the root layout, which would drop
  the theme's own document, fonts and tokens from the 404 page.
- **No development-only showcase route.** §8 permits one ("acceptable if useful") but does
  not require it. Every state it would display — skeletons, empty archives, holding,
  unreachable CMS, invalid form, long labels, missing logo, reduced motion — is already
  produced by the fixture CMS and captured or asserted by `scripts/screenshots.mjs`,
  `scripts/a11y-audit.mjs` and `scripts/interaction-audit.mjs`, so a second surface would
  add a route that must never be public without proving anything new.
- **No invented CMS endpoints.** Only the documented `/api/site`, `/api/pages`,
  `/api/posts`, `/api/categories`, `/api/forms/:id`, `/api/search`, `/api/header`,
  `/api/footer`, `/api/form-submissions` and `/api/revalidate` are called. Projects,
  education and notes are all categorised posts, as the contract prescribes.

## 10. Unverified by environment, summarised

| Claim | Status |
| --- | --- |
| Shazde typography | installed in this working copy (300–900); 100/200 do not exist in the licensed family — see §1 and `docs/TYPOGRAPHY.md` |
| Real CMS content | **re-verified live on 2026-10-04** (routes, a11y 11/11, interactions 9/9 at the time, manifest parsed) — see `docs/QA.md` §8; the interaction harness now runs 21 checks (§2) |
| Dev-mode hydration | not observable in the original sandbox; **exercised live on 2026-10-04** (form validation and interaction audit against `next dev`) — see `docs/QA.md` §8 |
| Real media CDN | not available; same-origin placeholders used |
| Deployment (Coolify / GHCR) | **not performed** — no deployment was requested; tag-driven GHCR publishing now exists (`.github/workflows/publish-image.yml`), the image was built and smoke-tested locally against the mock CMS, but nothing has been pushed and the manifest still declares no `deployment` block |
| Real preview token from the CMS | not available; the HMAC path is unit-tested |
| Legal / accessibility audit by a third party | not performed |
