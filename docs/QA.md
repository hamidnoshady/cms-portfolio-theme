# QA and verification report

What was actually run, against what, and what the result was. Every screenshot referenced
here is a real browser capture (`docs/screenshots/`, 40 PNGs at 2× device scale) produced by
`scripts/screenshots.mjs` against a **production build**. Pending or aspirational checks are
stated as such — nothing in this file is a plan.

Environment: Node 22.22, Next 16.3.8, headless Chromium 153 (`@sparticuz/chromium`, the only
browser obtainable here — the Playwright CDNs are unreachable from this sandbox).

---

## 1. How to reproduce

```bash
npm ci
npm run verify                     # vendor:build → typecheck → lint → test → build

# --- production QA topology -------------------------------------------------
npm run build
ARCH2_INCLUDE_QA=1 npm run prepare:standalone
node --experimental-strip-types scripts/mock-cms.mjs --port 4011 --origin http://127.0.0.1:3200 &
(cd .next/standalone && PORT=3200 HOSTNAME=0.0.0.0 \
  ESHOBE_CMS_URL=http://127.0.0.1:4011 ESHOBE_PUBLIC_ORIGIN=http://127.0.0.1:3200 node server.js) &

bash scripts/qa-servers.sh            # scenario instances on 3300–3800 (foreground)
node scripts/screenshots.mjs --base http://127.0.0.1:3200 --scale 2
```

`scripts/qa-servers.sh` preflights its own ports and refuses to start half-bound, because a
mock that dies on `EADDRINUSE` leaves the theme talking to whatever still holds the port and
the resulting screenshots look fine while measuring nothing.

## 2. Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Vendored runtime builds | `npm run vendor:build` | passes (8 modules emitted) |
| TypeScript | `npm run typecheck` | clean, `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` |
| ESLint | `npm run lint` | 0 errors, 0 warnings |
| Unit/integration tests | `npm test` | **16 files, 171 tests, all passing** |
| Production build | `npm run build` | Next 16.3.8, compiles, all routes emitted |
| Browser evidence | `node scripts/screenshots.mjs` | **46 shots, 0 failures**, no page errors, no horizontal overflow (re-captured 2026-10-06 after the UI/UX refactor, including six new lightbox / gallery / facts shots) |
| Interaction behaviour | `node scripts/interaction-audit.mjs` | **21/21 checks pass** — the nine original entrance/drawer/form checks plus locale retention on English archives, canonical search sections, wrong-section redirects, blog category scoping, drawer edge + bounded motion per locale, inline email validation, 390px card-metadata stress, active Shazde weights, decorative stroke tokens at 1x/2x, reduced-motion stillness, and slow-archive loading compositions (see §3) |
| Structural a11y | `npm run a11y` | **17/17 pages clean** (one `h1`, a `<main>`, no skipped heading levels, no missing/empty `alt`, no duplicate ids, no sub-24px target, no sub-4.5 contrast on body text) |
| Manifest | `tests/manifest.test.ts` + the CMS's own parser | accepted (§5) |

`npm run verify` chains typecheck → lint → test → build. Lint is *inside* verify (it is not
excluded), and any of the four failing fails the chain. The same four checks run in CI
(`.github/workflows/ci.yml`, run on every pull request and called by
`publish-image.yml` before any image is published), together with the browser audits and a
no-push container build; `publish-image.yml` pushes `ghcr.io/<owner>/<repo>` on merges to `main` and `v*` tags.

### Test files

