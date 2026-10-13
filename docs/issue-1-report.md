# Issue #1 — the infinite canvas, the cursor, and click-to-open: what was built

> Report for [`hamidnoshady/cms-portfolio-theme#1`](https://github.com/hamidnoshady/cms-portfolio-theme/issues/1),
> written against commit `770003d` (the revision the issue inspected) on branch
> `arena/8e0c89cc-cms-portfolio-theme`. Every number below is from a command run in this
> working copy; the commands are named so they can be re-run.

## 1. Implemented

**The home page is a spatial canvas, not a slider.** `src/components/home/canvasPlan.ts`
places the works on a jittered lattice inside a *plane* two viewports on each side, with
sizes, crops (every third tile takes a deliberate crop), depths and angles all derived from
a stable hash of each work's identity — so the composition exists in the served HTML, is
identical on every render, and never depends on the order a query answered.

**The page scrolls forever.** `src/components/home/panEngine.ts` treats the plane as a
torus: the assembly repeats with a period of exactly one plane, and `place()` wraps each
tile by whole periods while it is completely outside the viewport (guaranteed by
`period >= viewport + 2 × largest tile`). Panning is a single `transform` on
`.bang-canvas__world` plus a per-tile correction that only ever fires off screen. The DOM
is one element per cell for the whole session — 12 tiles and 148 nodes in every frame of
the recorded sequences.

**The cursor is the studio's own** (`src/components/home/CustomCursor.tsx`): a small square
that trails the pointer, grows and hollows over a work, and carries the work's own title
(CMS content, never invented copy). It is `pointer-events: none`, hidden under
`html[data-bang-overlay='open']`, and never engages on a coarse pointer, a keyboard-only
visit or `prefers-reduced-motion` — the system cursor is left alone there.

**Clicking a project image opens that project, over the canvas.** Tiles are `next/link`
navigations into the intercepted routes in `src/app/@overlay`, so the case study opens in a
modal panel (`role="dialog"`, `aria-modal`, Escape, focus moved in, the page behind it
`inert`, scroll locked) while the canvas stays mounted underneath — and closing unwinds the
history entry, returning the visitor to the exact place on the field. A direct visit or a
refresh renders the canonical server page instead.

Also in this change: the static presentation (no script, reduced motion, or the CMS turning
`canvasMotion` off) fits the whole plane into the box with every work reachable; the
selected-work index is the one canonical destination per work and doubles as a disclosure
on the canvas; the hero mark is drawn at logo scale; the footer links carry the theme's
44px target; the case study owns the tab title while it is open.

## 2. Bugs fixed

Each of these was found by the new browser audits or the new tests, and each is written up
with its cause in `docs/QA.md` §6 (items 46–55):

1. The field covered one screenful, so sustained panning reached an empty frame — the
   "end" the reference never shows.
2. The phone tile scale (185%) pushed the largest tile onto the wrap tangency line, where a
   tile could be corrected while visible — a visible teleport.
3. Tiles were plain `<a>` elements, so a click was a full navigation: the intercepted route
   never matched and the canvas was thrown away.
4. `setPointerCapture` on `pointerdown` swallowed every click, so no tile could open
   anything.
5. The custom cursor used `inset-inline-start`, which put it one viewport width off in RTL.
6. An open case study left the studio's name in the tab (parallel-slot metadata).
7. The field kept gliding for up to ~100px behind an open work, so "closing restores the
   canvas context" was false.
8. The uploaded square logo was stretched into a 672×342 hero mark.
9. The canvas' footer links were 23px tall (WCAG 2.2 SC 2.5.8 failure on `/` and `/en`
   only).
10. The form-success screenshot asserted an unscoped `[aria-live]` and matched a copy-link
    control, so a working submission read as a failure.

## 3. Architecture changes

- **Pure core, thin shell.** Composition (`canvasPlan.ts`) and motion
  (`panEngine.ts`) are dependency-free and DOM-free; `CanvasField.tsx` only measures,
  binds and paints. Geometry that used to be argued about in pixels is now arithmetic with
  tests.
- **One plane, one period.** The stylesheet owns `--bang-plane` and the tile budget;
  `canvasPlan.ts` mirrors the numbers; a test reads both files and fails if they drift.
  Physical offsets (`left`/`top`) replace logical ones in the field and the cursor, because
  the composition and `getBoundingClientRect` have to share one coordinate system — logical
  properties mirror in RTL.
- **Attribute-driven presentations.** `html[data-bang-canvas]`, `[data-bang-cursor]`,
  `[data-bang-index]`, `[data-bang-overlay]` are the only switches. The stylesheet never has
  to know whether a script has run, which is why the no-JS and reduced-motion presentations
  are the server-rendered ones.
- **The case study is one template, two presentations** (`variant='page' | 'overlay'`) with
  the shell in `components/portfolio/CaseStudyShell.tsx`, so the modal semantics are tested
  once and the canonical route stays untouched.

## 4. UX/UI changes

- Home: chrome floats over the field (compact logo, CMS navigation, language switch, clocks,
  footer); the wordmark sits over the photographs with `difference` blending for text marks
  and at logo scale for uploaded marks; the selected-work index is a corner disclosure on
  the canvas and an open section everywhere else.
- Wheel and trackpad pan with the reference's direction and momentum; drag and touch pan
  1:1 and carry a released flick into friction; a drag never opens a work and a click always
  does.
- Reduced motion gets a static, scrollable page with the whole field visible and the work
  list open; touch gets the same bounded field with larger frames.
