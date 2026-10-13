# Full implementation prompt — new minimal architecture theme

Build a completely NEW, independently structured Next.js theme for an architecture studio, connected to the existing Payload-based Eshobe CMS using the supplied `THEME_API (1).md` contract.

The theme has no assigned product name. Do not reference, clone, rename or assume any previous theme or repository. Do not hardcode a studio name, logo, contact details, people or project content. Customer identity comes from the CMS. Use neutral theme/package identifiers during development and document where the final name can be supplied.

Implement the complete application, not just a plan, static mockup or homepage. Finish all authorized independent work, verify the implementation and report precise limitations. No deployment, domain changes or external publication are requested.

## 1. Product direction

Create a minimal but creative architecture portfolio with restrained animation, expressive typography, carefully composed photography, generous whitespace and a recognizable architectural line system.

Persian is the primary language and RTL is the primary layout direction. English is the second language and uses LTR. Design both deliberately; translating text without adapting direction is insufficient.

Use pure white interface surfaces, black interface typography and black linework. Photography may keep its original colors. No decorative colored panels, gradients, heavy shadows, dark-mode feature or rounded UI. Every corner is square: cards, images, controls, drawer, dialog, skeleton and pagination.

There must be BOTH structural lines and decorative lines. Structural hairlines organize navigation, cards and selected editorial sections. Decorative marks add an architectural drafting identity. Lines must be visibly present across the website, but remain delicate. Do not implement a nearly line-free layout or limit all linework to a few corner marks. Equally, do not turn the whole page into a dense wireframe.

Keep content concise. Create visual interest through spacing, hierarchy, line geometry and composition instead of adding marketing sections or fake statistics.

## 2. Framework and implementation approach

Use Next.js App Router, React and TypeScript with versions verified to work together. Use Tailwind CSS for this new theme if it fits the chosen shadcn setup, with centralized CSS variables and semantic component styles. Keep styling coherent; avoid competing reset layers or multiple design systems.

Use selected shadcn/ui components for interactions. Use Motion for React only where it makes the restrained animation easier to maintain; native CSS transitions are sufficient for simple states. Do not combine multiple animation engines for the same interaction. A gallery library is optional only if actual swipe/drag behavior needs it.

Integrate through a server-only typed CMS client. The frontend theme consumes the supplied CMS; do not embed another Payload admin/database or create a separate competing CMS.

Use the supplied API runtime package for formatting, money, URLs and validated theme CSS when available. Verify its exports instead of assuming them. If an unpublished runtime package is required, obtain the supported distribution from the CMS project owner or report that dependency; do not fabricate the library's behavior.

Inspect current official/installed documentation for the chosen Next.js and component versions before implementing version-sensitive APIs. Keep one package manager, a committed lockfile and reproducible development/build commands.

## 3. Layout: full-width navbar, 1440px maximum content

The page's white background spans the viewport. The navbar spans the available viewport width with independent edge gutters. Content beneath it is centered in a container whose maximum width is 1440px.

- Navbar: full width, approximately 32–40px desktop edge gutters, smaller mobile gutters.
- Interior content: `max-width: 1440px`, fluid width, centered, with safe gutters.
- Breadcrumbs, headings, filters, archives and footer content share that content alignment.
- At 1920px viewport width, a 1440px content area has approximately 240px equal outer margins; navbar content sits much closer to the viewport edges.
- At 1440px and below, content shrinks with gutters. A maximum width is not a fixed width.
- Article prose may use a narrower readable measure within the content container.
- No visible enclosing page box or thick outside border.

Implement separate `NavbarShell` and `ContentContainer` primitives. Avoid `100vw` plus padding causing overflow. Use logical properties and `minmax(0, 1fr)` where appropriate.

The homepage is an exceptional full-viewport entrance stage. It does not receive standard interior-page sections or a standard header before the menu reveal.

## 4. Central design tokens

Create one theme-owned system for colors, typography, spacing, widths, lines, motion and focus.

Suggested baseline tokens:

