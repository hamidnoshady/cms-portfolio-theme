import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * One flat config, Next 16's own rules. `eslint-config-next` already enables the
 * TypeScript parser, React, import, jsx-a11y and Next plugin rule sets, so nothing is
 * re-declared here and rules cannot drift between the two lists.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'vendor/site-runtime/dist/**'] },
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // CMS media is served from the tenant's own origin with the theme's own `srcset`
      // (see `CmsImage`), and the uploaded logo must stay a plain <img> so an SVG is
      // never inlined. The Next image optimizer is intentionally not used, so this
      // rule would only produce noise on every media component.
      '@next/next/no-img-element': 'off',
      // Decorative marks and CMS-driven attribute spreads intentionally pass through.
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    },
  },
]

export default config
