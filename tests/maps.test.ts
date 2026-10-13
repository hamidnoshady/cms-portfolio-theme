import { describe, expect, it } from 'vitest'

import { centerFromFields, centerFromUrl, mapSource, parseCenter, parseProvider } from '@/lib/maps/mapSource'

const tehran = { lat: 35.6892, lng: 51.389 }

describe('map coordinates', () => {
  it('reads "lat, lng" and refuses anything else', () => {
    expect(parseCenter('35.6892, 51.3890')).toEqual(tehran)
    expect(parseCenter('')).toBeNull()
    expect(parseCenter('Tehran')).toBeNull()
    expect(parseCenter('95.1, 10.2')).toBeNull()
  })

  it('finds coordinates in the usual map links', () => {
    expect(centerFromUrl('https://maps.example.com/?q=35.6892,51.3890')).toEqual(tehran)
    expect(centerFromUrl('https://www.google.com/maps/@35.6892,51.389,17z')).toEqual(tehran)
    expect(centerFromUrl('https://www.openstreetmap.org/?mlat=35.6892&mlon=51.389#map=16/35.6892/51.389')).toEqual(tehran)
    expect(centerFromUrl('https://www.openstreetmap.org/#map=15/35.6892/51.3890')).toEqual(tehran)
    expect(centerFromUrl('https://maps.app.goo.gl/abc123')).toBeNull()
  })
})

describe('block coordinate fields', () => {
  it('reads the contact block latitude/longitude, as numbers or numeric strings', () => {
    expect(centerFromFields(35.6892, 51.389)).toEqual(tehran)
    expect(centerFromFields('35.6892', '51.389')).toEqual(tehran)
    expect(centerFromFields(null, null)).toBeNull()
    expect(centerFromFields(35.6892, null)).toBeNull()
    expect(centerFromFields('', '')).toBeNull()
    expect(centerFromFields(95, 10)).toBeNull()
  })
})

describe('mapSource', () => {
  it('defaults to the free OpenStreetMap embed, with no key', () => {
    const source = mapSource({ center: tehran })
    expect(source?.provider).toBe('osm')
    expect(source?.kind).toBe('iframe')
    expect(source?.src).toMatch(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/u)
    expect(source?.src).toContain('marker=35.6892,51.389')
  })

  it('uses Google when a key is set, and can search by address alone', () => {
    const byCenter = mapSource({ apiKey: 'KEY', center: tehran, provider: 'google' })
    expect(byCenter?.src).toBe('https://www.google.com/maps/embed/v1/place?key=KEY&q=35.6892%2C51.389&zoom=16')
    const byAddress = mapSource({ address: 'Valiasr St 1', apiKey: 'KEY', provider: 'google' })
    expect(byAddress?.provider).toBe('google')
    expect(byAddress?.src).toContain('q=Valiasr%20St%201')
  })

  it('uses a Mapbox static image when a token is set', () => {
    const source = mapSource({ apiKey: 'pk.test', center: tehran, provider: 'mapbox' })
    expect(source?.kind).toBe('image')
    expect(source?.src).toContain('/styles/v1/mapbox/light-v11/static/')
    expect(source?.src).toContain('access_token=pk.test')
  })

  it('falls back to the free map when a keyed provider has no key', () => {
    expect(mapSource({ center: tehran, provider: 'google' })?.provider).toBe('osm')
    expect(mapSource({ center: tehran, provider: 'mapbox', apiKey: ' ' })?.provider).toBe('osm')
  })

  it('shows nothing it cannot place: no coordinates, or the map is off', () => {
    expect(mapSource({ provider: 'osm' })).toBeNull()
    expect(mapSource({ center: tehran, provider: 'off' })).toBeNull()
    expect(parseProvider('bogus')).toBe('osm')
  })

  it('takes coordinates from the block link and keeps it as the "open" link', () => {
    const mapUrl = 'https://maps.example.com/?q=35.6892,51.3890'
    const source = mapSource({ mapUrl })
    expect(source?.provider).toBe('osm')
    expect(source?.href).toBe(mapUrl)
  })

  it('never lets a key or address change the host or break out of the query', () => {
    const source = mapSource({ address: 'x&key=evil#', apiKey: 'a&b=c', provider: 'google' })
    expect(new URL(source!.src).host).toBe('www.google.com')
    expect(new URL(source!.src).searchParams.get('key')).toBe('a&b=c')
    expect(new URL(source!.src).searchParams.get('q')).toBe('x&key=evil#')
  })

  it('rejects a non-https link as the open target', () => {
    expect(mapSource({ center: tehran, mapUrl: 'javascript:alert(1)' })?.href).toMatch(/^https:\/\/www\.openstreetmap\.org\//u)
  })
})
