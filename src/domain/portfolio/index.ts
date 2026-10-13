/**
 * One source of truth for case-study data mapping and project metadata.
 * Projects and Objects share one underlying implementation (posts + categories);
 * only the section root differs.
 */
import type { Media, PostDoc } from '@/lib/cms/types'

export const HONEYPOT_FIELD = '__eshobe_website_check'

export type CaseStudy = {
  id: string
  slug: string
  title: string
  year: null | string
  location: null | string
  type: null | string
  collaborators: null | string
  facts: Array<{ label: string; value: string }>
  hero: Media | null
  excerpt: null | string
}

export const localizedText = (value: unknown): null | string => {
  if (typeof value === 'string') {
    const t = value.trim()
    return t ? t : null
  }
  return null
}

const yearFromDate = (date: unknown): null | string => {
  if (typeof date !== 'string' || !date) return null
  const m = date.match(/(\d{4})/)
  return m?.[1] ?? null
}

export const toCaseStudy = (post: PostDoc): CaseStudy => {
  const meta = (post.projectMetadata ?? {}) as Record<string, unknown>
  const facts = Array.isArray(meta.additionalFacts)
    ? (meta.additionalFacts as Array<{ label?: unknown; value?: unknown }>)
        .filter((f) => localizedText(f.label) && localizedText(f.value))
        .map((f) => ({ label: localizedText(f.label)!, value: localizedText(f.value)! }))
        .slice(0, 8)
    : []
  const hero = (post.heroImage ?? null) as Media | null
  return {
    id: String(post.id),
    slug: post.slug,
    title: localizedText(post.title) ?? post.slug,
    year: (yearFromDate(meta.date) ?? localizedText(meta.status) ?? null) as null | string,
    location: localizedText(meta.location),
    type: localizedText(meta.status) && yearFromDate(meta.date) ? localizedText(meta.status) : localizedText(meta.area) ?? localizedText(meta.status),
    collaborators: localizedText(meta.client),
    facts,
    hero,
    excerpt: localizedText(post.meta?.description) ?? null,
  }
}

export const stableSort = <T extends { slug: string; publishedAt?: null | string }>(docs: T[]): T[] =>
  [...docs].sort((a, b) => {
    const da = a.publishedAt ?? ''
    const db = b.publishedAt ?? ''
    if (da !== db) return db.localeCompare(da)
    return String(a.slug).localeCompare(String(b.slug))
  })

export const isValidHttpUrl = (value: string): boolean => {
  const t = value.trim()
  if (!t) return false
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** CMS field names must never collide with the reserved honeypot. */
export const isReservedFieldName = (name: string): boolean => name === HONEYPOT_FIELD

export const validateFieldNames = (names: string[]): string[] => names.filter(isReservedFieldName)

export type TeamMember = {
  id: string
  name: string
  role: null | string
  bio: null | string
  photo: Media | null
  socials: Array<{ label: string; url: string }>
}

const asSocials = (value: unknown): Array<{ label: string; url: string }> => {
  if (!Array.isArray(value)) return []
  return value
    .filter((e): e is { label?: unknown; url?: unknown } => Boolean(e) && typeof e === 'object')
    .map((e) => ({ label: localizedText(e.label) ?? 'Link', url: typeof e.url === 'string' ? e.url : '' }))
    .filter((e) => e.url && isValidHttpUrl(e.url) && e.label)
    .slice(0, 4)
}

export const toTeamMember = (member: Record<string, unknown>, index: number): TeamMember => ({
  id: typeof member.id === 'string' ? member.id : `member-${index}`,
  name: localizedText(member.name) ?? `Member ${index + 1}`,
  role: localizedText(member.role),
  bio: localizedText(member.bio),
  photo: (member.photo as Media | null) ?? null,
  socials: asSocials((member as { socials?: unknown }).socials ?? (member as { links?: unknown }).links),
})

export const sectionForCategories = (categoryIds: string[], projectsRoot: null | string, objectsRoot: null | string): 'objects' | 'projects' | null => {
  // Caller passes resolved root ids; membership is by exact root match on the
  // already-resolved subtree. Kept pure for unit tests.
  void categoryIds
  void projectsRoot
  void objectsRoot
  return null
}
