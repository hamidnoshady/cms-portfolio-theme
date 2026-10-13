/**
 * A request body read with a **byte** bound, enforced while streaming.
 *
 * `await request.text()` buffers the whole body before anything can be checked, and
 * `.length` of the decoded string counts UTF-16 code units, not bytes — a Persian
 * enquiry of 40k characters is ~80 KB on the wire and passed a 64 KiB "byte" limit.
 * Here a declared `content-length` above the bound is refused before reading, and an
 * undeclared or understated body is cut off as soon as the running byte count passes it.
 */
export type BoundedBody = { ok: false; reason: 'too-large' } | { ok: true; text: string }

export const readBoundedText = async (request: Request, maxBytes: number): Promise<BoundedBody> => {
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too-large' }
  if (!request.body) return { ok: true, text: '' }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return { ok: false, reason: 'too-large' }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, text: new TextDecoder().decode(bytes) }
}
