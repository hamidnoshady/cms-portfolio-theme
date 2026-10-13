# Theme specification — "Arch Two" (working title)

> **Document control.** This is the repository's transcription of the client brief
> `new-architecture-theme-full-prompt.md`. The brief was delivered directly to the
> project rather than as a file upload, so it is recorded here verbatim in substance —
> as the authoritative internal reference for what this theme must do. Where the
> implementation deliberately deviates from a line of the brief, the deviation is listed
> in [`docs/LIMITATIONS.md`](./LIMITATIONS.md) with its reason.
>
> Contract reference: `docs/THEME_API.md` (Eshobe CMS, `contractVersion = 1`).

---

## 1. Product direction

Create a **complete, distinctive, production-quality website theme** for an architecture
studio: a minimal creative portfolio, visually calm and precise, built around content and
line, not around effects.

The visual system:

- **Minimal and creative.** Generous whitespace, restrained motion, expressive typography
  and a recognisable drawing/line system.
- **Line-driven, restrained.** Thin, almost-drawn lines rather than boxes: outlines,
  rules, dividers, small accent marks. The line system is the theme's identity.
- Faces of the system: pure white surfaces, black type and black linework, photography
  keeps its natural colour (never tinted or duotoned).
- No colourful panels, no gradients, no heavy shadows, **no dark-mode feature**
  (`prefers-color-scheme: dark` must keep the exact same designed appearance), no rounded
  decoration: **every corner is square (radius 0)**.
- A deliberate balance of **structural lines** (frames, separators, dividers, rules) and
  **decorative marks** (small ticks, dashes, corner fragments). Not line-free minimalism;
  not a wireframe either — the composition stays delicate.
- Content stays concise: nothing is invented to fill space, and generic purple/gradient
  "AI portfolio" styling is explicitly out of scope.

## 2. Technical stack and constraints

- **Next.js (App Router) + React + TypeScript**, at versions verified to work together.
  Pin the versions in `package.json` and commit the lockfile.
- **Styling:** Tailwind CSS with centralised CSS custom properties + a small set of
  semantic component styles. Tokens live in CSS, not scattered utility soup; spacing,
  colour, type and motion scales are shared.
- **shadcn/ui components** for complex interactions only (Sheet, Breadcrumb, Skeleton,
  Button, Input, Textarea, Label, Pagination, Dialog, Select, Accordion). Restyle them to
  the design system; never leave default rounded-card/gradient styling in place.
- **Motion**: one animation library only (`motion`). It is used where it simplifies a
  transition (entrance, drawer, stagger). No competing animation engines, no scroll
  hijacking, no cursor-tracking.
- **CMS access**: a server-only typed client. No CMS types or fetches leak into client
  components. Use the supplied runtime package for formatting/money/URL/CSS helpers and
  **verify its exports** instead of assuming them (see §18).
- **One package manager** with a committed lockfile. Do not mix npm/pnpm/yarn commands in
  the docs or Dockerfile.
- **Documentation**: installation, configuration, CMS attachment, preview and release
  steps are part of the deliverable, not an afterthought.

## 3. Architecture and layout

- A **full-width navbar** (content and hairline span the viewport) with its own
  independent page-edge gutter, roughly **32–40px on desktop** (smaller on mobile).
- **Content itself is centred in a container with `max-width: 1440px`** plus safe
  gutters, so long lines never stretch across a wide monitor.
- Two separate primitives: `NavbarShell` (full-bleed, its own gutter) and
  `ContentContainer` (centred, max 1440px). Wrappers may nest without creating a
  horizontal overflow; `100vw` is never used as a width.
- Use **logical properties** (`inline-start/end`, `padding-inline`, `margin-inline`) so
  RTL and LTR are the same layout, and content measurement is familiar in both.
- Long-form copy uses a narrower prose measure (roughly 60–72 characters), not the full
  container.
- The **homepage is an exceptional full-viewport entrance stage**, not a standard
  interior page: no normal page header, no stacked marketing sections.

## 4. Foundations (design tokens)

