import type { SiteDescriptor } from '@/lib/cms/types'

export type ArchiveLayout = 'auto' | 'grid' | 'index'

export type ResolvedThemeSettings = {
  archiveLayout: ArchiveLayout
  canvasDensity: number
  canvasMotion: boolean
}

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const asBoundedNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

const asArchiveLayout = (value: unknown): ArchiveLayout =>
  value === 'index' || value === 'grid' || value === 'auto' ? value : 'auto'

export const resolveThemeSettings = (site: null | Pick<SiteDescriptor, 'themeRuntime'>): ResolvedThemeSettings => {
  const raw = site?.themeRuntime?.settings ?? {}
  return {
    archiveLayout: asArchiveLayout(raw.archiveLayout),
    canvasDensity: asBoundedNumber(raw.canvasDensity, 6, 2, 12),
    canvasMotion: asBoolean(raw.canvasMotion, true),
  }
}
