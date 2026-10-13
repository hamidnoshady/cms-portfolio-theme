# CMS Portfolio Theme: Estudio Bang audit and Eshobe rebuild plan

Audit date: 13 October 2026. Reference: https://bybang.co/

Target repository: https://github.com/hamidnoshady/cms-portfolio-theme

Status: proposed rebuild specification and implementation prompt. The public theme has not been implemented in this repository.

## 1. Executive Summary

Recommendation: build a dedicated Eshobe portfolio theme that preserves Bang’s photography, monochrome interface, sparse composition, image canvas, and expressive typography, while improving navigation, accessibility, forms, and mobile readability. Reuse the existing Eshobe CMS platform and proven theme contracts. Avoid replacing the current architecture wholesale or creating a second CMS.

Three approaches:

| Approach | Benefit | Cost / trade-off |
|---|---|---|
| Dedicated Bang-inspired Eshobe theme — recommended | Strong visual fidelity with explicit content bindings and improved usability | Requires a custom canvas, archive presentation, and detail animation |
| Strict visual and behavioral reproduction | Closest reference match | Carries forward ambiguous URLs, repeated interactive canvas content, and awkward overlay navigation unless deliberately corrected |
| Reskin the existing architecture theme | Fastest reuse of routing, CMS access, preview, and forms | Its current presentation and education/blog sections do not match Bang; still requires substantial presentation work |

This is a planning audit, not a completed rebuild or exhaustive security certification. Every primary public section was inspected; two representative case studies were opened. The original Bang GitHub repository was not supplied or identified. Its private admin, services, database, and original test suite are unverified. No contact or careers submissions were sent. Email delivery, Share destination/clipboard success, every individual gallery item, reduced-motion behavior, real devices, and measured Core Web Vitals remain unverified.

Eshobe’s actual current GitHub code was inspected, independently of the older local checkout:

- CMS main: `4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60`.
- Candidate reusable theme main: `34cde1b1d3f9345bf14d420eacb5665a2c0f15af`.
- Local CMS checkout is older (`9a9a3375…`) and has existing uncommitted changes. It was not modified.
- Shell cloning failed because the configured network proxy was unavailable; GitHub connector reads succeeded. No test/CI pass is claimed for these repositories.

## 2. Current Code Situation

### Public site, directly observed

| Surface | Current behavior | Rebuild requirements |
|---|---|---|
| Home | Full-screen composition with central `estudiobang` wordmark, cropped photography, fixed corner controls, repeated project buttons | Curated CMS references; optional canvas motion; normal links and accessible fallback |
| About (`/about`) | Studio introduction, five team members, image sequence, expandable biography with LinkedIn/Instagram | CMS-authored introduction, ordered portraits, biographies, social links |
| Projects | Five numbered desktop entries with image preview and location/type/collaborator/year; mobile becomes image cards | Own archive URL; common list data; desktop list and mobile cards |
| Objects | Five entries, same archive pattern; sample object uses project detail route | One underlying case-study model with separate category bindings |
| Detail (`/projects/cortaderas`, `/projects/raw`) | Oversized repeated title, metadata, narrative, media sequence, Share, Close, inline contact form | Direct server-rendered route, optional animated overlay, semantic title and gallery |
| Contact | Name, Last Name, Email, Company, Reason, Send | CMS form; visible labels; optional message field as an enhancement |
| Careers | Name, Last Name, Email, Portfolio / CV link, Focus, Send | Separate CMS form and private submissions; URL validation; no upload needed for parity |
| Legal (`/legal`) | Long English/Spanish legal/privacy page | CMS page with readable typography and unobstructed mobile footer |
| Languages | ENG/ESP buttons; selected language survives project reload; HTML `lang` changes to `es` | Locale-specific URLs and metadata, translation completeness, preserved current entity |
| Shared chrome | Compact logo, navigation, language switch, BCN/BUE clocks, copyright/legal/credit | CMS branding and navigation; configurable studio clocks; safe responsive placement |

Projects observed: Cortaderas Norte, Qubaa Landscape Interventions, AISEED Training, CutterWay Housing, BREMAR Apartments.

Objects observed: RAW (Lamp), Carved Panels, Shaping Waves, Parametric Benches, Revolve Lamps.