| File | Covers |
| --- | --- |
| `tests/contract.test.ts` | `@eshobe/site-runtime` export surface, `contractVersion`, block slugs |
| `tests/routing.test.ts` | locale split, URL helpers, breadcrumbs (archive vs detail, `aria-current`) |
| `tests/sections.test.ts` | slot precedence (binding → hint → none), cyclic/parent-child categories |
| `tests/media.test.ts` | size URLs (relative `/api/media/file/*`, never the production domain on a preview host), `srcSet`, focal points, aspect ratios, origin allowlist |
| `tests/security.test.ts` | tenant resolution, preview gating, signature checks, draft exclusion |
| `tests/fixtures.test.ts` | the fixture encoder's query semantics (`exists=false`, `like`, paging) |
| `tests/content.test.ts` | nav references resolve by **id**; reads are single-locale with `fallbackLocale=false`; the credential travels in a header; the language switch carries a search term |
| `tests/manifest.test.ts` | manifest ↔ code agreement, neutral identifiers, no unclaimed capability |
| `tests/components.test.tsx` | server-rendered component output (marks, rules, skeletons); the language switch names only the other locale and renders a missing translation as non-interactive text, never a fabricated link; the logo is sized by `.navbar__logo` (no hard-coded 32px / `h-8`) and prefers the primary mark at `64rem`; the project facts block renders exactly the CMS fields that are present, as a compact `.facts` block rather than a table |
| `tests/api.test.ts` | the public form-submission proxy: the site key names the tenant while no cookie/client-authorization is forwarded, a request carrying the theme's own proxy marker is refused (508), the payload is bounded (413), an unconfigured CMS answers 503, and the CMS status is passed through rather than turned into a success |
| `tests/form.test.tsx` | the CMS-defined form: required fields (incl. consent) block an empty submit with tied `aria-describedby` errors, invalid email is rejected, errors clear on typing, the payload uses CMS field names with booleans stringified, success is announced via `aria-live`, values survive a failure, the control is disabled while in flight, and a filled honeypot is absorbed without a write |
| `tests/gallery.test.tsx` | the unified lightbox: a thumbnail opens a real dialog with a localized title over the dedicated `.lightbox__overlay` (never `.drawer__overlay`); close control, Escape and a click on the empty stage dismiss it and focus returns to the thumbnail; in Persian *previous* is the right chevron and *next* the left, ArrowLeft advances and the incoming image slides in from the left (English mirrored); the grid is `.grid-media` with the editor's column choice as a desktop-only modifier |
| `tests/lightbox-reduced-motion.test.tsx` | under `prefers-reduced-motion` the lightbox still opens, steps and closes, with no slide offset and no lingering exit |
| `tests/content-media.test.tsx` | server-rendered rich text: every content image (uploads, inline `mediaBlock`, each `mediaGrid` cell) renders once as a trigger of one lightbox in document order; prose without photographs ships no trigger; the project page renders content media once with no second gallery and the compact facts block |
| `tests/ui-contract.test.ts` | the stylesheet contract: `.grid-media` is 2 columns until `64rem` (nothing changes at `48rem`), no static `.media-grid__list` remains; home-menu labels carry no permanent underline and mark the current page by weight; the lightbox overlay is a fixed full-page rgba(0,0,0,.45–.55) layer below the lightbox while the drawer wash stays 0.25; navbar/logo tokens sit inside the brief's ranges per breakpoint and nothing hard-codes a logo height |

## 3. Browser evidence

`node scripts/screenshots.mjs --base http://127.0.0.1:3200 --scale 2` →
`docs/screenshots/report.json`: 46 entries, all `status=200`, `overflowOk=true`, no
`consoleErrors`, every `expect` assertion satisfied. (Run the production theme with
`HOSTNAME=0.0.0.0` as shown in §1: bound to `127.0.0.1` only, the not-found rewrite's
`localhost` hop never connects and the two 404 pages time out in the a11y audit.)

