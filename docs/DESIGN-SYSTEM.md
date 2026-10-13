# Design system

The theme's visual grammar in one place: tokens, geometry, both line systems, layout
primitives, breakpoints and the component inventory. Raw values live in
[`src/styles/tokens.css`](../src/styles/tokens.css); the semantic layer is
[`src/styles/typography.css`](../src/styles/typography.css),
[`src/styles/lines.css`](../src/styles/lines.css),
[`src/styles/structure.css`](../src/styles/structure.css) and
[`src/styles/components.css`](../src/styles/components.css), all imported through the single
entry [`src/app/globals.css`](../src/app/globals.css). Tailwind v4 reads a mapped subset via
`@theme inline`, so utilities and semantic classes share one source.

## Tokens

| Group | Values |
| --- | --- |
| Surface / ink | `--surface: #ffffff`; `--ink: #000000`; `--ink-secondary: rgba(0,0,0,.64)` (6.4:1, the only body-secondary tone); `--ink-faint: .45` and `--ink-disabled: .35` are **non-text only** |
| Geometry | `--radius: 0px` at every level; `--content-max: 1440px`; `--frame-inset: 5px`; gutters 16→20→24→32→40px at 30/48/64/90rem; grid gap 12→16→20px |
| Lines | `--line-w: 1px` on 1x displays, `0.5px` at `min-resolution: 2dppx`; structural `rgba(0,0,0,.3)`, decorative `rgba(0,0,0,.2)`, emphasis `#000`, skeleton `rgba(0,0,0,.05)` |
| Typography | see [`docs/TYPOGRAPHY.md`](./TYPOGRAPHY.md) |
| Motion | `--motion-fast: 140ms`, `--motion-base: 240ms`, `--motion-slow: 420ms`, `--motion-reveal: 560ms`; two easing curves |
| Focus | `--focus-width: 2px`, `--focus-offset: 2px` — an outline, never only a line colour |

The subpixel-line tolerance is deliberate: a 0.5px border rounds to a full pixel on 1x
displays, so **opacity** carries the delicacy rather than a heavier colour. Both 1x and 2x
are checked in the browser audits.

## Line systems

Two systems, one thickness scale (`src/styles/lines.css`):

**Structural — continuous, organizing.** `rule-h` / `rule-v` (hairlines), `rule-h--major`
for section boundaries, `rule-h--decor` / `rule-v--decor` for short baselines,
`rule-h--emphasis` / `rule-v--emphasis` (1px solid black, reserved for
active/interactive meaning), `frame` for the 5px-inset rectangle that sits **on** a
photograph (not white padding), `frame--fragmented` for a shared corner-and-edge variant,
`card-rule`, `caption-rule` and `active-underline`.

**Decorative — small drafting fragments.** `DecorativeMark`
(`src/components/design/DecorativeMark.tsx`) renders one server-side inline SVG with six
deterministic variants: `corner`, `crosshair`, `dash`, `offset-l`, `pair`, `tick`.
Typical lengths follow the brief (dashes 12–24px, corner arms 10–18px, ticks 8–16px).
Marks are `aria-hidden`, `pointer-events: none`, absolutely positioned by their wrapper
(never part of layout sizing), `hidden md:block` where density must drop on mobile, and
never the sole indicator of a control. They appear on the home stage, headers and footers,
cards, gallery frames, article/project/about/contact compositions and the empty/error
states.

Structural and decorative never swap roles: a decorative fragment never becomes a
boundary, and a structural rule is never random ornament.

## Layout primitives

- `NavbarShell` — full viewport width with its own edge gutters (approximately 32–40px on
  desktop, smaller on mobile); its content does not align with the 1440px container.
  Its height and the logo scale come from the chrome tokens in `tokens.css`:
  `--navbar-block` 82 → 88 → 94px and `--logo-block` 42 → 46 → 52px across phone,
  tablet (`48rem`) and desktop (`64rem`). The uploaded mark is sized by height only
  (`.navbar__logo`: width auto, `object-fit: contain`, capped by `--logo-max-inline`);
  the primary asset serves desktop via `<picture>`, the compact one smaller screens.
- `ContentContainer` — fluid, centered, `max-width: 1440px`, safe gutters.
- Both use padding, never `100vw`, so a scrollbar cannot create overflow. Breadcrumbs,
  headings, filters, archives and the footer all sit in the same container.

The home page is the one exception: a full-viewport entrance stage with no interior header
before the menu reveals.

## Breakpoints, grids and profiles

Tailwind-style rem breakpoints: `30rem` (480), `48rem` (768), `64rem` (1024), `80rem`
(1280), `90rem` (1440).

- **Projects**: 2 columns on mobile **and tablet**, 3 at `64rem`, 4 at `80rem`
  (`.grid-projects`), one 4:5 frame for every card, all cards top-aligned (no stagger).
- **Media/gallery grids**: 2 columns on mobile **and tablet**, 3 at `64rem`
  (`.grid-media`) — the 2/2/3 contract. A gallery block's `columns` field is applied on
  desktop only (`.grid-media--2`, `.grid-media--4`); phones and tablets never exceed two.
  Gallery blocks, inline `mediaGrid`s and prose uploads all share it.
  Inside `.prose` the grid is reset to plain layout (no list markers, indent or list
  spacing). An inline `mediaGrid` shows the block's CMS name (`blockName`) as a quiet
  label row — title, hairline, two-digit count — and the figure is named by it.
- **Project page.** A header (title + facts beside the hero) over a narrative whose
  text keeps the reading measure while grids use the full container width; related
  projects are image cards. In the narrative a main section (`h2`) opens with a solid
  rule and a running number, and a named set inside it keeps the hairline label.
