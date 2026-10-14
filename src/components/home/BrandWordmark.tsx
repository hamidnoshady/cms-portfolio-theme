/**
 * Central studio wordmark on the Home stage (`BrandWordmark`).
 *
 * Renders:
 * 1. One semantic `<h1 className="bang-wordmark">` (`data-wordmark-layer="base"`) with
 *    `color: #000000` below the canvas (`z-index: 1`) so the studio name is always
 *    legible black on the white stage and passes strict accessibility contrast checks.
 * 2. Two `aria-hidden="true"` decorative compositing layers (`.bang-wordmark--prep`
 *    below the canvas and `.bang-wordmark--blend` above the canvas) using
 *    `content: attr(data-wordmark)` and `mix-blend-mode: difference`.
 *    - Over the white background: `#000000` (h1) ⊕ `#ffffff` (prep) = `#ffffff`, then
 *      `#ffffff` ⊕ `#ffffff` (blend) = `#000000` (pure solid black).
 *    - Where project imagery (`z-index: 2`) crosses the center: the opaque image covers
 *      the base layers and blends against `.bang-wordmark--blend` (`#ffffff`),
 *      producing a crisp inverted mask over the photograph.
 * 3. When an explicit uploaded mark (`markUrl`) is passed, renders the artwork inside
 *    the semantic `<h1>` without applying `mix-blend-mode: difference` so multi-color
 *    or dark logos are never color-inverted.
 */
export const BrandWordmark = ({
  brand,
  markUrl,
}: {
  brand: string
  markUrl?: null | string
}) => {
  if (markUrl) {
    return (
      <h1
        className="bang-wordmark bang-wordmark--base"
        data-wordmark="logo"
        data-wordmark-layer="base"
        dir="auto"
      >
        <img
          alt={brand}
          className="bang-wordmark__mark"
          decoding="async"
          fetchPriority="high"
          src={markUrl}
        />
      </h1>
    )
  }

  return (
    <>
      <h1
        className="bang-wordmark bang-wordmark--base"
        data-wordmark="wordmark"
        data-wordmark-layer="base"
        dir="auto"
      >
        <span className="bang-wordmark__ink">{brand}</span>
      </h1>
      <div
        aria-hidden="true"
        className="bang-wordmark bang-wordmark--prep"
        data-wordmark={brand}
        data-wordmark-layer="prep"
        dir="auto"
      />
      <div
        aria-hidden="true"
        className="bang-wordmark bang-wordmark--blend"
        data-wordmark={brand}
        data-wordmark-layer="blend"
        dir="auto"
      />
    </>
  )
}