Team observed: Espartaco Degano, Fernanda Nessier, Juan Mantz, Camila Cappato, Giuliano Barbotti.

Contact Reason options: Developments, Concept Design, Architectural Project, Interior Design, Object Design, Help with presentation. Careers Focus options: Architecture, Interior Design, Object Design, Visualization, Digital Media, Open Application.

### Eshobe code, verified on GitHub

- Pages: localized title/slug/SEO, shared block structure with localized inner fields, drafts/autosave/scheduled publishing, preview, revalidation hooks.
- Posts: localized title/content/slug/SEO, hero image, categories, related posts, project metadata with location/date/area/status/client/additional facts.
- Block library includes Team, Gallery, Archive, Form, Contact, Media, Content, CTA and others.
- Team block already has name, role, bio, photo; social profile links are absent from the inspected configuration.
- Gallery block provides ordered image relationships. Media has localized alt/caption, focal point, image derivatives, tenant scoping, SVG sanitization and storage accounting.
- Form builder persists forms and submissions; CMS validates declared fields, derives site from the persisted form, throttles public submissions, and provides an optional challenge extension point.
- `/api/site` bootstraps locales, branding, media origin, supported blocks and theme runtime settings/bindings.
- Theme settings and content slots are declared in `eshobe.theme.json`; deployments and immutable artifacts already have their own platform model.

## 3. Current Architecture

Bang behaves as a client-driven, animated site. Its DOM exposes `/assets/index-*.js` and CSS assets; this alone does not establish its source framework or backend stack. Navigation is implemented as buttons; About and Legal have distinct URLs, details have project URLs, while Projects/Objects/Contact/Careers were observed using root URL and client state. Contact/Careers appear as regions over the existing view. Deep-link reload of Cortaderas succeeded after the loading sequence, with a home-canvas background beneath the detail.

Bang’s legal page names Cloudflare and Brevo. Those are site-authored provider claims, not independently tested infrastructure or delivery evidence.

Eshobe owns persistent content, permissions, media, forms, branding, theme configuration, content events, and deployments. The external theme owns public routes, server rendering, layout, motion, interaction state, accessibility, and SEO output. The theme consumes CMS APIs through its server-side client; browser requests use constrained same-origin handlers. Keys remain on the server.

Verified flow for rendering:

`public route → site descriptor → section binding → localized CMS query → tenant/published access → content/media → theme view → enhanced interaction`.

Verified form architecture:

`CMS form definition → theme controls → bounded same-origin submission relay → CMS validation/rate limit → persisted form determines tenant → submission storage / configured email handling → UI result`.

Email delivery still requires runtime verification. CMS config uses a JSON transport when SMTP is absent, so a stored submission is not proof that email reached anyone.

## 4. What Is Already Good

- Strong identity: black/white UI, natural-color photography, sharp geometry, unusually sparse composition.
- Desktop numbered archives convey project identity and key facts without a conventional card grid.
- Mobile archives use a more practical image-card presentation.
- Case studies combine facts, narrative, photographs, and inquiry action.
- About includes people and biographies rather than an anonymous studio statement.
- Direct case-study URLs and canonical/title/description metadata exist.
- Main navigation, language selection and many controls already have accessible names.
- Eshobe already supplies most content and platform responsibilities required for this rebuild.

## 5. Problems and Gaps

### Confirmed live observations

1. Home exposes extensive duplicate interactive content: at 390px the page had 228 buttons and no `img` elements, with project imagery rendered visually. The repeated project controls are also in the accessibility snapshot. This creates an excessive navigation surface; quantify actual tab behavior during implementation.
2. Projects/Objects and Contact/Careers lack distinct URLs in the inspected interactions. This weakens shareability, refresh behavior and route-level analytics. Preserve working detail links.
3. The first attempted navigation after opening a team biography dismissed it rather than reaching Projects. Provide explicit Close and deterministic navigation behavior.
4. At 390px, fixed language/clock controls overlap legal body text near the lower viewport. Move utility controls into flow or reserve a solid, unobstructed safe area.
5. In Spanish mode, detail footer copy remained English, project buttons still used `Open …`, and some media descriptions remained English or filenames.
6. Many image descriptions are filenames or production labels, such as numbered names and screenshot/generation filenames. Replace these with meaningful localized descriptions or mark decorative images appropriately.
7. Contact and Careers fields are visually identified largely by text within empty controls. Retain labels after entry, make field boundaries/focus clear, and show associated errors.
8. Detail titles are deliberately cropped and repeated. Keep this as decorative typography while ensuring a readable primary title.
9. Pressing Escape while focused in the inline inquiry form did not remove the detail from the subsequent snapshot. Explicit dismissal and focus behavior need testing and specification.
10. Share was clickable but the visible snapshot did not confirm a successful share or copy. Add reliable success/error feedback in the rebuild.

