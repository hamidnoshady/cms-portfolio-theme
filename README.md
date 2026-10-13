# Bang Portfolio — Eshobe CMS portfolio theme

Estudio Bang-inspired portfolio theme for Eshobe CMS (`eshobe.theme.json` key `bang-portfolio`, contractVersion 1).

- Black-and-white interface, natural-color photography, sharp corners, sparse composition.
- Home curated image composition with one accessible link per work, Browse Projects action, reduced-motion + static fallback.
- Archives: desktop numbered list with photographic preview (hover and focus stay in sync), mobile photographic cards. Projects and Objects share one case-study implementation.
- Case studies: semantic H1 + decorative repeat (hidden from AT), year/type/location/collaborators + facts, narrative, responsive media, related work, inquiry CTA, native share with clipboard fallback.
- About with CMS Team block + accessible biography panels (explicit close, focus restore, Escape). Contact + Careers from CMS forms. Legal long-form with no fixed controls covering text.
- CMS owns content/media/forms/auth/tenants/publishing/branding; theme owns routes/rendering/motion/a11y/SEO/relays/preview/health.

## Target languages

Persian (`fa`, default, RTL) and English (`en`, LTR) — the locales the inspected CMS supports (`src/lib/locales.ts` registers only `fa`/`en`). Spanish parity is **not** claimed: it requires platform-wide `es` support, not a theme-only fake.

## Routes

`/`, `/about`, `/projects`, `/objects`, `/projects/[slug]`, `/objects/[slug]`, `/contact`, `/careers`, `/legal` with locale variants (`/en/...`). One route builder (`src/lib/routing/paths.ts`) serves navigation, archives, related work, language switch, metadata, sitemap, previews, redirects. Legacy `/projects/raw` → `/objects/raw`.

## Content slots (`eshobe.theme.json`)

`home`, `about`, `contact`, `careers`, `legal` (pages); `projectsCategory`, `objectsCategory` (categories); `contactForm`, `careersForm` (forms). Resolved via `/api/site`. Missing bindings render meaningful empty states, never fabricated content.

## Forms

Fields/labels/required/options render from CMS definitions. States: `idle → invalid | submitting → accepted | recoverable error`. Labels stay visible, errors associated, first invalid focused, status announced, values preserved, double-submit prevented.

**Company/honeypot fix:** `company` is legitimate. The canonical CMS honeypot is `__eshobe_website_check` (`src/lib/public-form-fields.ts` in eshobe-cms). The theme uses it, never treats `company` as spam, and excludes reserved names from submission data. Regression tests prove a non-empty Company submits normally.

## Security

Server-side tenant isolation (site key is the tenant), published-only public reads (`_status=published` even with site key), proxy path/method allowlist, same-site validation for pages/posts/categories/media/forms/bindings, private uncached previews, signed raw-body revalidation, bounded relay bodies, process-local rate limit (single instance; multi-replica needs edge throttling — see `docs/DEPLOYMENT.md`). Secrets stay server-only.

## Develop

```bash
npm ci
npm run dev
npm run verify   # manifest + typecheck + lint + tests + build
ESHOBE_DEV_FIXTURES=1 npm run dev   # offline fixtures
```

## Docs

- `docs/bang-eshobe-rebuild-plan.md` — audit + rebuild specification (planning reference).
- `docs/CONTENT.md` — content model, slots, editor workflows, provisioning.
- `docs/DEPLOYMENT.md` — configuration, Docker, health, CI/image, rollback.
- `docs/THEME_API.md`, `docs/SPEC.md` — inherited platform contracts.

## Verification

See `docs/QA.md` for what was actually run. Final report sections (Implemented; Bugs fixed; Architecture; UX/UI; Security; Dead code; Tests; Verification/CI; Remaining issues) are in the delivery message.
