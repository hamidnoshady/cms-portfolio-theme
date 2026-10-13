import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The signed-revalidation primitive: HMAC-SHA256 over the **raw request body**, the
 * exact bytes the CMS signed. Verification happens before any parsing, so a payload
 * cannot be re-encoded into a different signature, and comparison is constant time.
 */

const MIN_SECRET_LENGTH = 16

export const revalidateSecret = (): null | string => {
  const value = process.env.ESHOBE_REVALIDATE_SECRET
  return value && value.length >= MIN_SECRET_LENGTH ? value : null
}

export const revalidateSignature = (secret: string, rawBody: Buffer | string): string =>
  createHmac('sha256', secret).update(rawBody).digest('hex')

/** The v1 renderer contract requires the literal `sha256=<hex>` header form. */
export const verifyRevalidateSignature = (
  secret: string,
  rawBody: Buffer | string,
  header: null | string,
): boolean => {
  if (!header || !/^sha256=[0-9a-f]{64}$/iu.test(header)) return false
  const provided = header.slice('sha256='.length).toLowerCase()
  const expected = Buffer.from(revalidateSignature(secret, rawBody))
  const actual = Buffer.from(provided)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