- **In-page navigation (`SectionNav`).** Shown when the narrative has three or more
  section headings / named grids. A rail of ticks on the right edge for hover-capable
  desktops (≥ 64rem) that opens into the full list on hover or keyboard focus; on touch
  and narrower screens a button showing the current section (`2/6 · name`) that opens a
  panel. Links are real `#section-n` anchors (ids come from position, see
  `contentOutline`); a click scrolls once, clear of the sticky navbar.
- **Blog and Contact**: one column, split into two at `64rem` with a real `rule-v`
  divider.
- Skeletons reuse the same grid classes, so loading geometry matches the settled layout.

## Component inventory

`src/components/ui/` — shadcn/ui components, each restyled through the tokens above
(radius zero, white/black, hairline edges, no shadows, visible focus):
`accordion`, `breadcrumb`, `button`, `dialog`, `input` (Input + Textarea), `label`,
`pagination`, `sheet`, `skeleton`.

- **Select is intentionally not installed.** The archives filter with links
  (`.filter-chip`, works without JS) and the CMS form's `select` field stays a native
  control for platform semantics; there is no actual dropdown filter to justify it.
- Breadcrumb and Pagination are the shadcn component shape with route-aware wrappers in
  `src/components/design/`.
- **One lightbox** (`src/components/media/Lightbox.tsx`): every CMS content image — a
  gallery block, an inline `mediaGrid`, an `upload` in the prose, the standalone media
  block — is a `LightboxTrigger` inside a `LightboxScope`, so a project's content images
  open as one previous/next sequence and no view builds a second gallery from the same
  media. It composes the Radix dialog primitives directly (focus trap, Escape, scroll
  lock, focus returned to the thumbnail) and has its own backdrop, `.lightbox__overlay`
  (black at 50%), distinct from the navigation drawer's 25% wash and `ui/dialog`'s
  `.dialog__overlay`. Direction is logical: *next* advances along the reading
  direction, so in Persian the next arrow points left, ArrowLeft advances and the
  incoming image arrives from the left.
- **Project facts** (`.facts`): a compact drafting block capped at `56rem` — one thin
  top rule, a tiny tick before each label, label and value on one line, one column on
  narrow phones and two from `30rem`. No cards, fills, table grid or borders between
  items, and only fields the CMS actually returned.
- **Language switch** names only the *other* language (a Persian page offers
  «English»); a document without a translation shows that label as quiet
  non-interactive text (`.lang-switch__unavailable`) rather than a fabricated link.

`src/components/design/` — theme primitives: `Container` (the two shells), `Rule`,
`DecorativeMark`, `Type` (the semantic text roles), `SectionHeader`, `Breadcrumbs`,
`Pagination`. Everything else (cards, entrance, blocks, states) composes these.

## States, motion and accessibility

- Skeletons use the 5% black surface, sharp corners and one 1.6s opacity pulse per
  region — static under `prefers-reduced-motion`.
- Motion is restrained and single-engine: Motion for React in the home entrance and the
  lightbox (a 260ms fade with a barely-there scale on open, reversed on close; a 300ms
  directional slide/fade of 14px between images, with the outgoing and incoming image
  centred in one fixed stage so a portrait after a landscape cannot move the controls);
  CSS transitions for drawers, hovers and reveals. No per-line animation, no parallax,
  no scroll theatre. Reduced motion renders final states: the lightbox mounts settled
  and the image simply changes.
- Focus is a visible 2px outline; active navigation keeps both a solid 1px underline and
  `aria-current`; structural lines remain decorative (`aria-hidden`) and text contrast
  never relies on them. The home menu's labels carry **no** permanent underline — the
  label shifts, the leader extends and the arrow arrives on hover/focus, and the current
  page is set in a heavier weight with a solid index (plus `aria-current`).
- WCAG 2.2 target-size floor: 24×24 for navigational targets, 40px for pagination and
  44px for primary controls; labels count as part of their control.

## Verification

- `node scripts/a11y-audit.mjs` — one `h1`, a `<main>`, heading order, image alt text,
  duplicate ids, 24px targets and body-text contrast (`docs/screenshots/a11y-report.json`).
- `node scripts/screenshots.mjs` — 46 named shots at 320–1920px, 200% zoom, reduced
  motion, no-JS and the lightbox in both directions; per-shot overflow and console-error
  assertions.
- Hairlines are checked at 1x and 2x; hiding the decorative marks must leave the layout
  coherent, and hiding the structural rules must leave logical order and accessibility
  intact (see `docs/QA.md`).

## Contact, About and Education additions

- **Contact block** — email and phones are set large, one per row, each with a copy control; the
  link stays `mailto:`/`tel:`. Address and hours stay as small entries.
- **Map** — shown under the details when a map can be placed. Providers (runtime settings
  `mapProvider`, `mapApiKey`, `mapCenter`, `mapZoom`): `osm` (free, no key, the default),
  `google` (Embed API key, can search by address), `mapbox` (static light style, `pk.` token),
  `off`. A keyed provider without a key falls back to OpenStreetMap. Coordinates come from
  `mapCenter`, else from the block's own `mapUrl`. Keys are public by design — restrict them to the
  site's domain at the provider. Nothing is requested from the provider until the visitor presses
  "Show map" (the frame is a drafting-grid placeholder until then), and the map is desaturated to
  keep the page black and white. Logic: `src/lib/maps/mapSource.ts`.
- **About** — a "Selected work" row (the three newest projects, from the projects archive; omitted
  when there are none) and the page closes on one large "Start a conversation" line instead of a
  small link.
- **Education list** — one hairline above the list and one under each row but the last (the old
  featured border + rule + row borders stacked three lines together). Rows are numbered, one
  target each, and a solid line draws across the hairline on hover/focus.