- Surface: `#ffffff`.
- Ink: `#000000`.
- Secondary text: a separately verified readable black transparency.
- Radius: `0` at every level.
- Content maximum: `1440px`.
- Mobile gutter: approximately `16px`.
- Desktop content gutter: approximately `24–40px` when viewport is below the maximum.
- Card image-frame inset: `5px`.
- Structural hairline: visually approximately `0.5px`, black at approximately `25–35%` opacity.
- Decorative hairline: visually approximately `0.5px`, black at approximately `15–25%` opacity.
- Emphasis line: approximately `1px`, black, reserved for active/interactive meaning.
- Skeleton surface: black at approximately `3–6%` opacity.
- Shared spacing scale, grid gaps, text roles, motion duration/easing and focus indicators.

Subpixel lines may need a visually equivalent fallback on 1x displays. Inspect actual rendering. Do not blindly increase every line to a heavy 1px solid black border. Decorative line opacity is not suitable for essential text or the only indication of interactive controls.

## 5. Structural line system

Lines should provide a clear but delicate architecture to the pages. Implement reusable variants for horizontal separator, vertical separator, image frame, card boundary, caption rule and active underline.

Use structural hairlines deliberately:

- A continuous or carefully interrupted hairline below the interior-page navbar.
- A fine baseline separating heading/filter area from an archive where useful.
- Thin frames organizing selected cards or media.
- Fine rules between blog article rows.
- A subtle vertical divider between a wide-screen blog lead section and its latest-notes column.
- A fine divider between the Contact details and form columns on desktop.
- Sparse section/footer rules.
- Clear small menu-row separators in the revealed homepage menu/mobile drawer.

Do not draw every possible divider simultaneously. Choose a consistent hierarchy: major content groups may have a separator; paragraphs do not need individual borders. Keep white space within and around the line system.

The line system must work with real variable-length content. No arbitrary absolute page-long strokes crossing text or stretching to match an image mockup.

## 6. Decorative line system: more visible architectural accents

Build reusable `DecorativeMark` variants: short dash, vertical tick, corner fragment, paired dash, offset L and small crosshair. Use deterministic placement and shared tokens.

Place enough motifs to establish a recognizable visual identity:

- A small dash or crosshair near page titles.
- Paired short marks beside a filter group or heading label.
- Tiny corner extensions/marks around selected images in addition to their fine structural frame.
- Small caption dashes on cards.
- A few isolated ticks or offset L marks in desktop whitespace.
- Restrained marks around the Contact/About composition.

Typical lengths: dashes 12–24px, corner arms 10–18px, ticks 8–16px. Scale density down on mobile while keeping the motif recognizable. Decorations must be small and faint, not large geometric drawings.

Structural and decorative lines are related but distinct: continuous separators organize; small fragments ornament. Do not replace all structural lines with decoration or all decoration with full rectangles.

Decorations are `aria-hidden`, non-focusable, `pointer-events: none`, and excluded from layout sizing. Use pseudo-elements or a tiny reusable SVG. No client effect per line, random hydration placement, continuous animation loop or canvas rendering for ordinary marks.

Keep decorative marks clear of text, controls and important photograph details. No overflow caused by ornament positioning. RTL/LTR alignment should be intentional.

## 7. Typography: theme managed, Shazde 100–900

Use Shazde for Persian UI, with genuine weights 100 through 900 where licensed assets support them. Manage every page and component through semantic theme typography tokens: display, title, heading, body, navigation, button, field label, card title, metadata, caption and error.

Verify the font files and real weight mappings. Use a genuine variable font or real static assets. Do not synthesize unavailable weights, assume a filename proves a weight range or silently map 100/200 to another file. If assets are missing, implement with supported weights/fallback and identify the exact missing files while finishing other work.

Use efficient supported font loading. Do not preload all nine weights indiscriminately. Avoid font-induced layout shifts. Keep Persian letter spacing normal. Use suitable Persian line height and isolate mixed Persian/Latin/numeral strings correctly.