### Confirmed Eshobe compatibility gaps

1. `src/lib/locales.ts` registers only `fa` and `en`. Exact ENG/ESP parity requires adding `es` through CMS, runtime, theme types, routes, forms, SEO, and tests. Persian/English is an alternative product choice, not Spanish parity.
2. `Media.ts` only allows JPEG/PNG/WebP/GIF/AVIF/SVG. Do not assume video or PDF/CV uploads work. Image-only parity is feasible; video requires deliberate model/storage/delivery support.
3. Existing theme `CmsForm.tsx` treats `values.company` as a honeypot and returns apparent success without a request. Bang’s legitimate Company field collides with it. CMS’s canonical honeypot is `__eshobe_website_check`. Align renderer and CMS and add a regression.
4. Team social profiles require a small reusable block extension if parity is desired.
5. Candidate theme manifest still uses a neutral placeholder name/key (`arch2-neutral`) and declares education/blog capabilities. Give the new package a unique identity and only the capabilities it implements.

No backend security defect in Bang is asserted from browser behavior. No measured performance or WCAG certification is claimed.

## 6. Dead / Legacy / Duplicate Areas

- Canvas repetition is observed rendering duplication, not proof of dead source code. Keep one canonical record per case study; generated visual copies should be decorative and not repeat keyboard/screen-reader controls.
- Projects and Objects should share one query adapter, metadata presenter, case-study template, and gallery implementation.
- Contact and inline project contact must bind the same CMS form rather than maintain duplicate field lists.
- Menus, sitemap, related links, language switch and breadcrumbs must use one locale-aware route builder.
- Team identity should live in the About Team block, not be duplicated in theme fixtures/settings and production data.
- Remove education/blog from the new theme only after tracing indirect consumers and distinguishing new-package scope from the existing theme. Do not delete working platform capabilities.
- Never remove code on reference counts alone: inspect framework routes, dynamic imports, jobs, webhooks, external callers, manifest loading, fixtures, and deployment consumers.

## 7. Recommended Target Architecture

Create a dedicated portfolio theme package, `cms-portfolio-theme`. Reuse inspected Eshobe integration patterns while keeping the original theme operational.

| Owner | Responsibility |
|---|---|
| `eshobe-cms` | Content database, media, forms/submissions, authorization, publishing, locale registry, branding/settings, change events and deployment contracts |
| New theme repository | Routes, server-side CMS adapter, public views, motion, local transient state, constrained API relay, metadata/sitemap |
| Configured mail service | Transactional delivery; CMS stores submission and delivery outcome separately where existing architecture supports it |

Use existing Posts + Categories for case studies. Bind a projects category and an objects category in the manifest. Keep one entity per work and do not introduce a Products model for a non-purchasable object.

Recommended modules:

- `cms/`: authenticated server-only reads, query normalization, media resolution, preview and revalidation.
- `domain/portfolio`: transforms posts/categories into case-study view models; resolves membership and ordering.
- `routing/`: canonical locale/section/entity paths shared by all consumers.
- `views/`: Home, About, PortfolioArchive, CaseStudy, Contact, Careers, Legal.
- `components/`: SiteShell, StudioMark, CanvasStage, ArchiveList, ArchiveCards, MetadataTable, Gallery, TeamBiography, CmsForm.
- `motion/`: small shared policy for reduced motion, visibility, pointer capability, transitions, cleanup.

Use route state as the source of truth. Gallery index, menu state and temporary form values may be local. An animated overlay is an enhancement to a complete detail route; direct load renders useful content without relying on prior canvas state.

Keep preview responses uncached and private. Public cache identity must include tenant, locale, resource, query and publication mode. Preserve signed revalidation and validate that publish/update/delete changes refresh every affected consumer.

## 8. Recommended UX/UI

### Shared shell