| # | Shot | What it proves |
| --- | --- | --- |
| 01 | `home-entrance-1440` | white viewport, centred CMS logo, drawn rule, Enter control, scroll cue |
| 02 | `home-menu-1440` | the entrance → menu transition: shrinking logo, row rules, staggered labels, mirrored elbow mark |
| 03 | `home-entrance-390` | the same entrance at phone width |
| 04–09 | `projects-{1920,1440,1024,768,390,320}` | 4/3/2 columns, **2 columns at 390 and 320**, mixed 3:2 / 3:4 / 1:1 frames from real dimensions |
| 10 | `project-detail-1440` | breadcrumbs, title, only real facts (compact `.facts` block), controlled hero ratio, content images rendered once through the lightbox (no duplicate gallery), related |
| 11 | `education-1440` | one featured entry + compact rows, honest reading time, thin separators |
| 12 | `blog-1440` | lead story + latest-notes column split by one fine vertical rule + article rows |
| 13 | `article-1440` | narrower prose measure inside 1440, metadata, rich text, related |
| 14 | `about-1440` | sparse composition, ~40–45% studio image in an inset frame, one contact link |
| 15 | `contact-1440` | two columns split by one fine divider, underline fields, real CMS details |
| 16 | `services-blocks-1440` | CMS blocks still render below the theme's own composition |
| 17 | `search-1440` | search results reuse the article-row geometry |
| 18 | `en-blog-1440` | LTR mirror: identity left, controls right, western digits, no letter-spacing |
| 19 | `en-contact-390` | English at phone width |
| 20 | `mobile-drawer-390` | drawer from the correct edge, row lines, ticks, language switch at the bottom |
| 21 | `skeletons-projects-1440` | **real skeleton inside the real shell** during a slow client navigation |
| 22 | `cms-unreachable-1440` | the honest "not connected" state, never a faked studio page |
| 23 | `holding-suspended-1440` | `suspended` → holding page, no portfolio content |
| 24 | `holding-suspended-1440-projects` | negative assertion: no project card element exists at all |
| 25–26 | `empty-{projects,blog}-1440` | empty archives resolve to the empty state, never an endless skeleton |
| 27 | `skeletons-projects-390` | the mobile skeleton is the real two-column project grid |
| 28 | `missing-logo-1440` | no logo in the CMS → site-name wordmark; no mark element is drawn |
| 29 | `long-labels-nav-1440` | long CMS labels wrap inside the navbar instead of overflowing |
| 30 | `invalid-form-390` | untouched submit surfaces field-level errors (`aria-invalid="true"`) |
| 39 | `form-success-1440` | the happy path through the real proxy to the CMS API |
| 31–32 | `zoom200-{home,projects}-1440` | 200% zoom: same layout, no clipping, no overflow |
| 33 | `reduced-motion-home-1440` | `prefers-reduced-motion` → final state immediately, no entrance animation |
| 34–38 | interior pages at 390 | education, article, about, contact, and the English mirror |
| 40 | `no-js-home-1440` | JavaScript disabled: the entrance's `<noscript>` menu offers every CMS destination, and the mark/rule/cue are revealed by the no-script stylesheet instead of staying at `opacity:0` |
| 41 | `lightbox-fa-1440` | the unified lightbox opened from a gallery thumbnail on a Persian page: dedicated 50% backdrop, image contained in the viewport, *previous* on the right with a right-pointing chevron, *next* pointing left, Persian counter |
| 42 | `lightbox-en-1440` | the same on an English page: mirrored controls (previous left, next right), Latin counter |
| 43 | `lightbox-fa-390` | the lightbox at phone width: image and control bar inside the viewport, body scroll locked |
| 44–45 | `services-blocks-{768,390}` | the gallery block (now actually rendering from array-row fixtures) in two columns at tablet **and** phone width — the 2/2/3 contract's mobile half |
| 46 | `project-detail-390` | the compact facts block in one column, label beside value, and the content image once |

### Structural accessibility (`npm run a11y`)

The screenshots prove what a page looks like; `scripts/a11y-audit.mjs` proves what a
picture cannot, in a real browser over 17 routes (both locales):

| Check | Rule | Result |
| --- | --- | --- |
| Exactly one `h1` per page | document outline | 17/17 |
| A `<main>` landmark | WCAG 1.3.1 / 2.4.1 | 17/17 |
| No skipped heading levels | heading order | 17/17 |
| Every `<img>` has an `alt`; no large image with an empty one | WCAG 1.1.1 | 17/17 |
| No duplicate `id` | WCAG 4.1.1 | 17/17 |
| Target ≥ 24×24 (an associated `<label>` counts as part of its control) | WCAG 2.2 SC 2.5.8 (AA) | 17/17 |
| Body text ≥ 4.5:1 against its resolved background | WCAG 2.5.5 / 1.4.3 | 17/17 |

Links inside a running sentence are exempt from SC 2.5.8 by the criterion itself; the
theme opts standalone navigational links (headings, list rows, contact details, footer)
into the floor with `.target-standalone`. The report is written to
`docs/screenshots/a11y-report.json` and the script exits non-zero on any failure.

