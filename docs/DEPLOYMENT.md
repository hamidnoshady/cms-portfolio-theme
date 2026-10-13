# Deployment and rollback

## Configuration

Platform injects at runtime: `ESHOBE_CMS_URL` (required), `ESHOBE_SITE_DOMAIN`, `ESHOBE_PUBLIC_ORIGIN`, `ESHOBE_SITE_ID`, `ESHOBE_API_KEY` (server-only), `ESHOBE_DEFAULT_LOCALE`, `ESHOBE_LOCALES`, `ESHOBE_REVALIDATE_SECRET`, `ESHOBE_PREVIEW_SECRET`, `ESHOBE_ALLOW_HOST_TENANT`. See `.env.example`. Never bake tenants/keys/origins into the image.

## Docker

`Dockerfile` builds Next.js standalone; runtime stage copies prepared output, runs as `nextjs` on `PORT=3000`, healthchecks `GET /api/health` (process-only, no CMS dependency). `public/qa` never ships. Build: `npm run build && npm run prepare:standalone`.

## CI / image

`ci.yml`: manifest validation → `npm ci` → lint → typecheck → tests → production build; browser audits against production build + mock CMS. `publish-image.yml` gates on CI, builds/pushes `ghcr.io/hamidnoshady/cms-portfolio-theme` by digest, registers the artifact with Eshobe CMS. Deploy by digest, never mutable tags.

## Health / CMS connectivity / preview / refresh

- `GET /api/health` → `{ok:true}` (no secrets, no CMS call).
- CMS connectivity: `/api/site` with site key; failures render honest unreachable/holding states.
- Preview: `ESHOBE_PREVIEW_SECRET` + site key + signed token cookie; draft reads private, uncached.
- Publishing refresh: signed raw-body HMAC (`ESHOBE_REVALIDATE_SECRET`); invalidates tenant/locale/resource/query/mode cache tags.

## Rate limits

Theme relay: 20 req/min/IP (process-local) + bounded 64 KiB bodies; CMS enforces authoritative per-form limits. Multi-replica deployments must add shared/edge throttling and validate trusted forwarding headers — the process-local limiter alone is insufficient across replicas.

## Rollback

Redeploy the previous registered digest. No migrations ship in this theme release (Team socials are read-tolerant: absent fields render without socials). If a future CMS migration is required, apply it in a separate CMS branch/PR first and note the deployment dependency here.
