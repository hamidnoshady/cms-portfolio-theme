import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * One runner for pure logic and for the few DOM-facing components. `environment` is
 * `node` by default; a test that needs a DOM opts in with a
 * `// @vitest-environment jsdom` docblock, so slow jsdom setup is not paid for by the
 * routing/media/security suites.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a build-time marker: outside Next's server compiler it throws
      // on import. Server modules under test are aliased to an empty module instead.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    restoreMocks: true,
    // jsdom suites get a real unmount between tests (see the file for why it is not
    // automatic here).
    setupFiles: ['tests/setup.ts'],
  },
})