### Interaction behaviour (`node scripts/interaction-audit.mjs`)

The brief asks for behaviour that no screenshot can prove, so it is driven in a real
browser and asserted:

| Check | Result |
| --- | --- |
| The Enter control is visible and ≥24px before any interaction | 44px |
| A keypress on the entrance opens the menu | 6 rows |
| Clicking the Enter control opens the menu | pass |
| The intro never replays once entered | pass |
| Tab stays inside the open drawer (14 tabs) | pass |
| Escape closes it, focus returns to the header, no scroll lock left behind | pass |
| Navigating from the drawer closes it | pass |
| A double submit reaches the CMS exactly once | 1 POST |
| A failed submit keeps the entered values | pass |
| The language link navigates before the menu is entered | `/en` |
| English archive controls and breadcrumbs stay under `/en` | pass |
| Search hits link to the section that owns the document | project detail opened |
| Wrong-section detail URLs redirect to the canonical section | pass |
| Blog category controls select a filter and reject cross-section slugs | pass |
| The drawer opens from its own edge with bounded motion, per locale | fa right / en left, 280 ms |
| An invalid email is blocked inline and posts nothing | pass |
| Long card metadata stays readable at 390px (2 cards per row) | title 166px in a 166px card |
| The licensed Shazde weights are installed and active | 300, 400, 500, 600, 700, 800, 900 |
| Decorative strokes follow the decorative token at 1x and 2x | 1px → 0.5px |
| Reduced motion: panel, rows and skeleton are static; the drawer still opens | pass |
| Slow archive navigation keeps the real header and its own composition | education featured + 4 rows; blog lead/latest split + rows |

Report: `docs/screenshots/interaction-report.json`; the script exits non-zero on failure.
The loading check needs a slow-CMS instance — pass `--slow-base` (or `AUDIT_SLOW_BASE`);
with none running it reports `skipped` rather than quietly passing. Both browser scripts
refuse to run against a server whose own CSS/JS 500s, because an unstyled page manufactures
defects that do not exist (see regression item 23).

### How the hard cases were made observable

Two of the brief's requirements are only *checkable* with deliberate setup, so the harness
does it rather than asserting them in prose:

- **Skeletons.** A warm connection prefetches both the target route's loading boundary and
  its data, so a normal client-side navigation completes instantly and never shows a
  skeleton. The two skeleton shots therefore throttle the network
  (`Network.emulateNetworkConditions`, 500 kbps / 400 ms) *after* the starting page has
  loaded, and wait for the specific selector (`.grid-projects .skeleton`) — not just any
  skeleton, because the root boundary renders first and is replaced a moment later.
- **Slow CMS.** The scenario's mock delays every read by 2.5 s (`--delay 2500`): slow enough
  that a navigation is still in flight when the shot is taken, fast enough that the page the
  shot starts from finishes loading.

## 4. Manual browser checks (beyond the scripted shots)

Performed through the same headless browser, reported here because they are behavioural and
not photographable in a still:

- **Home entrance → menu.** Wheel, `Enter`, `Space`, `ArrowDown` and `PageDown` all open the
  menu; the entrance is one bounded transition and does not replay on back-navigation.
- **Drawer.** Focus is trapped, `Escape` closes, focus returns to the trigger, `body` scroll
  lock is released, clicking a row navigates and the drawer closes on route change.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, the entrance renders its final
  state immediately; the skeleton pulse is static.
- **Long labels.** With `--mode longlabels` (every CMS label stretched ~40 characters), the
  navbar wraps and nothing overflows at 1440, 1024 or 390.
- **No logo.** With `--mode nologo` the wordmark replaces the mark on both the home stage and
  the interior navbar.
- **Form.** Invalid submit → field-level errors; valid submit → pending → success, forwarded
  through `/api/form-submissions` to the CMS.
- **404 / redirects.** `/shop` → real 404 with the designed page; `/posts/<slug>` → 307 to
  `/blog/<slug>`; `/home` → 307 to `/`; an unserved locale prefix → 404.

## 5. Manifest

