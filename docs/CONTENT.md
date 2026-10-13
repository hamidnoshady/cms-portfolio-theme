# Content model and editor workflows

## Ownership

CMS owns persistent content, media, forms/submissions, auth, tenants, publishing, branding/navigation/theme config, events, deployments. Theme owns public routes, rendering, motion, a11y, SEO/sitemap, same-origin relays, preview/revalidation, health.

## Models reused

- Pages: Home, About, Contact, Careers, Legal.
- Posts: portfolio case studies (one model for Projects + Objects).
- Categories: Projects root + Objects root (separate bindings, shared adapter/template/gallery).
- Media: photos, logos, captions, focal points, derivatives, localized alt.
- Team block: members (name/role/bio/photo) + social links (validated http(s), max 4). Socials are a small extension: existing CMS config has no social fields.
- Forms: separate contact + careers definitions; submissions private.
- Header/Footer: navigation + utility links. Site branding: studio identity + logos.

Objects are portfolio entries. No carts, payments, stock, or commerce.

## Slots

`home`, `about`, `contact`, `careers`, `legal`, `projectsCategory`, `objectsCategory`, `contactForm`, `careersForm` via `/api/site` → `themeRuntime.bindings`. Required-slot failures render missing-content states.

## Editor workflows

Translate content; upload/crop/reorder images (focal point honored); curate featured work (newest published across both sections, bounded by `canvasDensity`); edit team bios + socials; bind pages/categories/forms; preview drafts (private, uncached, needs preview secret + site key); publish → revalidation refreshes tenant/locale/resource/query/mode-scoped caches.

## Provisioning (idempotent)

1. Create site (type `portfolio`, locales `fa,en`, default `fa`).
2. Create categories `projects`, `objects` (+ children as needed).
3. Create pages `home/about/contact/careers/legal`; create forms `contact` (first/last/email/company/reason + optional message) and `careers` (first/last/email/portfolio URL/focus).
4. Install theme package `bang-portfolio`; bind all nine slots; set presentation settings (`canvasMotion`, `canvasDensity`, `archiveLayout`, `clockZoneA/B`, `clockLabelA/B` with IANA zones).
5. Publish in each locale; verify `/api/site` bindings; preview; publish refresh.

No production names, entries, members, or submissions are hardcoded. No real submissions in fixtures.
