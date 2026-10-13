import { afterEach } from 'vitest'

/**
 * Unmount anything a jsdom test rendered.
 *
 * Testing Library's automatic cleanup only registers itself when the test globals are
 * enabled; this project imports `describe`/`it` explicitly instead, so the DOM survived
 * from one test into the next and `getByText` could match a component that had already
 * been replaced. React Testing Library is imported lazily because the majority of the
 * suites run in the `node` environment, where there is no `document` to clean.
 */
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