- Motion evidence lives in `docs/screenshots/bang-home/` (8 stills) and
  `docs/screenshots/bang-home/motion/` (frame sequences, a GIF, contact sheets and
  `motion-report.json`).

## 5. Security changes

None weakened; the canvas is inside the existing contracts.

- Tiles link only to URLs the theme itself builds (`localizedPostHref`), and only for
  published, non-draft posts the archive call returned.
- The custom cursor renders CMS text through React (no `innerHTML`), and the mark is an
  `<img>` — never inlined SVG.
- The overlay keeps the page behind it `inert` and does not introduce a new data path: it
  reuses `loadPageContext`/`getPostContext` and the existing preview/revalidation rules.
- No new proxy, no new origin, no new client-side fetch.

## 6. Dead/legacy code removed

- `src/components/portfolio/CanvasStage.tsx` (the carousel) and
  `src/components/home/HomeStage.tsx` (the orphaned entrance) are deleted; tests assert both
  paths no longer exist.
- The orphaned `.home-*` / `.menu-row` stylesheet block is gone; a test fails if any of those
  selectors returns.
- The interaction audit's home block no longer asserts dots, a pause control or a rotating
  featured work.
- Three screenshot files that depicted the removed entrance/menu are deleted
  (`01-home-entrance-1440.png`, `02-home-menu-1440.png`, `03-home-entrance-390.png`), replaced
  by the three canvas shots.
- Nothing was removed on a reference count alone; every deletion is one of the two
  superseded components or a capture of them.

## 7. Tests added/updated

| File | Tests | What it now covers |
| --- | --- | --- |
| `tests/home-canvas.test.ts` | 15 | determinism, bounds, coverage at 4 viewports × 5 archive sizes, no visible wrap correction, plane/tile-budget agreement with the stylesheet, wrapping/momentum/settle |
| `tests/home-shell.test.tsx` | 12 | tiles as links with stable identity, hidden field with no duplicated tab stops, the index as section or disclosure, cursor modes and labels |
| `tests/case-study-overlay.test.tsx` | 10 | dialog semantics, inert page, Escape/close, title ownership, intercepted routes in both sections and locales |
| `tests/ui-contract.test.ts` | 25 | the plane rules, the tile box from composition variables (including the plane-relative height cap), physical offsets, no carousel or dead selectors left |

`npm test` → **25 files, 291 tests, all passing** (was 289 before this round; two tests were
added for the freeze/title behaviour and the disclosure).

## 8. Exact verification and CI results

| Command | Result |
| --- | --- |
| `npm run validate:manifest` | valid for the registry-image contract |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 25 files, 291 tests passed |
| `npm run build` | Next 16.3.8, 33 routes, no warnings |
| `node scripts/screenshots.mjs --base http://127.0.0.1:3200` | **46/46 shots**, status 200, `overflowOk`, no expect failures, no console errors |
| `node scripts/a11y-audit.mjs --base http://127.0.0.1:3200` | **17/17 pages clean** |
| `node scripts/interaction-audit.mjs --base … --slow-base http://127.0.0.1:3300` | **20/20 checks pass** |
| `node scripts/home-canvas-audit.mjs --base http://127.0.0.1:3200` | **31/31 checks pass** |
| `node scripts/home-canvas-motion.mjs --base http://127.0.0.1:3200` | **13/13 checks pass**, 22 frames + GIF + 2 contact sheets |

All runs are against the production standalone build
(`npm run build && ARCH2_INCLUDE_QA=1 npm run prepare:standalone` + `.next/standalone/server.js`)
with the mock CMS, i.e. the same topology CI uses. The new audits are wired into
`.github/workflows/ci.yml` (job `audits`, after the a11y/interaction pair) with
`ARCH2_CHROME_PATH=/usr/bin/google-chrome`, and their reports are uploaded as artifacts;
`npm run audit:home` and `npm run audit:home:motion` run them locally. No test was weakened,
disabled or re-baselined, and no budget was raised.

## 9. Genuine remaining issues

1. **Pixel fidelity to `bybang.co` is unverified and unclaimed.** The reference is
   client-rendered, this sandbox has no egress, and `docs/screenshots/*` are captures of an
   earlier Persian-RTL build of this theme. The reconstruction is documented in
   `docs/bang-eshobe-rebuild-plan.md`; the composition, tile sizing, cursor geometry, wheel
   speed, momentum and ease are this theme's numbers, constrained by the behaviours the
   issue describes and pinned by tests — not measured against the reference.
2. **Without JavaScript every route shows the loading state.** The theme's Suspense
   boundaries (`loading.tsx` per segment) mean a JS-less browser never sees the streamed
   swap — true of the untouched archives as well. The audit asserts both halves; closing it
   properly is a routing redesign, not a canvas fix (`docs/LIMITATIONS.md` §10).
3. **Touch behaviour is inferred, not recorded.** `home-canvas-motion.mjs` drives a mouse
   (headless Chromium has no touch input device here). Pointer events are one code path, and
   the phone field is audited for geometry and overflow, but no recorded touch sequence
   exists.
4. **No deployed revision was verified.** This branch is not deployed and the sandbox has no
   network egress, so "the live preview is a stale build" could not be checked either way.
5. **Hover/focus parity on the field is asserted, not photographed.** Keyboard navigation
   reaches every work through the index (audited), but the canvas' hover scale is only
   covered by the CSS contract.
6. **The other public sections were not re-photographed against the reference.** Archives,
   case studies, about, contact, careers, legal, the mobile drawer and the language switch
   are green in the a11y/interaction/screenshot suites, but that is their *own* contract —
   comparing them scene by scene with `bybang.co` needs a browser that can reach it.
