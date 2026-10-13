/**
 * Portfolio section-resolution rules. Pure, no fetch — same rules drive routes,
 * navigation, breadcrumbs and sitemap.
 *
 * Content slots (eshobe.theme.json): home, about, contact, careers, legal (pages);
 * projectsCategory, objectsCategory (categories); contactForm, careersForm (forms).
 * Projects and Objects share one underlying case-study model (posts).
 */

export type SectionKey =
  | 'about'
  | 'careers'
  | 'contact'
  | 'home'
  | 'legal'
  | 'objects'
  | 'projects'

export type SectionKind = 'category' | 'page'

export type SectionRule = {
  kind: SectionKind
  hint: null | string
  slot: string
}

export const SECTIONS: Record<SectionKey, SectionRule> = {
  home: { kind: 'page', slot: 'home', hint: 'home' },
  about: { kind: 'page', slot: 'about', hint: 'about' },
  contact: { kind: 'page', slot: 'contact', hint: 'contact' },
  careers: { kind: 'page', slot: 'careers', hint: 'careers' },
  legal: { kind: 'page', slot: 'legal', hint: 'legal' },
  projects: { kind: 'category', slot: 'projectsCategory', hint: 'projects' },
  objects: { kind: 'category', slot: 'objectsCategory', hint: 'objects' },
}

export const FORM_SLOTS = {
  contactForm: 'contactForm',
  careersForm: 'careersForm',
} as const

export type BindingValue = null | { id: string; slug: null | string; title: null | string }

export type SectionRef =
  | { by: 'binding'; id: string; slug: null | string; source: 'bound' }
  | { by: 'slug'; slug: string; source: 'hint' }
  | { by: 'none'; source: 'unbound' }

export const resolveSectionRef = (
  section: SectionKey,
  bindings: Record<string, BindingValue> | null | undefined,
): SectionRef => {
  const rule = SECTIONS[section]
  const binding = bindings?.[rule.slot]
  if (binding && binding.id) {
    return { by: 'binding', id: binding.id, slug: binding.slug ?? null, source: 'bound' }
  }
  if (rule.hint) return { by: 'slug', slug: rule.hint, source: 'hint' }
  return { by: 'none', source: 'unbound' }
}

export const categorySubtree = (root: CategoryDocLike, all: CategoryDocLike[]): CategoryDocLike[] => {
  const seen = new Set<string>([String(root.id)])
  const walk = (parent: CategoryDocLike): CategoryDocLike[] =>
    all
      .filter((candidate) => idOf(candidate.parent) === String(parent.id))
      .flatMap((child) => {
        const id = String(child.id)
        if (seen.has(id)) return []
        seen.add(id)
        return [child, ...walk(child)]
      })
  return walk(root)
}

type CategoryDocLike = { id: string; parent?: unknown }

const idOf = (value: unknown): null | string => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export const categoryIds = (categories: CategoryDocLike[]): string[] => categories.map((c) => String(c.id))

export const sectionPath = (section: SectionKey): string => (section === 'home' ? '/' : `/${section}`)

export const sectionRouteForKind = (kind: 'objectEntry' | 'page' | 'project'): SectionKey | null =>
  kind === 'project' ? 'projects' : kind === 'objectEntry' ? 'objects' : null