Keep compact studio mark, restrained navigation, monochrome tokens and photography. Use anchors for destinations and buttons for actions. Active links have `aria-current`. Add a skip link and a clear focus style. Place clocks/languages in a footer on small screens. Use IANA time zones rather than fixed UTC offsets.

### Home

Keep the image-canvas concept on desktop with an obvious Browse Projects action and a pause/reduced-motion path. Store curated case-study relationships and composition presets, not arbitrary executable animation code. Limit rendered copies and visible image loading. Mobile should use a bounded composition or normal editorial feed; preserve photography and wordmark without requiring drag/hover discovery.

### Archives

Desktop: numbered rows and a selected preview; hover and keyboard focus update the same preview. Titles remain clickable without hover. Mobile: single-column photographic cards with title and concise metadata. Filters/search are optional improvements for a growing catalog, not required for the current five-item lists. If added, encode them in the URL and provide clear/reset/empty states.

### Details

Readable H1, decorative moving/repeated title hidden from assistive technology, metadata, narrative, media, related work, inquiry CTA. Images have dimensions and meaningful alt text. Optional fullscreen viewing gets named controls, Escape, next/previous, focus restoration and mobile gestures. Do not assume every existing image opens a lightbox; confirm the desired enhancement.

### About

Studio introduction plus curated image sequence and five biographies. Biography panel has a visible Close, meaningful heading, social links, focus management and mobile full-screen layout. Team navigation and gallery refer to the same member records.

### Forms

Contact parity fields: first name, last name, email, company, reason. Recommended addition: optional project message. Careers parity: first name, last name, email, portfolio URL, focus. Include appropriate privacy information without inventing a required legal checkbox.

Render fields/options from CMS. Use persistent visible labels, required indicators, email/URL hints, field-level errors and error summary. Model `idle → invalid or submitting → accepted or recoverable error`; disable duplicate submissions, preserve values on failure, and announce status. A provider delivery failure must not erase a stored inquiry or falsely imply delivery.

### Editor experience

Editors can translate content, upload/crop/reorder images, curate featured work, edit team biographies, bind categories/forms/pages, preview drafts and publish. Theme settings expose bounded visual options, such as animation enabled, duration, canvas density and archive layout. Content remains in CMS documents, not large freeform settings JSON.

## 9. Recommended Functions

| Capability | Behavior |
|---|---|
| Site bootstrap | Resolve correct site, theme package, branding, locales and bindings; clear error for unconfigured CMS |
| Portfolio listing | Query published posts under bound category subtree, stable ordering, bounded page size |
| Case-study resolution | Resolve locale slug and verify section membership; meaningful missing translation / 404 |
| Featured composition | Resolve ordered CMS references; ignore missing/unpublished items without substituting fabricated work |
| Route generation | One builder for archives, detail, locales, navigation, sitemap and related work |
| Media resolution | Tenant-owned media, derivatives, focal point, dimensions, alt/caption; safe external URLs only if supported |
| Biography display | One record powers team list, portrait and biography panel |
| Form submission | CMS schema validation, canonical honeypot, bounded input, tenant derivation, rate limit, durable acceptance |
| Share | Native share where available; clipboard fallback; explicit success/failure |
| Clock display | Configured city labels and IANA zones; avoid hydration differences and unnecessary full-page rerenders |
| Publication refresh | Invalidate affected tenant/locale content and related navigation/media views |
| Health/diagnostics | Expose deployment identity and connectivity without secrets; correlate errors without logging personal form values |

## 10. Security and Permissions

Reuse Eshobe’s tenant and publishing model. Platform admin manages packages/deployments; authorized site members manage their own content under existing owner/editor rules. Do not create a theme-specific authentication system.

Public theme reads explicitly filter `_status=published` even with a site key, because the key can read drafts. Public proxy paths/methods are allowlisted; no content mutation relay or private submission listing. Preview requires authorization, no public caching, and controlled redirects. Enforce same-site relations for media/categories/forms and every new collection if one is actually introduced.

The CMS derives submission tenant from the persisted form. Validate that a form belongs to the theme’s configured site as well, so the relay cannot become a cross-site submission path. Normalize/validate external URLs, reject executable schemes, sanitize rich content/SVG and never fetch a visitor’s portfolio URL server-side without a separately designed safe fetcher.