English uses the same centralized typography system with a verified appropriate family. Shazde Latin may be used if tested; otherwise select one compatible English family centrally. Do not scatter unrelated font stacks.

Keep hierarchy refined. Supporting 100–900 does not require using every weight on every screen. Prefer intentional size/spacing hierarchy over excessive bold text. Labels and metadata remain legible on mobile and at 200% zoom.

## 8. Reusable architecture

Separate visual primitives, domain components and CMS adapters. Views compose them; raw CMS fetches, route building and date formatting are not duplicated in cards.

Suggested structure, adapt filenames as needed:

```text
src/
  app/                  routes, loading/error boundaries, metadata
  components/
    ui/                 selected shadcn components
    design/             containers, type, structural rules, decorative marks
    layout/             navbar, footer, breadcrumbs, language switch, drawer
    home/               logo animation, entrance stage, revealed menu
    projects/           project card/grid, filters, facts, related projects
    education/          featured entry, compact entries, educational metadata
    blog/               lead entry, latest notes, article rows
    media/              image frame, responsive image, gallery/lightbox
    forms/              CMS form, fields, feedback
    blocks/             contract block adapters/registry
    states/             skeletons, empty/error/holding states
  lib/
    cms/                client, contracts, queries, normalization
    routing/            locale, aliases, URLs, breadcrumbs
    theme/              tokens, settings, branding, capabilities
    seo/                metadata, sitemap, alternates
  styles/               centralized semantic styling
tests/                  meaningful unit/integration/browser coverage
```

Keep helpers typed and server-only where appropriate. Make image orientation and line treatment variants reusable. Build a development-only component/state showcase if useful; never expose credentials or draft fixtures publicly.

## 9. Homepage: animated SVG logo, then scroll to menu

The homepage contains only the entrance and menu experience.

Initial state: white viewport, centered customer logo, restrained SVG drawing/shape reveal once, then a small scroll cue. No project grid, hero copy, education/blog blocks or normal footer.

One bounded scroll/swipe transitions to the menu. The logo shrinks/moves smoothly, a fine structural menu datum or row rules appear, and menu labels enter with a short stagger. Header menu destinations come from CMS data. Add a small language switch. Final menu state is stable and usable.

Provide visible discreet Enter control and keyboard access. Do not depend solely on wheel/touch. Do not hijack global scrolling or replay the whole intro on every return from an interior page. Define return/back-button behavior and cleanup event listeners.

Use the uploaded customer logo. Suitable SVG paths may draw; filled/complex SVG or raster images get an appropriate restrained fallback reveal. Do not inline unsanitized uploaded SVG. Missing logo falls back to actual site-name wordmark, not an invented brand.

Reduced-motion mode uses immediate stable states or a brief fade. The intro cannot be an indefinite loading mask.

## 10. Projects archive and detail

Projects archive: breadcrumbs, modest title, category controls, compact mixed-ratio cards, pagination and a restrained structural/decorative line treatment.

Images: landscape approximately 3:2, portrait approximately 3:4, square 1:1. Use actual media dimensions or supported content configuration. Do not stretch images or force every portrait into a landscape crop. Use focal points if supplied.

Grid: four small/moderate columns on wide desktop, three at medium desktop, two on tablet and TWO PROJECT CARDS PER ROW ON MOBILE. Use safe gutters and small gaps. A 390px viewport with 16px gutters/12px gap yields approximately 173px cards. Titles may wrap; avoid unreadable downsizing.

Allow balanced mixed-ratio composition without making one portrait dominate half the page. Preserve stable RTL reading/tab order; avoid dense packing or masonry techniques that scramble the visible order.

Card construction:

- Image fills its area edge-to-edge.
- A very fine continuous structural rectangle overlays the image at exactly 5px inset; add selected tiny corner/dash accents for visual identity.
- The 5px is the FRAME INSET, not white image padding.
- Where continuous frames become excessive, a deliberate shared fragmented-frame variant may be used, but keep enough structural frames elsewhere to preserve the requested line-rich system.
- Compact title/actual metadata beneath, optional short caption rule/arrow.
- No heavy shadow, rounding or thick box around every card.

