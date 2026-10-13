/**
 * The overlay slot's fallback: no interception, nothing to draw.
 *
 * A parallel route slot must be able to render *something* on every hard navigation,
 * and the home page is not a case study — so every URL that does not match one of the
 * intercepted patterns gets an empty slot. The canvas behind it stays exactly as it
 * was, which is the whole point of opening a work in this slot.
 */
export default function OverlayDefault() {
  return null
}
