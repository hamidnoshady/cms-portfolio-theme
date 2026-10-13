# The reference, as far as it can be observed from this repository

> What `https://bybang.co/` actually says, recorded from the live site on **13 October
> 2026**, and — just as important — what could **not** be observed from here. The canvas
> composition, the cursor and the open/close transitions are the three behaviours the
> issue requires; this document is the honest boundary between the parts of them that
> were measured and the parts that were reconstructed.

## 1. Method, and its limits

The reference was read through a text/HTTP retrieval path, which has two consequences:

- **It is client-rendered.** Every route returns a shell with the chrome in the HTML and
  its content — project grid, case study body, canvas tiles — injected by JavaScript
  afterwards. A text fetch therefore sees the chrome of every page, the `<title>`, the
  sitemap, the `robots.txt`, and only those pages whose copy is server-rendered
  (`/legal`, `/about`).
- **No screenshots.** This sandbox has no egress to `bybang.co` (the only reachable hosts
  are the package registries), so no headless browser here can render the reference, and
  no pixel or motion capture of it exists in this repository. Any claim about *geometry*
  — tile sizes, positions, spacing, the cursor's dimensions, wheel speed, easing — is
  therefore a reconstruction, and is labelled as such below. The evidence that exists is
  in `docs/screenshots/` and is evidence about **this** theme.

Re-running the observation needs only the routes named below; the retrieval is
text-only, so nothing here depends on a browser that can reach the site.

## 2. Routes (from `https://bybang.co/sitemap.xml`, `robots.txt`)

```
/            weekly 1.0
/about       weekly 0.7
/legal       weekly 0.4
/projects/cortaderas   0.8      /projects/cutterway   0.8
/projects/qubaa        0.8      /projects/benches     0.8
/projects/raw          0.8      /projects/revolve     0.8
/projects/noise        0.8      /projects/bremar      0.8
/projects/shapeofwater 0.8      /projects/aiseed      0.8
```

`robots.txt` allows everything and points at that sitemap. There is **no `/objects`
route in the sitemap** even though this theme serves an Objects archive: the theme's
section split comes from the CMS (`docs/CONTENT.md`), not from the reference's URL set.
The three non-project pages are `/`, `/about` and `/legal` — there is **no** contact,
careers or services route in the sitemap, so those parts of this theme have no reference
counterpart to compare against.

Project titles are `Cortaderas Norte | Estudio Bang` and `Qubaa Landscape Interventions |
Estudio Bang`: the pattern is `<Project name> | <Studio>`, which is what
`metadataFor()` already produces from CMS content.

## 3. Chrome — observed

Every page (including the client-rendered ones) ships this chrome in the HTML:

| Element | Reference | Position |
| --- | --- | --- |
| Language | `ENG ESP` — both languages printed, as codes | edge opposite the logo |
| Clocks | `BCN20:31BUE15:31` — two studio cities, `HH:MM`, no separator | footer/edge |
| Footer | `Copyright Estudio Bang® 2026` · `Legal & Privacy` · `Made by Tremendo Studio` | footer |

Three consequences for this theme:

1. **The language control prints the set of languages, not only the other one.** The
   theme's switch was a single "other language" link; it now prints every served locale
   with the current one marked and inert (`LanguageSwitch`, `switchEntries`), keeping the
   CMS's order so the chrome does not reshuffle when the language changes. The label is
   the compact code (`EN`, `FA`) with the language's own name as the accessible name.
2. **Two clocks, no separator** (`BCN`/`BUE`, each with a time). The theme's clocks are
   CMS settings (`clockLabelA/B`, `clockZoneA/B`, defaulting to Buenos Aires and
   Barcelona) — the names and zones stay content, and the reference confirms two cities
   is the right default shape.
3. **© year, a legal link and a maker credit** sit together on one line. This theme's
   footer carries the © line and the CMS footer menu (the credit is a CMS footer link on
   the customer's site).

## 4. `/about` — observed

Server-rendered copy (whitespace removed by the retrieval, so the line breaks are not the
site's):

- “We are a team of architects based in Barcelona with over 15 years of experience in
  Architecture, Interior & Product Design.”
- “We've collaborated with teams & professionals from Argentina, Spain, Australia, the US,
  and Middle East.”
- “We blend our vision + artistic sensitivity + technical skills with the goal of telling
  stories through our Projects.”

and a team sequence of **portrait + name + role**, five people: Espartaco Degano (*Head
Architect*), Fernanda Nessier (*Co-founder*), Juan Mantz (*Creative Director*), Camila
Cappato (*Architect & ID*), Giuliano Barbotti (*Junior Architect*), interleaved with large
studio images (`/media/about/image-*`) and figma-hosted headshots
(`/figma-assets/team-*.png`).

This matches the theme's About view contract exactly — an intro, an image sequence and a
`TeamBiography` list of name/role portraits from CMS content
(`src/views/AboutView.tsx`, `src/components/portfolio/TeamBiography.tsx`). No change was
needed for parity of *structure*; the copy is CMS content and is not shipped.

## 5. `/legal` — observed

A full server-rendered legal notice in 17 numbered sections (owner, purpose, terms,
intellectual property, third-party links, data collected, purposes, legal basis, email
and form processing, retention, sharing, international transfers, rights, cookies and
local storage, security, changes, contact). Two facts are worth keeping:

- the site states it uses **no analytics, advertising or tracking cookies** — only a
  strictly-necessary admin cookie (~12 h) and a **language preference in
  `localStorage`**, which is precisely this theme's language model;
- forms are delivered by email and processed through **Brevo**, with Cloudflare for
  hosting — i.e. the CMS/theme boundary this repository assumes (the theme posts to the
  CMS; the CMS owns delivery). Nothing in the theme should claim to send mail itself.

## 6. What was **not** observable, and what this theme does instead

| Behaviour the issue requires | Observation status | Where this theme's rule lives |
| --- | --- | --- |
| Infinite canvas: which tiles, how many, at what sizes/positions/angles | **Not observable** (client-rendered, no browser) | `src/components/home/canvasPlan.ts` — clusters, sizes, angles, depth; pure and tested |
| Wheel/trackpad direction, speed, momentum, drag | **Not observable** | `src/components/home/panEngine.ts` — `WHEEL_SPEED`, `EASE`, `FRICTION`, `DRAG_SLOP` |
| Cursor appearance, size, hover copy | **Not observable** | `src/components/home/CustomCursor.tsx` + `.bang-cursor` rules |
| Project opening/closing transition | **Not observable** | `src/app/@overlay/*` intercepted routes + `CaseStudyShell` |
| Central wordmark scale | **Not observable** | `.bang-wordmark` (text marks at hero scale, uploaded marks at *logo* scale) |
| Whether the set of tiles is curated or automatic | **Not observable** | CDN-free `HomeView`: the newest published case studies across both sections, bounded by the CMS `canvasDensity` setting |

Everything in the second column is a reconstruction constrained by the issue's own
description (“scattered in a spatial/circular-looking arrangement”, “scrolls
indefinitely”, “the mouse cursor changes”, “clicking a project image opens that
project”), by what the CMS can express, and by the tests that pin it. **No claim of
pixel-level fidelity to `bybang.co` is made anywhere in this repository**, and none
should be inferred from a green audit: the audits prove this theme matches its own
contract — continuity, identity, restoration, accessibility — not the reference's
photographs.

Closing that last gap needs a capture of the reference itself (screenshots and a wheel
sequence at fixed viewports) taken from a machine that can reach it; the route list in
§2 is all that capture needs.