Project detail: breadcrumbs, title, only real project facts, controlled hero ratio, rich-text narrative, gallery and related projects. Landscape and portrait gallery media must remain appropriate. Do not fabricate location, area, awards or year. A structured metadata extension must be verified separately if the CMS contract lacks it.

## 11. Education archive and detail

Different composition from Projects:

- One restrained featured educational entry with short text and image.
- Compact horizontal entries beneath: thumbnail at inline-start, text beside it, real category and available metadata.
- Thin row/card separators and a few decorative marks.
- Reading time may be computed honestly from content; video duration must come from valid media metadata or a documented process.
- Filters for articles/workshops/videos only if supported by actual content categories.
- Small media with 5px inset fine frames; no giant educational banner.

On mobile choose readable horizontal/stacked entry variants. The two-column requirement applies specifically to Project cards. Do not invent enrollment, payments, certificates or progress dashboards.

Education detail uses shared article/media components, relevant duration/type information, accessible video where applicable and related content. Use a real CMS entry, not fixed mockup text.

## 12. Blog archive and article

Blog is text-led editorial design, distinct from Projects/Education:

- Lead story with concise title/excerpt, actual author/date and modest photograph.
- Latest-notes column on wide screens, organized by a fine vertical structural line.
- Article rows below with small thumbnails, thin horizontal separators and occasional decorative dashes.
- Small category controls and pagination.
- Responsive stacking with stable order.

Keep generous whitespace and restrained content density. Avoid repeating the lead story in every section. Do not add newsletters/subscriptions without a requirement.

Article pages use comfortable prose width inside the 1440px maximum, metadata, rich text, embedded media, optional supported related posts and translated URLs. Author data must use public author fields.

## 13. About Us: sparse composition

Breadcrumbs, modest title, one short introduction, one small studio image and one discreet contact link. Leave substantial empty space. Do not add team grids, statistics, long philosophy paragraphs or multiple process sections by default.

Use one or two fine structural anchors and a few small decorative marks to articulate the whitespace; keep them carefully aligned. The image is approximately 40–45% of desktop content width with its inset frame. Stack cleanly on mobile.

CMS-driven blocks can still render when intentionally configured, but never delete customer content to imitate the sparse sample. Document how to compose this default through supported content fields.

## 14. Contact: minimal form and details

Breadcrumbs, concise title/invitation, real contact details and compact CMS-defined form. Desktop has two restrained columns with one fine dividing line and decorative accents; mobile stacks them and changes the divider appropriately.

Prefer name/email/message when the configured form uses those fields. Do not override CMS-defined required fields. Use simple underline-style fields, visible labels, accessible focus, field errors, pending/success/failure states and a small square black submit button.

No giant map, extra marketing sections or invented address/phone/email. Optional map link appears only for configured valid location. Isolate email/phone direction correctly. Preserve entered values on recoverable errors and prevent accidental repeated submissions while pending.

## 15. Navbar, mobile menu and breadcrumbs

Interior navbar is full width, CMS-driven, compact and direction-aware. Persian identity at right, controls/language at left. English adapts its reading direction. Active navigation has a clear restrained underline/marker.

Mobile drawer: opens from right for Persian and left for English. Two-line menu icon changes to sharp X. White panel enters in approximately 250–350ms, with a fine edge/row line treatment, decorative ticks and subtle link stagger. Language selection near bottom.

Use focus trap, Escape, focus restoration, scroll-lock cleanup, safe-area handling and sufficiently large touch targets. Close reliably on route changes. Reduced-motion mode remains fully operable.

Breadcrumbs beneath navbar on all interior pages, none on home. Translate Home/Projects/Education/Blog/About/Contact, include actual detail title, link parents and mark current segment with aria-current. Use a labeled nav landmark and correct RTL/LTR order. Long labels wrap or truncate predictably without overflow.

## 16. Selected shadcn components