`eshobe.theme.json` was validated **with the CMS's own parser**, not a re-implementation:
`parseThemeManifestText` from `src/lib/deploy/manifest.ts` (CMS @ `7fde2435`) with
`platformContractVersion` taken from `@eshobe/site-runtime`. Result: `ACCEPTED`, no errors.

```
key arch2-neutral · contractVersion 1 · siteTypes ["portfolio"] · locales ["fa","en"]
proxiesApi true · build dockerfile · port 3000 · health /api/health
deployment registry_image → ghcr.io/hamidnoshady/cms-arch3-theme (public)
env 10 × source "platform" (3 secret) · settings object (2) · contentSlots 7
```

`tests/manifest.test.ts` additionally pins the parts a type checker cannot: that every
declared slot is one the code resolves (and vice versa), that every declared capability is
implemented, that the build commands are the repository's real scripts, and that the
identifier is neutral.

## 6. Regression list — real defects found and fixed during this work

Each was reproduced in a browser or by a failing test before being fixed (37 items).

1. **CSS layers.** `styles/*.css` were unlayered and outranked Tailwind utilities, so
   `md:hidden` and `md:grid-cols-*` silently did nothing (the hamburger showed at 1440px).
   Fixed by wrapping each file in `@layer base` / `@layer components`.
2. **Server → client function leak.** `readingTime` (a function) was passed into the client
   `MobileMenu` through the labels dictionary; React refused to serialise it and **all**
   client JavaScript on the page died. Now only plain strings cross the boundary.
3. **Date crash.** Project cards threw `RangeError: Invalid time value` on the CMS text date
   `۱۴۰۴`. Added `src/lib/utils/dates.ts` (`parseDate` strict, `dateText`, `dateOrText`) and
   removed a fabricated "now" date from the search view.
4. **Invisible hero.** `HomeStage`'s line wrapper animated to `opacity: 0` and stayed there
   after the entrance. Found by probing hydration, not by reading the code.
5. **Footer year.** The copyright year used `formatNumber`, printing Gregorian `۲٬۰۲۶` on a
   Persian page. Now a *date*: `formatDate` prints the Jalali year (`۱۴۰۵`).
6. **Decorative mark outside the viewport.** In LTR the footer mark sat at x = −4 px because
   its containing block was the content box of a container that touches the viewport edge at
   1440. Repositioned inside an inner wrapper; the overflow report is now clean.
7. **`exists=false` read as truthy.** The fixture encoder turned the *string* `"false"` into
   truthy, which leaked education/project posts into `/blog`.
8. **Navbar overflow with long CMS labels.** A long menu label pushed the page 299 px wide;
   the navbar now shrinks and wraps instead.
9. **Skeleton pulse out of phase.** Each bar animated on its own timeline, so a block and its
   caption pulsed against each other and read as a glitch. One animation per *region* now.
10. **Missing segment loading boundaries.** A slow archive showed the root boundary (or
    nothing) because no `loading.tsx` existed below the root. Added per-segment boundaries
    that render the real chrome plus geometry-matched skeletons.
11. **Unverifiable skeleton claim.** The harness was capturing settled content and calling it
    a skeleton. Replaced with throttled, selector-verified captures.
12. **Phone autofill.** A phone field inherited `autoComplete="name"`; phone-like text fields
    now get `tel`, `inputMode="tel"` and LTR isolation inside the RTL form.
13. **Test-only stubs in production code.** `previewToken` and `fixturesEnabled` were imported
    but unused (lint warnings), caught by moving lint inside `verify`.
14. **Nav reference read by slug.** A `posts` menu reference stores a document *id*; passing it
    to `getPostBySlug` silently dropped the menu item. Added `getPostById` and a fixture menu
    entry whose id and slug differ, so the rule is pinned by a test (`tests/content.test.ts`)
    instead of by luck.
15. **Second, disagreeing link rule on the blog index.** The lead story and the rows below it
    resolved the same archive with two different rules, so a post could link to `/blog/<slug>`
    in one place and `/projects/<slug>` in another. One section-aware href map now serves the
    whole page.
16. **Language switch dropped the search term.** `/search?q=…` switched language to a bare
    `/en/search`. Locale-neutral queries are carried over; category slugs deliberately are not,
    because they belong to one locale.