Careers submissions are private personal records. Retention, recipients and deletion policy require a real product decision; do not invent them. Do not make unsolicited live submissions to verify email. Use controlled staging data and approved delivery recipients.

Current CMS form limiter is process-local. Reuse it for a single process; if production uses multiple replicas, design a shared limit or proven edge control and validate trusted forwarding headers.

## 11. Data / API Changes

Use existing APIs: `/api/site`, `/api/pages`, `/api/posts`, `/api/categories`, `/api/header`, `/api/footer`, `/api/forms`, `/api/media`, `/api/form-submissions`. Preserve existing preview/revalidation/health contracts.

Manifest content slots: home, about, contact, careers, legal, projectsCategory, objectsCategory, contactForm, careersForm. Define required slots so configuration errors are visible before deployment. Keep descriptor resolution restricted to existing supported binding types.

Suggested data additions only where confirmed necessary:

- Team social-link array with validated HTTP(S) URLs and localized labels.
- Curated home portfolio block: references to existing posts plus bounded size/aspect/composition preset and order.
- Explicit portfolio ordering if categories alone cannot express the reference order; inspect existing schema before adding.
- Spanish locale support only if ENG/ESP is the selected target; update every locale consumer and migrations/localized data behavior together.
- Video media model only if video is required; inspect source assets first. Do not weaken the image upload allowlist globally.

Project type and collaborators can use existing localized additional facts; use typed fields only if filtering/query needs justify them. Avoid confusing a project’s display year with publication date. Distinguish a single year from ranges such as `2024 – Today`.

Recommended public routes: `/`, `/about`, `/projects`, `/objects`, `/projects/[slug]`, `/objects/[slug]`, `/contact`, `/careers`, `/legal`, with enabled locale prefixes. Resolve the existing object `/projects/raw` URL through a deliberate redirect if migration moves it. Map old and new URLs explicitly before cutover.

Migrations must preserve existing sites, optional fields, localized values and relationships. Update generated types, manifest validation, consumers, tests and API contract version where a breaking change requires it.

## 12. Testing Requirements

Implementation sequence and acceptance gates:

1. Establish exact GitHub heads, applicable repository instructions, current package/tool versions, existing CI and local baseline. Preserve dirty user work. Audit both repositories before editing.
2. Confirm target languages, content/asset ownership, target package/domain, video scope and mail provider. Produce an approved content map and route map.
3. Implement minimum CMS schema additions with migrations, tenant boundaries and contract tests. Verify editor workflows before presentation polish.
4. Build server-rendered routes, CMS bindings, metadata and accessible static views. Test real CMS content and missing/unpublished content.
5. Add canvas, typography and transitions as progressive enhancements. Test focus, touch and reduced motion.
6. Integrate contact/careers with staging storage and approved mail recipients. Verify delivery separately from persistence.
7. Complete browser acceptance, exact-head CI, immutable image checks and staging deployment verification before production cutover.

Required tests:

- Unit: section/category mapping, locale paths, ordering, media URL validation, metadata, time-zone output and reduced-motion policy.
- Regression: legitimate Company value submits; reserved honeypot cannot collide with CMS field names; Spanish labels are complete; mobile footer cannot cover body text.
- Integration: two tenants with same slugs, foreign relationships, draft vs published vs preview, unknown host, API key scope, public proxy path/method policy, form tampering/unknown fields, rate limits, CMS downtime.
- Forms: missing required fields, invalid email/URL, options tampering, double-click/pending, 400/429/503 responses, preserved input, stored acceptance, notification failure and retry without duplicate submission.
- Browser: every route, both client navigation and direct refresh, Back/Forward, language switch on current case study, overlay close/focus return, team panel, gallery controls, share fallback, mobile menu and form keyboard behavior.
- Viewports: 320, 390, 768, 1440 and wide desktop; both supported directions if Persian is included. Check zoom, long titles, on-screen keyboard, image crop, touch targets and overflow.
- Accessibility: semantic headings/landmarks, named controls, tab order, no repeated decorative canvas controls, focus trap/inert behavior where appropriate, labels/errors, contrast and reduced motion.
- Performance: production measurements for LCP/INP/CLS, image/JS transfer, repeated-node count, main-thread motion, lazy loading, offscreen suspension and cleanup. Proposed targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; distinguish lab checks from real-user evidence.
- Delivery: formatting, lint, typecheck, unit/integration/E2E, production build, manifest validation, image publishing, health and CMS connectivity on exact deployed revision.