Use Sheet, Breadcrumb, Skeleton, Button, Input, Textarea, Label, Pagination and Dialog. Use Select for actual dropdown filters and Accordion for actual CMS FAQ blocks. Install only needed components.

Restyle them through this theme: radius zero, central typography, white/black palette, subtle structural hairlines, clear focus indicators, restrained motion and no default shadows/colored panels. Ensure direction-aware portal content. Do not assume accessible defaults remain intact after customization; verify.

Page compositions, project/education/blog cards, line primitives and SVG entrance remain custom reusable components.

## 17. Skeleton loading and state design

Shared skeletons for project cards, education entries, blog rows, page content and media. Match actual widths, ratios and gaps, including two mobile project columns and the 1440px content/full-width navbar distinction.

Use faint black at 3–6% opacity, sharp corners, gentle opacity pulse and static reduced-motion state. No shimmer gradient. Retain important structural anchors while loading; minimize unnecessary decorative animation.

Use real loading boundaries/Suspense rather than arbitrary fake delays. Keep shell/breadcrumbs visible where possible. Hide decorative skeleton blocks from screen readers and provide concise loading feedback. Resolve into proper empty/error/holding states instead of leaving a skeleton forever.

Homepage uses its entrance/initial state rather than archive skeletons.

## 18. CMS contract and content adapters

Read `THEME_API (1).md` in full. Implement the actual contract, not speculative endpoints.

Bootstrap GET /api/site. Validate contractVersion, lifecycle status, available/default locales, block allowlist, media origin and theme descriptors. Optional branding/runtime binding fields must be verified before use. Handle missing optional fields gracefully.

Use documented pages, posts, categories, header/footer, media, forms and form-submissions endpoints. The supplied base contract has no dedicated projects collection. Represent projects, education and blog through categorized posts or another genuinely documented extension. Do not fabricate /api/projects or /api/team.

Use content-slot bindings only if the actual CMS supports them. Bound IDs win; missing/untranslated bound content cannot silently swap to unrelated content. Without extensions, document supported slug/category conventions and keep them configurable through an honest supported adapter.

Support the relevant portfolio block allowlist and preserve CMS block IDs/order. Shared block registry normalizes ID/populated relationship forms. Unknown/disallowed blocks skip safely with diagnostics. Preserve field-level rich-text direction and localized content rules.

All dates/numbers/phone digits/prices go through supported runtime helpers. Money uses actual site currency and integer minor units where required; no hardcoded currency conversion. Do not advertise store support without product/checkout/receipt implementation.

## 19. Security, preview, caching and media

Tenant identity comes from trusted Host or site credential, never a visitor site query/body field. A site filter narrows a read; it is not authorization.

Credentials remain server-only and runtime-only. No public environment secret, browser credential or baked image secret. Credentialed public rendering explicitly excludes drafts; authenticated preview bypasses shared caches and remains noindex.

Verify real deployment ingress before forwarding Host; avoid proxy recursion. Never attach a privileged site key to arbitrary visitor paths. Restrict public proxy behavior, strip untrusted credentials and validate media/forms tenant scope. Keep method/body behavior correct for supported public routes.

Resolve relative media through descriptor origin, validate allowed remote origins and reserve media dimensions. Keep storage credentials private. Sanitize or safely display uploaded SVG; do not execute its markup.

Partition caches by tenant/locale/query/public-vs-preview. Signed revalidation checks raw-body HMAC with the deployment secret, maps content paths and invalidates relevant caches. Keep bounded TTL fallback for missed webhooks and document multiple-replica behavior. Suspension/unpublishing must not be masked indefinitely by stale cache behavior.

Unknown hosts fail closed. Suspended/archived sites show holding state with noindex and no portfolio content. Production outages must not show fake studio identity as a successful customer page.

## 20. Manifest and attachment

Create a NEW root theme manifest matching the supplied contract and verified CMS parser. Use a neutral unique placeholder package key to be finalized, not an existing theme identity. Keep contractVersion correct and claim only implemented site types/locales/capabilities.

