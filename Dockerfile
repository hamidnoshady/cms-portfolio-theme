# syntax=docker/dockerfile:1

# Production image for deployment to Eshobe CMS.
#
# The theme is Next.js `output: 'standalone'`: the server bundle is traced into
# `.next/standalone`, and `scripts/prepare-standalone.mjs` places `.next/static` and
# `public/` beside it. The runtime stage copies exactly that prepared directory — one
# image layer owns the server, its traced node_modules, the static chunks and the fonts.
#
# Everything the platform injects (`ESHOBE_CMS_URL`, `ESHOBE_API_KEY`, …) stays a
# **runtime** variable: nothing here bakes a tenant, a key or an origin into the image.
#
# QA fixture media (`public/qa/`) is deliberately excluded: `prepare:standalone` filters
# it unless `ARCH2_INCLUDE_QA=1`, and this image never sets that.

# --- dependencies (cached until the lockfile or the vendored runtime moves) -----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The vendored runtime is a `file:` dependency, so it must exist before `npm ci`.
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

# --- build ----------------------------------------------------------------------------
FROM deps AS build
COPY . .
# `build` compiles the vendored runtime and then Next; `prepare:standalone` copies the
# static chunks and the public tree next to the traced server.
RUN npm run build \
 && npm run prepare:standalone

# --- runtime --------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Coolify replaces the HEALTHCHECK below with its own `curl`/`wget` probe of the
# manifest's `healthCheckPath`, run inside the container. This base image ships neither,
# so without curl every rollout is judged "unhealthy" and rolled back even though the
# server is up.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
USER nextjs
EXPOSE 3000
# Process-only readiness endpoint. It performs no CMS request, so startup and Coolify's
# loopback probe do not depend on CMS availability. Uses node independently of curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
