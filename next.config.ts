import type { NextConfig } from 'next'

/**
 * There is deliberately no `images` block: the theme renders CMS media through its
 * own `<CmsImage>` (explicit `width`/`height` + `sizes`-driven `srcset` built from the
 * CMS image sizes) instead of the Next optimizer. That keeps a runtime-only tenant
 * media origin out of the build config — an optimizer allowlist of `hostname: '**'`
 * would turn `/api/media/file/*` into an open proxy, and a static allowlist cannot
 * know which domain the container is serving.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // CMS reads use the tenant-partitioned in-process cache in `src/lib/cms/cache.ts`.
    // Keep route shells short-lived; revalidation explicitly clears rendered paths.
    staleTimes: { dynamic: 0, static: 180 },
  },
  async headers() {
    return [
      {
        // Decorations and hairlines must not shift when a browser rewrites `#000000` →
        // `rgba(0,0,0,.28)`; nothing else here is exotic.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
