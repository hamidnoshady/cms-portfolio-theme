import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Draft-preview tokens — pure, so the exact rule the route applies can be unit tested.
 *
 * A token is `HMAC-SHA256(secret, path)`. It is path-scoped on purpose: a token minted
 * for one document cannot unlock the rest of the site (the cookie is re-verified with
 * the *requested* path on every render, in `getSiteContext`).
 */

export const PREVIEW_COOKIE = 'arch2_preview'

const MIN_SECRET_LENGTH = 16

/** `null` when previews are disabled: a short or missing secret is not a secret. */
export const previewSecret = (): null | string => {
  const value = process.env.ESHOBE_PREVIEW_SECRET
  return value && value.length >= MIN_SECRET_LENGTH ? value : null
}

export const previewEnabled = (): boolean => Boolean(previewSecret())

export const previewToken = (secret: string, path: string): string =>
  createHmac('sha256', secret).update(path).digest('hex')

/** Constant-time, length-safe comparison. */
export const verifyPreviewToken = (secret: string, path: string, token: string): boolean => {
  const expected = Buffer.from(previewToken(secret, path))
  const provided = Buffer.from(token)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}