17. **Double locale prefix on the English home.** The home language switch pre-applied the
    locale before `href` applied it again, so `/en` offered `/en/en` for "English" and pointed
    "فارسی" back at `/en`. The switch now takes the locale-neutral home path; both directions
    are covered by tests and by shots 01/03.
18. **Absent landmarks and heading.** The home stage and both 404 routes had no `<main>`,
    and the stage had no `h1` at all — a screen reader had no landmark to jump to and no
    page heading. The stage is now the `main` landmark and the studio mark is its `h1`
    (the entrance is already a distinct state, so a visually hidden duplicate heading
    would be the same thing twice); both 404 routes got their own `main`.
19. **Two sub-24px pointer targets.** Breadcrumb links measured 23×24 and a checkbox
    label's own line box 13px tall, under WCAG 2.2 SC 2.5.8 (24×24, AA). Breadcrumb links
    now carry a 24px floor on both axes and standalone links opt in via
    `.target-standalone`; the checkbox label is a 24px-tall, pointer-cursor target.
20. **404 pages titled with the studio name.** A page-level *static* `metadata` export
    merged its `robots` but lost its `title` to the root layout, so every unknown URL was
    titled «استودیوی نمونه» rather than «صفحه پیدا نشد — استودیوی نمونه». Both 404 routes
    now use `generateMetadata`, like every other route here.
21. **No skip link.** The shell exposed `<main id="content">` but nothing linked to it, so a
    keyboard visitor had to walk the whole navbar. A focus-revealed skip link is now the
    first tab stop on interior pages.
22. **A checkbox with no `name`.** Every other field in the contact form carried its CMS
    field name; the checkbox was the only control that did not, so it could not be found or
    submitted by name. Now rendered like its siblings.
23. **A stale asset manifest looks like a theme bug.** `next build` wipes
    `.next/standalone/`, and a server booted before it keeps serving the *old* asset
    hashes while the static directory holds the new ones — HTML 200s and every
    `/_next/static/*` request 500s. Two browser audits then "found" an unstyled, 21px
    Enter control and a lost form submission, neither of which exists on a healthy build.
    `qa-servers.sh` now verifies a real CSS/JS asset per theme at startup, and both
    browser audits refuse to run until the served stylesheet returns `text/css`.
24. **DOM leaking between jsdom tests.** Testing Library's automatic cleanup only
    registers when the test globals are on; this project imports `describe`/`it`
    explicitly, so a previous test's tree survived and `findByText` matched *two*
    components — the honeypot test failed for a reason that had nothing to do with the
    form. `tests/setup.ts` now unmounts after every test (lazily, since most suites run
    in the `node` environment).
25. **Dead end without JavaScript.** The entrance's menu is a client state change and the logo,
    rule and cue are server-rendered at `opacity: 0`, so a visitor with scripting off saw a
    blank stage and no way into the site. A `<noscript>` menu now lists the same CMS
    destinations and a no-script stylesheet reveals the stage — captured as shot 40.
26. **English archives lost their locale.** Filter chips, reset links, pagination and the
    search form were built from hardcoded Persian paths, so `/en/projects` filtered into
    `/projects`. All four now go through the locale URL helper; pagination carries a
    localized label, Persian digits and the category/page state.
27. **The Persian mobile drawer opened from the left.** `inset-inline-end: 0` is the
    physical left in RTL, with the divider on the wrong edge. The panel now anchors to the
    inline-start edge (right in fa, left in en), hairline on the exposed inner edge, with a
    280 ms direction-aware entrance/exit and a short row stagger.
28. **Reduced motion did not stop the RTL drawer.** The reset selector (0,2,0) lost
    `animation-name` to the RTL override `[dir='rtl'] …` (0,3,0), so the panel still
    travelled. The reset now repeats the direction-qualified selectors, and the interaction
    audit pins computed `animationName: none` for panel, rows and skeleton.
29. **Project cards collapsed under realistic metadata.** `white-space: nowrap` metadata in
    one shrinkable flex row reduced a title to an 11px column. Captions now wrap with
    `min-inline-size: 0`; two cards per mobile row and a 390px stress check hold the
    geometry.