Existing source includes headless, form validation/rate-limit, tenant media, uploads, theme bindings/settings/artifacts/routes and external-theme contract tests. Their presence is verified; passing results were not established in this audit.

## 13. Full AI Coding-Agent Prompt

You are implementing an Estudio Bang-inspired portfolio theme integrated with the existing Eshobe CMS. Complete the agreed rebuild end to end, preserving its visual identity and fixing confirmed usability and integration defects. This document is the planning reference; verify the actual current repository state before editing. Do not treat observed browser behavior as proof of original backend implementation.

### First inspect and establish evidence

1. Inspect current GitHub code and exact heads for `hamidnoshady/eshobe-cms`, the selected reusable theme, and `hamidnoshady/cms-portfolio-theme`. Read applicable AGENTS.md instructions. Inspect the reference source repository if access is provided. Do not rely solely on this report, README, screenshots or prior notes.
2. Establish local and CI baseline before edits. Record command, revision, environment and results. Preserve unrelated dirty changes and use an isolated workspace where needed.
3. Trace complete feature surfaces: routes/pages, components, hooks/state, API handlers, services, models/migrations, authentication/authorization, tenant scoping, integrations, navigation, design system and tests. Trace UI → request → validation → auth/permission → service → database/provider → response → UI.
4. Verify all assumptions: languages, content rights, package identity, site binding, assets/video, required slots, SMTP/Brevo configuration, preview and signed revalidation. Ask for unresolved product decisions without inventing policy.

### Implement the architecture and content

5. Create a uniquely identified Eshobe portfolio theme package. Reuse proven CMS access, preview, public-proxy, revalidation, health and deployment contracts. Keep Eshobe responsible for persistence, authorization, media, forms and publishing; keep the theme responsible for presentation and transient state.
6. Use existing Posts/Categories for Projects and Objects, Pages for Home/About/Contact/Careers/Legal, existing Team/Gallery blocks where adequate, and separate CMS contact/careers forms. Add only justified reusable schema fields. Do not create a store or duplicate case-study data.
7. Declare home/about/contact/careers/legal/category/form bindings in the manifest and consume them through `/api/site`. Make content, branding, navigation, labels, fields/options and featured work editable. Do not hardcode production portfolio content or seed real submissions.
8. Implement canonical route and locale builders and update all consumers: navigation, archive cards, details, related content, language switch, SEO, sitemap, previews and redirects. Preserve existing working detail URLs or migrate with explicit redirects. Direct refresh and browser history must work.
9. If Spanish is selected, extend the platform locale registry and all affected types, runtime code, API queries, routes, editor configuration, SEO and tests together. If Persian is selected, implement correct RTL and isolate email/URLs/numbers without disrupting LTR content.

### Implement the UI and workflows

10. Preserve monochrome interface, sharp corners, natural photography, compact mark, expressive wordmark, spacious layout, numbered desktop archives and mobile image cards. Reuse the existing design system; add coherent tokens only where needed.
11. Build a bounded, curated image canvas. Maintain one accessible link per canonical work; make repeated visual copies decorative and non-focusable. Add readable project navigation, reduced-motion/static fallback, pointer/touch behavior, offscreen suspension and cleanup.
12. Implement complete Home, About/team biographies, Projects, Objects, case-study details, Contact, Careers and Legal views. Use readable semantic titles alongside decorative cropped/repeated typography. Implement focus-safe menu/panels and deterministic dismissal/navigation. Ensure fixed utility controls never cover mobile text.
13. Render galleries with responsive derivatives, focal points, dimensions, localized alt/captions, progressive loading and meaningful failure states. Add named fullscreen controls only if that feature is selected. Do not assume video uploads exist; implement any required video extension with secure validation, storage and delivery.
14. Implement Share with native share and clipboard fallback plus status feedback. Implement configurable studio clocks from IANA zones without hydration issues.
15. Implement CMS-authored forms and their complete idle/validation/pending/accepted/error states. Keep labels visible, focus first invalid control, announce status, preserve values on errors and prevent duplicate requests. Contact includes a legitimate Company field; careers includes a validated portfolio/CV URL. Optional message field is a scoped UX addition.
16. Fix the existing theme’s Company/honeypot collision at the root cause: use the CMS canonical reserved field `__eshobe_website_check`, validate that public form field names cannot collide with it, and remove client-only false success for legitimate Company values. Add regression tests proving the request and stored field value.
17. Reuse server validation, bounded bodies, tenant derivation, rate limits and optional challenge integration. Verify persistence and email delivery separately in staging. Do not send real inquiries/applications or use unapproved recipients. Do not expose private submission data through public APIs or logs.

