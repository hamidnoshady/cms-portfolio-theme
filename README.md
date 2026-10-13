# Eshobe CMS Portfolio Theme

A proposed Estudio Bang-inspired portfolio theme for Eshobe CMS.

## Rebuild specification

Read [the complete website audit, rebuild plan, and AI coding-agent prompt](docs/bang-eshobe-rebuild-plan.md).

The document covers all 13 review sections: current behavior and architecture; working implementation; confirmed bugs and compatibility gaps; duplicate/legacy areas; target architecture; UX/UI; functions; security and permissions; data/API changes; verification requirements; and the full implementation prompt.

## Status

This repository currently contains the planning specification. The website implementation, application scaffolding, tests, CI, and deployment have not been added. The audit covers every primary public section and two representative case studies; it does not claim exhaustive backend or provider verification.

## Implementation scope

- Home image composition and featured work.
- About and team biographies.
- Projects and Objects archives and case-study details.
- Contact and Careers forms.
- Legal page, branding, navigation, locale switching, sharing, and studio clocks.
- Eshobe content bindings, server-side tenant isolation, publishing, preview, revalidation, and deployment contracts.
- Responsive accessibility, regression/integration tests, and exact-revision verification.

Preserve the reference's monochrome interface and photography while fixing usability and integration defects. Reuse Eshobe's existing platform rather than creating a second CMS.

## Decisions required before implementation

- Target languages: English/Spanish, Persian/English, or all three. Current inspected Eshobe code supports Persian and English.
- Visual fidelity: recommended direction is to preserve Bang's style and motion while improving usability.
- Approved brand/content assets, video requirements, mail provider, and staging recipients.

The specification identifies a critical reuse regression: the existing architecture theme treats `company` as a honeypot, which conflicts with the reference's real Company field. Implement the canonical CMS honeypot contract and regression tests before reusing that form.

## References

- [Live reference](https://bybang.co/)
- [Eshobe CMS](https://github.com/hamidnoshady/eshobe-cms)
- [Architecture theme integration reference](https://github.com/hamidnoshady/cms-arch3-theme)

Audit dated 13 October 2026. Source revisions and evidence limits are recorded in the specification. Refresh current code and CI before implementation.