30. **The homepage consumed Enter on the language link.** A window-level keydown called
    `preventDefault()` for navigation keys regardless of target, so keyboard language
    switching never left `/`. The handler now ignores interactive targets and modifier
    chords, and opening the menu moves focus into it.
31. **Search sent project and education hits to blog pages.** Every hit used the article URL,
    and `ArticleView` accepted any section. Hits now resolve through the archive's canonical
    section rule, and wrong-section detail URLs redirect to their real composition.
32. **A category query replaced the archive's section.** `/projects?category=workshops`
    rendered education posts as project cards. Membership is validated inside the active
    subtree (a cross-section slug yields the empty state), and blog filters are exposed,
    selected and consumed.
33. **Invalid email bypassed field validation.** `noValidate` plus an empty-only check let
    `not-an-email` reach the CMS. The form now validates email and numbers, focuses the
    first invalid field, maps the CMS `{errors:[{field,message}]}` shape onto fields, and
    keeps values in a stable live region.
34. **Education and blog skeletons were generic.** Loading showed compact rows without the
    featured entry or the lead/latest split. Each archive now renders a composition-matched
    skeleton sharing the resolved header geometry, with one localized loading sentence.
35. **The gallery's arrow keys were only a comment.** ArrowLeft/ArrowRight now step
    direction-aware (ArrowLeft advances in RTL), with a localized dialog title and
    Persian-digit counter; the decorative SVG strokes are driven by `--line-w-decor`
    instead of a hardcoded `1`, pinned at 1x/2x.
36. **The Persian @font-face format string Safari would skip.** The family was declared
    `format('woff2-variations')`; it now declares `format('woff2')`, and only installed
    weights are declared (100/200 are absent from the licensed family and reported as
    such).
37. **The loading audit raced the skeleton→content swap.** The check waited for any
    `.skeleton-region`, then sampled after the inline swap had replaced it, so it
    intermittently asserted against the resolved page. It now captures through a throttled
    client navigation and waits for the variant's own selector (`.entry-row--compact`,
    `.split`) inside `waitForFunction`.
38. **The language switch listed both languages.** It compared `entry.label` with the
    current *locale*, which never matched, so a Persian page offered «فارسی» next to
    «English» — a status line, not a control. `LanguageSwitch` now filters by locale and
    renders only the other language; the home stage uses the same component instead of
    its own inline list, so header, drawer and entrance agree. A missing translation is
    still quiet text, never a link to the other home page.
39. **Project content images rendered twice.** `ProjectDetailView` collected every medium
    in `content` into a second `<Gallery>` under the narrative, so each photograph the
    editor placed appeared again. The duplicate section is gone; the images open through
    the one `LightboxScope` the rich-text renderer owns, in document order.
40. **Three image implementations, one lightbox.** Prose uploads and inline `mediaGrid`s
    were static images with their own grid class; only gallery blocks had a lightbox.
    All of them are now `LightboxTrigger`s; `.media-grid__list` is deleted in favour of
    `.grid-media`, whose third column moves from `48rem` to `64rem` (2/2/3).
41. **The lightbox borrowed the drawer's overlay.** `ui/dialog` reused `.drawer__overlay`
    (25% black), so the lightbox had the navigation wash behind a photograph and the two
    could not be tuned apart. The lightbox has `.lightbox__overlay` (50%), `ui/dialog` has
    `.dialog__overlay`, and the drawer is untouched.
42. **Previous/next ignored the reading direction.** The icons were fixed chevrons and the
    keyboard mapping lived in a comment. Label, icon, click, Arrow key and slide
    direction are now derived from one `arrowAdvances(key, locale)` rule and pinned per
    locale in `tests/gallery.test.tsx`.
43. **The logo was a Tailwind `h-8`.** `Logo.tsx` hard-coded a 32px height and preferred
    the compact mark everywhere; the navbar was `min-block-size: 68px`. Both now come from
    the chrome tokens (82/88/94px bar, 42/46/52px logo), the primary asset serves desktop
    through `<picture>`, and `ui-contract.test.ts` pins the ranges.