### Security, consolidation and cleanup

18. Enforce server-side authorization and tenant isolation everywhere, including relation fields, bindings, media, caches, forms, preview, proxy handlers and any new collections. Public queries must explicitly exclude drafts when using a privileged site key. Secrets stay server-only and out of artifacts/browser bundles.
19. Preserve published-only proxy policy and method/path allowlists. Validate URLs, constrain redirects, retain SVG/rich-content protections and avoid arbitrary server-side fetches of portfolio links. Validate form ownership against configured site.
20. Consolidate duplicate route, metadata, form and case-study logic around one canonical source. Safely remove confirmed dead routes/APIs/components/hooks/flags/legacy UI only after checking framework routing, dynamic imports, background jobs, webhooks, manifests and external consumers. Preserve good working implementation and unrelated platform features.
21. Use proper migrations for persistent schema changes; preserve existing tenants and localized values. Regenerate types/import maps as required. Update every API/contract consumer and relevant version declarations.

### Verify and finish

22. Add meaningful regression, unit, integration, permission and tenant-isolation tests. Test two tenants, duplicate slugs, foreign references, draft leakage, public proxy abuse, form validation/rate limits, provider failures and CMS downtime.
23. Run formatting, lint, typecheck, tests, production build, manifest validation and all applicable CI checks. Never disable tests, weaken assertions, raise budgets or replace visual baselines merely to make CI green. Inspect visual differences before proposing baseline approval.
24. Perform real-CMS browser acceptance across all routes, direct loads/client navigation/history, supported languages, RTL/LTR where applicable, 320/390/768/1440/wide widths, keyboard/touch, reduced motion, menus, biography panels, galleries and forms. Measure production performance rather than estimating it from screenshots.
25. Verify exact CI/deployment SHA, individual jobs, image digest, health, CMS connectivity, publishing refresh and rollback behavior. Do the complete job rather than stopping after individual phases. No TODO/placeholder production implementation or fabricated runtime success.

Final report must contain exactly identifiable sections: Implemented; Bugs fixed; Architecture changes; UX/UI changes; Security changes; Dead/legacy code removed; Tests added/updated; Exact verification/CI results; Genuine remaining issues. Separate source implementation, local validation, CI, staging/deployment, email-provider evidence and real-device evidence. State remaining decisions and blockers honestly.

### Source links

- Reference: https://bybang.co/ ; About: https://bybang.co/about ; Cortaderas: https://bybang.co/projects/cortaderas ; RAW: https://bybang.co/projects/raw ; Legal: https://bybang.co/legal
- CMS source: https://github.com/hamidnoshady/eshobe-cms/tree/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60
- Theme source: https://github.com/hamidnoshady/cms-arch3-theme/tree/34cde1b1d3f9345bf14d420eacb5665a2c0f15af
- CMS Posts: https://github.com/hamidnoshady/eshobe-cms/blob/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60/src/collections/Posts/index.ts
- CMS locale registry: https://github.com/hamidnoshady/eshobe-cms/blob/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60/src/lib/locales.ts
- CMS Media: https://github.com/hamidnoshady/eshobe-cms/blob/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60/src/collections/Media.ts
- CMS plugins/tenant/form behavior: https://github.com/hamidnoshady/eshobe-cms/blob/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60/src/plugins/index.ts
- CMS honeypot constant: https://github.com/hamidnoshady/eshobe-cms/blob/4d00545ec6eb2265db0d0168fcf72d6f3a4f4f60/src/lib/public-form-fields.ts
- Theme form collision: https://github.com/hamidnoshady/cms-arch3-theme/blob/34cde1b1d3f9345bf14d420eacb5665a2c0f15af/src/components/forms/CmsForm.tsx