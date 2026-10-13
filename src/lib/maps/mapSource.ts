/**
 * Map sources for the contact block — one free provider and two keyed ones.
 *
 * - `osm`    OpenStreetMap embed. Free, no key, no account. The default.
 * - `google` Google Maps Embed API (place mode). Needs a browser key; it can also search
 *            by address, so it works without coordinates.
 * - `mapbox` Mapbox Static Images, light style (close to the theme's black-and-white).
 *            Needs a public `pk.` token.
 * - `off`    No map at all; the contact block keeps its plain map link.
 *
 * Everything here is a pure function of its input: the URLs are assembled from numbers
 * and `encodeURIComponent`-ed strings only, so nothing an editor types can change the
 * host or inject markup. Keys are *public by design* (they ride in the page); the
 * provider must be told to restrict them to the site's domain.
 */

export type MapProvider = 'google' | 'mapbox' | 'off' | 'osm'

export type LatLng = { lat: number; lng: number }

export type MapSource = {
  /** Where "Open in maps" goes — the editor's own link when it is a safe https URL. */
  href: string
  kind: 'iframe' | 'image'
  /** The provider actually used (a keyed provider without a key falls back to `osm`). */
  provider: Exclude<MapProvider, 'off'>
  src: string
}

export type MapInput = {
  /** Postal address, used only by Google, and only when there are no coordinates. */
  address?: null | string
  apiKey?: null | string
  center?: LatLng | null
  /** The CMS block's own link: shown as "Open in maps" and mined for coordinates. */
  mapUrl?: null | string
  provider?: null | string
  zoom?: null | number
}

const PROVIDERS = new Set<string>(['google', 'mapbox', 'off', 'osm'])
const DEFAULT_ZOOM = 16
// Lat/lng as two decimals separated by a comma, slash or space. Real coordinates always
// carry a fraction, which also keeps `15/35.68/51.38` (OSM's zoom/lat/lng) from reading
// the zoom as a latitude.
const PAIR = /(-?\d{1,3}\.\d+)\s*[,/\s]\s*(-?\d{1,3}\.\d+)/u

export const parseProvider = (value: unknown): MapProvider =>
  typeof value === 'string' && PROVIDERS.has(value) ? (value as MapProvider) : 'osm'

const valid = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null

/** `"35.6892, 51.3890"` → coordinates. Anything else is `null`, never a guess. */
export const parseCenter = (value: unknown): LatLng | null => {
  if (typeof value !== 'string') return null
  const match = PAIR.exec(value.trim())
  return match ? valid(Number(match[1]), Number(match[2])) : null
}

/** Coordinates inside a map link (`@lat,lng`, `q=lat,lng`, `#map=15/lat/lng`, `mlat=…&mlon=…`). */
export const centerFromUrl = (value: unknown): LatLng | null => {
  if (typeof value !== 'string') return null
  const flat = /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/u.exec(value)
  if (flat) return valid(Number(flat[1]), Number(flat[2]))
  return parseCenter(safeDecode(value))
}

/** The contact block's own `latitude`/`longitude` fields; numbers or numeric strings. */
export const centerFromFields = (latitude: unknown, longitude: unknown): LatLng | null => {
  const num = (value: unknown): number =>
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return valid(num(latitude), num(longitude))
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const clampZoom = (zoom: null | number | undefined): number =>
  typeof zoom === 'number' && Number.isFinite(zoom) ? Math.min(Math.max(Math.round(zoom), 3), 19) : DEFAULT_ZOOM

const osmBbox = ({ lat, lng }: LatLng, zoom: number): string => {
  // ~1000px of map at this zoom; latitude span shrinks with the cosine of the latitude.
  const halfLng = 720 / 2 ** zoom
  const halfLat = halfLng * 0.625 * Math.cos((lat * Math.PI) / 180)
  return [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat].map((n) => n.toFixed(6)).join(',')
}

const openHref = (input: MapInput, center: LatLng | null): string => {
  if (typeof input.mapUrl === 'string' && /^https:\/\//u.test(input.mapUrl)) return input.mapUrl
  if (center) return `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=${clampZoom(input.zoom)}/${center.lat}/${center.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.address ?? '')}`
}

/**
 * Pick a provider and build its URL, or return `null` when there is nothing honest to
 * show (provider off, or no coordinates and no address a keyed provider could search).
 * Coordinates: the explicit centre, else the editor's own map link.
 */
export const mapSource = (input: MapInput): MapSource | null => {
  const requested = parseProvider(input.provider)
  if (requested === 'off') return null

  const center = input.center ?? centerFromUrl(input.mapUrl)
  const key = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''
  const address = typeof input.address === 'string' ? input.address.trim() : ''
  const zoom = clampZoom(input.zoom)
  const href = openHref(input, center)

  if (requested === 'google' && key && (center || address)) {
    const query = center ? `${center.lat},${center.lng}` : address
    return {
      href,
      kind: 'iframe',
      provider: 'google',
      src: `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&zoom=${zoom}`,
    }
  }

  if (requested === 'mapbox' && key && center) {
    const { lat, lng } = center
    return {
      href,
      kind: 'image',
      provider: 'mapbox',
      src: `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+000000(${lng},${lat})/${lng},${lat},${zoom},0/1000x625@2x?access_token=${encodeURIComponent(key)}`,
    }
  }

  // Free fallback — also what a keyed provider degrades to when its key is missing.
  if (!center) return null
  return {
    href,
    kind: 'iframe',
    provider: 'osm',
    src: `https://www.openstreetmap.org/export/embed.html?bbox=${osmBbox(center, zoom)}&layer=mapnik&marker=${center.lat},${center.lng}`,
  }
}