44. **The gallery block never rendered in fixtures.** Its rows are `{ image: <Media> }`
    (a Payload array field) while the renderer read bare media only, so the services
    page silently dropped the block — the committed screenshot has no gallery at all.
    `GalleryBlock` now reads both the documented `[<Media>…]` shape and array rows.
45. **A digit-only project fact drifted to the far end of its cell.** `dir="auto"` on the
    value isolates a Latin run inside Persian copy, but a bare year has no strong character
    and resolves to LTR; `text-align: match-parent` keeps every value on the label column.

## 7. What is *not* verified

See `docs/LIMITATIONS.md` for the full list and reasoning. Summary: licensed Shazde files
(the 300–900 weights are installed in this working copy and verified live in §8;
redistributing them is the deployment's licensing decision, and 100/200 do not exist in
the family), the real CMS and media CDN (the shape-compatible mock is the reproducible
path; §8 records one live pass against `eshobe-cms`, and real media is still same-origin
placeholders), `next dev` hydration (limited by the original sandbox websocket; §8 records
a live dev-mode pass on another host), the CMS's real preview signature (the HMAC path is
unit-tested), and any deployment (none was requested and none was performed).

## 8. Live re-verification against eshobe-cms (2026-10-04)

Beyond the mock topology above, the theme was re-run against the real **eshobe-cms** dev
server (Payload 3, the seeded `studio.localhost` portfolio site) on a Windows host: theme on
`localhost:3002`, tenant resolved by a site API key, system Chrome supplied through the new
`ARCH2_CHROME_PATH` escape hatch.

| Check | Command | Result |
| --- | --- | --- |
| Structural a11y | `a11y-audit.mjs --base http://localhost:3002 --paths …` | **11/11 pages clean** (the harness refreshes `docs/screenshots/live-cms/a11y-report.json` on every run and records its own `base`; the current copy is the newer mock-topology pass at 17/17) |
| Interaction | `interaction-audit.mjs --base http://localhost:3002` | **9/9 checks pass** (the double-submit check files one real submission in the dev CMS; the failure case is intercepted, not sent) |
| Production build | `npm run build` | compiles, all routes emitted |
| Tests | `npm test` | **12 files, 108 tests** |
| Manifest | the CMS's own `parseThemeManifestText` (platform contractVersion 1) | **accepted, no errors, no warnings** |
| Routes | curl against the theme | `/`, `/projects`, `/projects/baagh-manzel`, `/education`, `/education/kargah-memari-paydar`, `/blog`, `/blog/first-post`, `/about`, `/contact`, `/search?q=…` → 200; unknown slug → real 404; `/en` → 404 because the site serves `fa` only |
| Projects grid | browser computed styles at four widths | 2 columns at 390 and 768, 3 at 1024, 4 at 1440 |
| Fonts | browser network + `document.fonts` | all seven installed Shazde weights (300–900) load 200; `body` resolves `Shazde` first |

Since this pass the harnesses have grown: `npm test` is now **16 files / 171 tests** and
`interaction-audit.mjs` runs **21 checks** (§2). The figures above are the state of the live
pass, not today's limits.

**Defects found and fixed by this live pass** (each now has a regression guard):

1. **Search filtered the index by `_status`** — the CMS search index has no such field, so
   the CMS answered 400 and the whole search page fell into the error boundary.
   `searchPosts` no longer adds the filter (the index holds published documents only) and
   `tests/content.test.ts` pins the exact query.
2. **The error state had no `main`/`h1`** — the one surface a screen reader could not land
   in or name. `ErrorState` (and the holding/unreachable states) now own `<main
   id="content">` and an `h1`.
3. **Tablet projects showed three columns** — the brief asks for two. The grid is now
   2 / 2 / 3 / 4 at <1024 / 768 / 1024 / 1280; screenshots 06–07 predate the change.
4. **The audits could not run off the sandbox image** — both now accept
   `ARCH2_CHROME_PATH`, and the asset probe cache-busts so a revalidated (304) stylesheet
   is re-fetched from the server instead of passing on the browser cache.

Not covered by this pass: media on a real object-storage CDN, the CMS's real preview
signature, and any deployment.