Verify manifest fields instead of mixing unsupported examples. Configure build, runtime port and meaningful health checks. Required platform-injected environment variables remain runtime configuration; do not ask tenants for platform secrets.

Use reachable preview origin for preview links and actual site domain for canonical identity. Preview must be noindex. Choose a supported hosting/proxy mode and claim proxiesApi only after testing required public forwarding behavior.

Provide installation, configuration, CMS attachment, content setup, preview and production-release instructions. No automatic production publishing. Keep secrets out of build layers and document rollback/versioning.

## 21. Routes, localization and SEO

Implement home, projects index/detail, education index/detail, blog index/article, About, Contact, generic CMS pages and required utility routes. Define clear aliases and reconcile them with runtime route helpers and reserved CMS paths. Avoid shadowing real CMS pages or duplicating canonical routes.

For Persian-default sites use unprefixed primary routes and /en for English. Respect actual served locales; unsupported locales 404. Language switching uses the translated equivalent document where available, never a fabricated URL. Missing translation behavior must be deliberate and clear.

Centralize URLs used by menus, cards, rich text, breadcrumbs, metadata, language switch and sitemap. Generate real tenant/document metadata and paginated sitemap entries. Do not publish hreflang for missing translations; use documented fallbackLocale handling.

## 22. Responsive behavior, motion and accessibility

Implement all pages, not desktop only. Verify 320, 375/390, 768, 1024, 1440 and 1920px widths. Project cards remain two per mobile row. Match skeleton geometry to actual layout. No horizontal overflow from images, long labels, ornaments or container calculations.

Use semantic structure, real labels, accessible disclosures/lightboxes, keyboard operation, visible focus, contrast and image alt text. Fine decorative lines are never the sole control boundary or meaning. Adapt logical spacing/direction throughout.

Motion stays restrained: entrance logo, bounded home-menu transition, mobile drawer, short image/card hover and gentle content reveal. Avoid per-section theatrical scrolling, parallax everywhere, heavy route effects or constant line motion. Limit animations to compositor-friendly properties where possible. All content remains visible if enhancement fails.

## 23. Development and bug fixing

Implement iteratively: design tokens/layout/line system; reusable shell; home stage; archives/details; sparse About/Contact; skeletons; CMS adapters; preview/security/SEO; verification.

While developing, find and fix real defects in the new implementation: duplicates, dead components, invalid routes, unsupported manifest claims, data mismatches, stale caches, draft leaks, portrait cropping, typography drift, loading shifts and menu cleanup problems. Remove confirmed unused code, not content or meaningful tests. Do not leave old/new implementations active or bypass checks to obtain a green build.

## 24. Verification and final deliverables

Run typecheck, lint, meaningful tests and production build. Add focused tests for tenant/publication handling, binding/locale resolution, signed preview/revalidation, API/forms behavior and critical responsive interactions. Do not write only source-string assertions that mirror the implementation.

Browser QA in both languages: target widths, 200% zoom, reduced motion, keyboard navigation, no/missing logo, missing image, slow/unavailable CMS, empty archives, invalid forms, loading/error transitions and long labels.

Specifically verify full-width navbar versus 1440px content, two mobile project columns, 5px inside-image frame geometry, visible but delicate structural lines, ample decorative accents and no heavy border grid. Check hairlines at 1x/2x. Hide decorative marks temporarily: structural line system and layout should remain coherent. Hide structural rules temporarily: accessibility and logical content order must still work.

Produce actual browser screenshots of home entrance/menu, desktop/mobile projects, education, blog, About, Contact, mobile drawer and skeletons. Do not use generated mockups as implementation evidence.

Deliver working source, reusable components, central tokens/typography, CMS-compatible manifest, environment/setup/attachment documentation, development preview instructions, tests/check results and honest limitations. If missing font assets or CMS access block a check, finish independent work and state the exact unverified requirement.

The finished result is a NEW unnamed architecture theme: minimal, RTL first, English second, visibly articulated by both structural and decorative fine lines, reusable and CMS driven, with no dependency on a previous brand or repository.
