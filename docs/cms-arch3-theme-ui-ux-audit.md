# cms-arch3-theme — UI and UX audit

Audited 4 October 2026. Repository: [hamidnoshady/cms-arch3-theme](https://github.com/hamidnoshady/cms-arch3-theme). Pinned commit: [24ea8f6](https://github.com/hamidnoshady/cms-arch3-theme/commit/24ea8f6f102f83459b36fd257364db3e802763d1).

## Verdict

The theme has the right foundation for the final **new, unnamed architecture theme**: white/black surfaces, sharp corners, generous whitespace, structural separators, decorative drafting marks, reusable components, a full-width navbar, and centered content capped at 1440px. Projects, education, and blog have different compositions.

It is **not ready for final UI/UX sign-off**. The main remaining problems are English navigation losing its locale, incorrect Persian drawer placement, mobile card captions breaking with realistic metadata, homepage keyboard interception, and search results opening the wrong page composition. Animation and loading implementation also fall short of the brief in specific places.

The audit uses the final `new-architecture-theme-full-prompt.md` as the design baseline. Earlier boxed-layout and Graphite directions are superseded. Repository code was not changed.

## What was checked

- Cloned and pinned the actual repository; read design tokens, styles, page views, navigation, media, forms, loading components, localization, content adapters and relevant tests.
- Ran `npm ci` and `npm run verify`: TypeScript, lint, **105 tests in 11 files**, and production build passed. ESLint printed an upstream AwaitExpression analysis diagnostic but did not fail.
- Served the production standalone build against the repository's HTTP mock CMS.
- Independently reran the repository's accessibility harness: **17/17 pages passed**. This is a limited structural/contrast/target check, not a comprehensive accessibility certification.
- Independently reran the interaction harness: **9/9 checks passed**.
- Added external, temporary browser audit scripts to check drawer position/motion, English controls, homepage keyboard behavior, invalid email, taxonomy filters, card metadata stress, and responsive geometry.
- Inspected 11 representative committed screenshots covering home states, desktop/mobile projects, education, blog, about, contact and project details. These are repository-supplied visual evidence, separate from the new audit captures.
- Measured project grids at 320, 390, 768, 1024, 1440 and 1920 CSS pixels. No document-level horizontal overflow in the baseline fixture pages.

**Limits:** This checks a local production build with mock content. No deployed website, real Payload tenant, real CDN, licensed Shazde assets, Safari/iOS/Firefox, real screen-reader session, or field performance metrics were available. English fixture content itself remains mostly Persian; that is not evidence of a production translation defect. Multi-page pagination is established by source review because the fixture archives fit on one page.

## Prompt compliance

| Requirement | Result |
|---|---|
| Next.js App Router, React, TypeScript, Tailwind | Implemented; production build passes |
| Selected shadcn-style/Radix primitives | Present for Sheet, Dialog, Button, Skeleton, Accordion and Select; several simple controls are custom/native |
| Reusable theme-owned components | Present: containers, headers, rules, marks, cards, rows, chrome, forms, states |
| White/black UI, zero-radius corners | Implemented |
| Full-width navbar, centered max-1440 content | Implemented; 1920px viewport measured a 1440px outer content box |
| Two project cards on mobile | Verified at 320 and 390px |
| Portrait/landscape/square project images | Implemented using 3:4, 3:2 and 1:1 frames |
| Frame inside photograph, inset 5px | Verified; not white image padding |
| Distinct education and blog layouts | Implemented: education feature + rows; blog lead + latest notes + rows when enough posts exist |
| Sparse About and compact Contact intent | Present; contact's generic CMS block wrapper adds avoidable spacing |
| Breadcrumbs on interiors, none on home | Implemented |
| RTL first, English second | Root direction works; drawer and several controls fail the intended behavior |
| Theme-owned typography, Shazde 100–900 | Central typography works; **Shazde is not installed** |
| Home logo entrance → bounded menu reveal | Works through click/gesture/key; uploaded logo fades, theme rule draws; keyboard handling needs correction |
| Creative but restrained mobile navigation | Icon treatment present; correct RTL edge, panel motion and row stagger missing |
| Geometry-matched skeletons | Partial: project grid matches; education/blog loading compositions do not |
| Fine structural + decorative lines | Present; SVG decoration thickness does not consume the line-width token |
| Honest CMS/empty/error states | Implemented in source and repository scenarios; real CMS integration still unverified |

## Findings and concrete fixes

P1 means fix before UI/UX sign-off. P2 means complete the specified behavior or polish before final release. Provisioning and subjective design recommendations are identified separately.

### F01 — P1: English archive and search controls return to Persian

**Observed:** `/en/projects` renders filter URLs such as `/projects?category=residential`. `/en/education` renders `/education?category=workshops`. English search submits to `/search`. Archive pagination also receives unlocalized base paths in all three views.

**Cause:** Hardcoded locale-neutral paths are used directly for controls rather than passed through the locale URL helper.

**Fix:** Localize filter/reset links, pagination base paths and search action once through the shared routing helper. Preserve the category/query/page where appropriate. Localize pagination's accessible label and display Persian page digits through the central formatter.

**Acceptance:** Filtering, clearing a filter, moving pages and submitting search from every English archive stay under `/en`; Persian remains under the unprefixed routes.

Sources: [ProjectsIndexView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/ProjectsIndexView.tsx#L60-L106), [EducationIndexView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/EducationIndexView.tsx#L65-L80), [SearchView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/SearchView.tsx#L52).

### F02 — P1: Persian mobile drawer opens from the left

**Observed:** At 390px, both Persian and English panels start at x=0 and are approximately 343px wide. Persian should open from the right.

**Cause:** RTL CSS uses `inset-inline-end: 0`, which is the physical left edge in RTL. Its divider is consequently on the wrong exposed edge too.

**Fix:** Anchor the panel at inline-start for each direction and place the divider on the exposed inner edge. Prefer direction selectors scoped to the panel itself.

**Acceptance:** Persian panel touches the right edge; English touches the left. Verify both locales in the actual portal, including edge divider and safe-area handling.

Source: [components.css](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/styles/components.css#L305-L328). New evidence: `fa-drawer.png`, `en-drawer.png`.

### F03 — P1: Mobile project metadata collapses the title

**Observed:** Replacing one card's location with “تهران، منطقه شمال غرب — ۱۴۰۴” in the rendered DOM reduced its title to **11px wide**, producing a vertical stack of characters. Metadata extended outside its own card. The page's global overflow check still passed.

**Cause:** A single flex row combines a shrinkable title, a fixed gap and `white-space: nowrap` metadata.

**Fix:** Stack title and metadata on narrow cards, or use a constrained grid with wrapping metadata. Keep two cards per mobile row. Apply `min-inline-size: 0` and sensible text wrapping to both fields.

**Acceptance:** Long Persian/English titles, locations and years remain readable inside 130–175px cards, without overlapping adjacent cards or becoming single-character columns.

Sources: [ProjectCard](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/projects/ProjectCard.tsx#L46-L49), [caption CSS](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/styles/components.css#L400-L410). New evidence: `long-project-location.png`. This is a controlled stress test, not an assertion about existing customer content.

### F04 — P1: Homepage consumes Enter on the language link

**Observed:** Focus English on the initial Persian homepage and press Enter: the menu opens, but the URL stays `/`.

**Cause:** A window-level handler calls `preventDefault()` for Enter/Space/navigation keys regardless of the focused target.

**Fix:** Ignore events from links, buttons and other interactive targets; let the Enter button use its own click handler. Restrict stage shortcuts to the intended stage/background context. After entering, deliberately manage focus into the revealed menu when appropriate.

**Acceptance:** Keyboard language switching works before menu entry; stage shortcuts still work; menu entry does not remove the focused Enter button without a useful focus destination.

Source: [HomeStage](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/home/HomeStage.tsx#L115-L125).

### F05 — P1: Search sends project/education hits to blog pages

**Observed:** English search for نور returned links `/en/blog/khaneye-noor` and `/en/blog/workshop-light`, instead of their project and education routes.

**Cause:** Every search hit uses `articlePath(hit.slug)`. ArticleView accepts the post without enforcing the section, so the wrong URL can display the article composition and breadcrumbs rather than redirecting to the correct detail page.

**Fix:** Resolve each hit's post reference/category through the same canonical section resolver used by archives. Redirect mismatched detail routes to the canonical section rather than rendering duplicate compositions.

**Acceptance:** A project search result opens ProjectDetail with project facts/gallery; education opens its education detail; notes open Blog. Each document has consistent breadcrumbs, language switching and canonical URL.

Source: [SearchView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/SearchView.tsx#L75-L79), [ArticleView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/ArticleView.tsx).

### F06 — P2: Mobile panel and row animation are absent

**Observed:** The drawer panel and all six links have computed animation-name `none`. Panel transition duration is not configured. There is no slide transform or link stagger in the source. The hamburger/X alone has a transition.

**Fix:** Add a direction-aware 250–350ms panel entrance/exit and a short, small-distance row stagger. Define any overlay keyframes actually referenced. Keep Radix focus management and scroll locking intact; make reduced motion immediate.

**Acceptance:** Opening and closing animate from the correct edge, rows settle quickly, and rapid repeated toggles do not strand the panel or focus.

Sources: [Sheet](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/ui/sheet.tsx), [drawer CSS](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/styles/components.css#L296-L381).

### F07 — P2: Invalid email bypasses field validation

**Observed:** With other required fields filled, `not-an-email` reached the submission endpoint and no field error appeared. The audit intercepted the request and returned 422; no real enquiry was sent.

**Cause:** `noValidate` disables native validation, while custom validation only checks whether required fields are empty. API errors become one generic form message.

**Fix:** Validate email and supported numeric constraints, focus the first invalid field, and map documented CMS validation errors to fields while preserving entered values. Use a stable live region for submission outcomes.

**Acceptance:** Invalid email is blocked with a tied field error; correcting it clears the error; recoverable API failures retain values.

Source: [CmsForm](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/forms/CmsForm.tsx).

### F08 — P2: Archive category filtering is incomplete and insufficiently scoped

**Observed:** `/projects?category=workshops` displays education workshops as project cards. A category query replaces the section restriction rather than intersecting with it.

Blog is a separate incomplete path: `getSectionCategories('blog')` always returns no children, so its filter controls never render; blog routes ignore `category` altogether. This is not a currently visible broken blog button.

**Fix:** Validate category membership within the active archive subtree. If blog filters are part of the intended feature, expose applicable categories, consume the query, show selected/reset states, and preserve the filter in pagination.

**Acceptance:** Education content cannot appear as project cards through a query string. Every offered filter has a visible selection state and actually changes the results.

Source: [content.ts](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/lib/cms/content.ts#L117-L190), [BlogIndexView](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/views/BlogIndexView.tsx).

### F09 — P2: Education/blog skeletons do not match the final composition

Education loading shows compact rows without its featured entry. Blog loading shows generic rows without the lead/latest two-column region. Neither represents the actual section header/filter geometry. This contradicts comments claiming geometry parity and can cause substantial layout changes when data arrives. The project grid skeleton itself uses the correct two-mobile-column grid and mixed ratios.

**Fix:** Give each archive a composition-specific skeleton sharing the same section header spacing and layout primitives as the resolved view. Use localized “Loading…” feedback instead of only an ellipsis. Missing media after data resolves should have a stable empty-media treatment, not an indefinite loading-looking block.

**Acceptance:** Slow navigation preserves section anchors, education feature and blog split geometry; screen readers receive concise feedback; empty or absent media is distinguishable from in-flight content.

Sources: [SectionLoading](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/states/SectionLoading.tsx), [States](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/states/States.tsx), [CmsImage](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/media/CmsImage.tsx).

### F10 — Provisioning gap: Shazde is configured, not delivered

No Shazde font files are committed. Persian uses Vazirmatn Variable; English uses Inter. The theme accurately discloses the fallback. This is an open asset requirement, not a reason to fabricate licensed files.

**Fix:** Supply licensed Shazde files using the names actually recognized by `shazdeFiles()` (for example `Shazde-Regular.woff2`, not the lowercase filenames mentioned in some documentation). Recheck wrapping, card captions and headings after installation. Keep fallback faces available for partial installation and explicitly disable synthetic weights/styles if genuine weights are required.

**Acceptance:** Browser font inspection confirms the supplied Shazde weights; no mislabeled or fabricated face is used; both locales pass the responsive checks after font substitution.

Source: [fonts.ts](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/lib/theme/fonts.ts), [limitations](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/docs/LIMITATIONS.md).

### F11 — P2: Decorative SVG strokes ignore the fine-line width token

Structural lines consume `--line-w`, which has a high-density half-pixel branch. DecorativeMark always emits `strokeWidth="1"`; `--line-w-decor` does not control those SVGs. Decorations therefore cannot be tuned consistently through the intended theme system.

**Fix:** Connect SVG stroke widths to the decorative token and validate actual rasterization at 1x/2x. Retain opacity-based fallback where borders round to a device-visible pixel; do not make essential focus/control states faint.

**Acceptance:** Changing the decorative width token changes all drafting marks consistently, while structural rules and accessible control boundaries remain independent.

Sources: [DecorativeMark](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/design/DecorativeMark.tsx), [tokens](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/styles/tokens.css).

### F12 — P2/source review: Gallery promises arrow-key navigation but implements no handler

The Gallery comment promises arrow-key navigation. Its actual controls implement button clicks only; no keydown handler is attached. Tab/Enter and Radix Escape remain available. The fixture contains one gallery item, so this audit did not claim that an unchanged single-item counter proves a multi-image failure.

**Fix:** Either implement direction-aware arrow-key previous/next navigation and test with multiple images, or correct the documented capability. Provide a localized gallery title/counter and keep focus restoration.

Source: [Gallery](https://github.com/hamidnoshady/cms-arch3-theme/blob/24ea8f6f102f83459b36fd257364db3e802763d1/src/components/media/Gallery.tsx).

## Visual refinement recommendations

These are design judgments, separate from reproduced defects.

- **Keep the whitespace.** The theme already meets the minimal direction. Add identity through deliberate line placement and a few stronger typographic relationships rather than extra sections.
- **Improve the line rhythm.** Structural rules are present, but many surfaces repeat long horizontal separators plus isolated title marks. Reuse a small asymmetric motif at image-caption joints, selected filter anchors and editorial offsets. Avoid enclosing every text region in a box.
- **Make mobile filters quieter.** At 390px the project filter group wraps into two rows and pushes the first images down. Use compact text tabs with an active underline or a clearly labeled Select when categories grow.
- **Give Contact its own details composition.** The generic contact block includes an extra title, section padding and repeated separators before the form. A compact details renderer inside the existing split would better match the requested concise contact page.
- **About is sparse but the image dominates vertically.** The current fixture image is portrait; its natural ratio makes the desktop page long. Consider a deliberately capped image height or smaller width while preserving the photo's focal point and ample surrounding white space.
- **Mixed-ratio projects need a deliberate row policy.** CSS Grid leaves large spaces below landscape cards when adjacent portraits determine row height. This is not a bug or a request to remove portrait support. Decide whether that whitespace is intentional; if not, use controlled row grouping without scrambling RTL reading/tab order.
- **Home entrance is a restrained fallback reveal.** The customer logo is safely displayed as an image and fades in; the drawn path is the theme's datum rule. This is allowed by the prompt for complex/raster artwork. A sanitized, suitable brand SVG can receive a more distinctive one-time reveal later.
- **Validate real imagery and real translations.** Colored QA placeholders prove geometry, not the quality of architectural photography, legibility of a black frame over dark photos, or English editorial composition.

## Recommended implementation order

1. Fix locale-safe controls, canonical search results, homepage keyboard handling and archive taxonomy constraints.
2. Fix mobile drawer edge and project caption layout.
3. Add drawer motion and robust form validation.
4. Replace generic education/blog skeletons with matched compositions.
5. Provision Shazde, centralize decorative stroke widths, and finish the gallery behavior.
6. Apply the modest visual refinements with actual CMS content; re-run checks on both languages.

## Acceptance checks for the next review

- English filter/reset/search/page navigation remains English, including archive page 2.
- Persian drawer opens right; English opens left; both animate briefly, trap focus, restore it on Escape and release scroll lock.
- Homepage keyboard language links work before entry; Enter control and gestures still reveal the menu.
- Projects at 320/390px retain two readable cards with long titles/locations and mixed image ratios.
- Search routes match the document's real section; wrong-section detail URLs redirect consistently.
- Cross-section category queries are rejected or yield an appropriate empty state; offered blog filters work.
- Invalid email is blocked inline; server validation errors are useful; failure preserves values.
- Slow education/blog navigation preserves featured/editorial geometry; reduced-motion loading is static.
- Licensed font weights and 1x/2x linework are checked with actual assets.
- Real CMS/media integration, Safari/iOS, keyboard-only and screen-reader sessions are tested before release.

## Evidence bundle

The accompanying `cms-arch3-theme-ui-ux-evidence.zip` contains new browser JSON measurements, targeted repro results, drawer captures, the long-location stress screenshot, and logs from the independently rerun verification/a11y/interaction checks. It also contains the external audit scripts for reproduction; their absolute imports/paths need adjustment on another machine.

The passing repository harnesses did not assert drawer edge/motion, locale retention on archive controls, long card metadata, focused homepage links, email format validation or composition-matched loading. Their success is useful evidence, but not proof that the full prompt is satisfied.