Centralised tokens (CSS custom properties, exposed through Tailwind's theme):

| Token | Value |
|---|---|
| `--surface` | `#ffffff` |
| `--ink` | `#000000` |
| radius | `0` everywhere (no exceptions, including shadcn overrides) |
| content max width | `1440px` |
| page gutter | ~`16px` mobile, `24–40px` desktop |
| card image frame inset | exactly `5px` |
| structural hairline | ~`0.5px` black at ~25–35% opacity |
| decorative line | ~`0.5px` black at ~15–25% opacity |
| emphasis line | ~`1px` solid black, only for active/interactive meaning |
| skeleton fill | ~3–6% black |

Rules:

- Sub-pixel rendering varies by display: at **1×** the hairlines must still read as
  lines. Where a hairline disappears, use the documented fallback (a slightly stronger
  alpha, or a 1px line at lower opacity) rather than thickening every line in the system.
- Secondary text and every semantic colour pair must pass contrast — the decorative
  opacity range is for lines only, never for body text or for the only indication of an
  interactive control.
- Motion tokens (durations, easings) and focus-ring tokens are shared, not per component.
- `themeCss(site.theme)` from the runtime is applied **after** the design system so a
  tenant's brand colour can only recolour tenanted surfaces, never the line system.

## 5. Structural line system

Reusable variants: horizontal separator, vertical separator, image frame, card boundary,
caption rule, active underline.

Where they appear (hierarchy, not decoration):

- a **hairline under the interior navbar**;
- a **baseline above the archive/list**;
- thin **frames around card imagery** (continuous rectangle, inset 5px, image
  edge-to-edge inside it);
- **row rules** between blog/article rows;
- one **vertical divider** on the blog index between the lead story and the latest-notes
  column;
- a **divider between the two contact columns** (desktop only);
- sparse **section and footer rules**;
- **separators between menu rows** in the drawer.

Rules may be hidden by content — nothing breaks structurally if a rule is removed for a
reason, but dividers are never drawn between every element "just in case".

## 6. Decorative line system

A `DecorativeMark` primitive with deterministic variants: short dash, vertical tick,
corner fragment, paired dash, offset L, small crosshair.

- Dash lengths 12–24px, corner arms 10–18px, ticks 8–16px, all hairline weight.
- `aria-hidden`, not focusable, `pointer-events: none`, no per-mark client effects.
- Placement is deterministic (same content → same marks), and marks stay clear of text,
  controls and photography edges.
- Density is reduced on mobile; marks must never overlap or crowd.
- A mark may never be the only boundary or signal of a control.

## 7. Typography

- Persian text uses **Shazde** (`Shazde-*.woff2`) across the weights the licensed assets
  actually provide (weights 100–900 are all used in the type scale *only* where a real
  licensed file exists). Never synthesise a missing weight; never fake it with faux-bold;
  if a weight is unavailable, map it to the nearest licensed weight and report it.
- English uses one verified family (Inter as the base face), chosen centrally in the
  same token system — no per-component font overrides.
- Semantic tokens: display, title, heading, body, navigation, button, field label, card
  title, metadata, caption, error. Components consume tokens, never raw pixel sizes.
- Readable sizes on mobile and at **200% zoom**; Persian never receives global
  `letter-spacing`; mixed fa/en text and Latin/numeric runs use correct bidi isolation.
- Fonts are self-hosted and preloaded/`font-display: swap`; no layout shift (metrics
  matched per face).

## 8. Project structure

```
src/
  app/            routes (server components, thin)
  components/
    ui/           shadcn primitives, restyled
    design/       Container, Rule, DecorativeMark, SectionHeader, Type, Breadcrumbs, Pagination
    layout/       header, footer, logo, language switch, mobile drawer, interior shell
    home/         entrance stage
    projects/     cards, facts, archive pieces
    education/    featured entry, rows
    blog/         lead story, article rows, metadata
    media/        CmsImage, Gallery
    forms/        CMS form renderer
    blocks/       block registry + block components
    states/       empty / error / holding / unreachable + skeletons
  lib/
    cms/          typed server-only client, queries, normalisation
    routing/      locale-aware URL parsing/building, breadcrumbs
    theme/        tokens, line helpers, settings, chrome (nav/footer/logo)
    seo/          metadata, hreflang, sitemap pieces
  styles/         tokens.css, base.css, typography.css, lines.css, structure.css, components.css
tests/            unit/integration tests
```

A development-only component/state showcase is acceptable if useful, but it must never be
public and must never contain credentials or draft fixtures.

## 9. Home experience

- Opens on a white viewport with the **CMS logo** centred (logo asset from the site
  branding) and a **restrained single draw/reveal** of a thin line.
- A small **scroll cue** invites one gesture; **one bounded scroll/swipe** reveals the
  menu (no extra steps, no long timeline).
- On reveal: the logo **shrinks and moves** to its place, fine **menu datum + row rules**
  appear, and menu labels stagger in.
- Menu destinations come from the CMS navigation (header `navItems`), not from hardcoded
  links; a small language switch sits in a corner.
- A visible, discreet **Enter control** plus keyboard access (Enter/Space/ArrowDown) is
  always available — the gesture is never the only way forward.
- Global scroll is not hijacked; returning to home does **not** replay the intro; reduced
  motion shows the final state immediately with a short fade if needed.
- The logo is an `<img>` from the branding (`homeLogo` preferred, `primaryLogo`
  fallback). If no logo exists, the site name is set as a typographic wordmark — never a
  fabricated mark, never inlined unsanitised SVG.

## 10. Projects

- **Archive:** breadcrumbs, modest page title, category controls, project cards,
  pagination. Layout: 4 columns wide, 3 medium, 2 tablet, **2 cards per row on mobile**
  (≈173px cards at 390px with 16px gutters and a 12px gap). Two columns on phones is a
  requirement, not a preference.
- **Card:** edge-to-edge image inside a **continuous 5px-inset fine rectangle** (square
  corners), a couple of tiny corner/dash accents, compact title and real metadata,
  optional caption rule/arrow. Mixed ratios (3:2 landscape, 3:4 portrait, 1:1 square) come
  from **real media dimensions**, and CMS focal points are respected. Stable RTL reading
  order; no masonry that scrambles the order.
- **Detail:** breadcrumbs, title, only real facts (never fabricate location/area/awards/
  year), a controlled hero ratio, the rich-text body, gallery, and related projects.

## 11. Education

- One **restrained featured entry** plus **compact horizontal entries** (small thumbnail
  inline-start, real metadata, thin separators, occasional dashes).
- Honest reading time; video duration only from valid media metadata.
- Filters only when the CMS has real categories; no enrolment/payments/certificates.
- Detail entries reuse the shared article/entry renderer (rich text, embedded media,
  optional related).

## 12. Blog

- Text-led. A **lead story** plus a **latest-notes column**, split by a fine vertical
  line on wide screens; below them, **article rows** with small thumbnails, thin
  separators and occasional dashes.
- Small category controls and pagination. Nothing decorative in the reading column:
  titles, real metadata, rule-separated items.
- Article pages: prose inside the 1440px container at a narrower measure, metadata,
  rich text, embedded media, optional related posts, translated URLs.

## 13. About

- Deliberately sparse: breadcrumbs, modest title, one short intro, one small studio image
  of roughly **40–45% of desktop content width** in an inset frame, and one discreet
  contact link, surrounded by substantial whitespace.
- No team grid, no statistics, no awards timeline, no multi-section philosophy page in the
  default rendering.
- If the CMS page actually has blocks configured, they still render below the sparse
  composition — the theme never silently drops customer content.

## 14. Contact

- Breadcrumbs, a concise title/invitation, **only real details from the CMS**, and a
  compact CMS-defined form.
- Two columns on desktop separated by one fine divider; stacking cleanly on mobile.
- Underline-style fields with visible labels, accessible focus, field-level errors,
  pending/success/failure states, a small square black submit control; duplicate submits
  are prevented and entered values survive a recoverable error.
- Never invent an address, phone number or email. Email/phone direction is isolated so
  numbers and addresses render correctly in both RTL and LTR.

## 15. Navbar, drawer, breadcrumbs

- Full-width navbar, CMS-driven items, direction-aware: Persian identity/brand on the
  right with controls and language switch at the left; English mirrored.
- Active item underline. Mobile menu button is two lines that become a sharp X.
- Drawer slides from the right in Persian and the left in English, **~250–350ms**, with
  fine edge/row lines, small ticks, subtle stagger and the language switch near the
  bottom. Focus trap, Escape to close, focus restoration, scroll-lock cleanup, large
  touch targets, closes on route change; fully operable with reduced motion.
- Breadcrumbs on all interior pages (never on the home stage), translated labels,
  `aria-current` on the leaf, linked parents, predictable truncation.

## 16. Skeletons, loading and states

- Shared skeletons matching the real geometry they replace (including **two mobile
  project columns**, the 1440px content width and the navbar), 3–6% black fill, square
  corners, gentle opacity pulse (static under reduced motion), no shimmer gradients.
- Real Suspense/loading boundaries per route; the shell and breadcrumbs stay visible.
- Skeletons always resolve into content or into an empty/error/holding state — never an
  endless skeleton. The home stage uses its entrance instead of skeletons.
- Empty, error, holding (suspended site) and CMS-unreachable states share one visual
  language; nothing fakes portfolio content while the CMS is unavailable.

## 17. UI components (shadcn)

Sheet (drawer), Breadcrumb, Skeleton, Button, Input, Textarea, Label, Pagination, Dialog,
Select (real filters), Accordion (real FAQ content). Each is restyled to radius 0, white
surfaces, black hairlines and the semantic type scale, and re-checked for accessibility
after the restyle.

## 18. CMS connection and data contract

- Bootstrap with `GET /api/site` before first paint; validate `contractVersion`,
  lifecycle status, `availableLocales`, block allowlist, media origin and the theme
  descriptors (`themeRuntime.theme/package/settings/bindings`). Handle missing optional
  fields without crashing.
- Use only endpoints that exist in the contract: pages, posts, categories, header,
  footer, media, forms and site. **Do not invent `/api/projects` or `/api/team`.** The
  projects/education/blog areas are modelled as categorised posts (or a genuinely
  documented extension), and the theme documents its slug/category conventions so the
  mapping is configurable. If the CMS offers content-slot bindings they may be used; a
  bound document id always wins over a slug guess, and a missing/untranslated bound
  document must never silently fall back to a different document that happens to share a
  slug.
- Preserve block ids/order; render through one block registry. Unknown or disallowed
  block types are skipped with a diagnostic, never rendered as raw JSON.
- Rich text is rendered from the CMS's Lexical structure with per-field `dir`.
- Dates, numbers, phone digits and prices go through the runtime helpers; money is
  integer minor units of `site.store.currency`. (This theme does not advertise store
  support: no products, cart, checkout or receipts are implemented.)

## 19. Preview, caching and security

- The tenant comes from a trusted `Host` or a server-side site credential, **never** from
  a visitor query or body parameter.
- Credentials are server-only and runtime-only: never in the browser bundle, never in a
  build layer, never in a log.
- Public rendering excludes drafts; preview bypasses shared caches and is `noindex`.
- Caches are partitioned by tenant, locale, query and public-vs-preview.
- Signed revalidation: HMAC over the raw body, with a bounded TTL as fallback.
- Unknown hosts fail closed. A `suspended`/`archived` site renders a noindex holding state
  with no portfolio content. An outage never produces a fake studio identity.

## 20. Manifest

- A root `eshobe.theme.json` matching the verified parser (`docs/THEME_API.md` §17b):
  `contractVersion`, a neutral placeholder `key` (renamable when the product name is
  final), `name`/`nameFa`, `siteTypes`, `locales`, `proxiesApi`, `capabilities`,
  `design`, `build` (port, health path), `settings`, `contentSlots`.
- Claim only what is implemented: site types, locales and capabilities must reflect the
  real feature set.
- Platform-injected environment variables stay runtime configuration; `env` entries only
  declare tenant-supplied values.
- Document installation, configuration, CMS attachment, preview and production release,
  plus rollback/versioning and secret handling.

## 21. Routing, i18n and SEO

- Routes: home, projects index/detail, education index/detail, blog index/article, About,
  Contact, generic CMS pages, and the required utility routes.
- **Persian is the default and unprefixed; English is served under `/en`.** An unsupported
  locale returns 404 rather than silently rendering the default language.
- All URLs come from centralised helpers (menus, cards, rich text, breadcrumbs, metadata,
  language switch, sitemap) — no string-concatenated links in components.
- Real metadata per page and per tenant, `hreflang` only for translations that exist,
  paginated sitemap, accurate canonicals. Preview and holding states are `noindex`.

## 22. Responsive behaviour, accessibility and motion

- Verify at **320, 375–390, 768, 1024, 1440 and 1920** px: no horizontal overflow, no
  clipped content, readable line lengths.
- Semantic structure, real labels, keyboard operation for every control, visible focus,
  sufficient contrast, alt text for meaningful images, and content that remains visible
  and usable when enhancements fail.
- Motion is restrained and compositor-friendly; reduced-motion is honoured everywhere.

## 23. Development process

Work iteratively in the order above and fix real defects as they appear: duplicated or
dead code, invalid routes, unsupported manifest claims, data mismatches, draft leaks on
public paths, portrait images cropped into landscape frames, typography drift, loading
layout shifts, menu/route cleanup, unnecessary dependencies. Remove code that is confirmed
unused rather than leaving it dormant.

## 24. Verification and deliverables

- Run typecheck, lint, meaningful tests and a production build.
- Focused tests: tenant/publication resolution, binding and locale resolution, signed
  preview/revalidation, API/form handling, and critical responsive interactions.
- Browser QA in both languages, including 200% zoom, reduced motion, missing logo/image,
  slow or unavailable CMS, empty archives, invalid forms and long labels.
- **Evidence must be real browser screenshots** (home entrance/menu, projects desktop and
  mobile, education, blog, About, Contact, mobile drawer, skeletons) — generated mockups
  are not acceptable evidence.
- Deliver: working source, reusable components, central tokens/typography, a
  CMS-compatible manifest, setup/attachment documentation, test results and an honest
  limitations list.
- **No deployment, domain change or publication** is part of this work.
