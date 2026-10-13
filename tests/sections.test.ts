import { describe, expect, it } from 'vitest'
import { categorySubtree, resolveSectionRef, SECTIONS, sectionRouteForKind } from '@/lib/theme/sections'

const categories = [
  { id: '1', parent: null, slug: 'projects' },
  { id: '2', parent: '1', slug: 'residential' },
  { id: '3', parent: '2', slug: 'villas' },
  { id: '4', parent: null, slug: 'objects' },
  { id: '5', parent: '4', slug: 'lamps' },
]

describe('content-slot resolution', () => {
  it('prefers a saved binding over the slug hint', () => {
    expect(resolveSectionRef('about', { about: { id: '42', slug: 'x', title: 'About' } })).toMatchObject({ by: 'binding', id: '42' })
  })
  it('falls back to the slug only while the slot is unbound', () => {
    expect(resolveSectionRef('about', {})).toMatchObject({ by: 'slug', slug: 'about' })
    expect(resolveSectionRef('careers', null)).toMatchObject({ by: 'slug', slug: 'careers' })
    expect(resolveSectionRef('legal', {})).toMatchObject({ by: 'slug', slug: 'legal' })
  })
  it('never substitutes an unrelated document when a binding is empty', () => {
    expect(resolveSectionRef('projects', { projectsCategory: null })).toMatchObject({ by: 'slug', slug: 'projects' })
    expect(resolveSectionRef('objects', { objectsCategory: null })).toMatchObject({ by: 'slug', slug: 'objects' })
  })
  it('declares all nine portfolio slots', () => {
    expect(Object.keys(SECTIONS)).toEqual(expect.arrayContaining(['home', 'about', 'contact', 'careers', 'legal', 'projects', 'objects']))
  })
})

describe('category math', () => {
  it('collects a whole subtree, at any depth', () => {
    expect(categorySubtree(categories[0]!, categories).map((c) => c.id)).toEqual(['2', '3'])
  })
  it('keeps projects and objects subtrees separate', () => {
    expect(categorySubtree(categories[3]!, categories).map((c) => c.id)).toEqual(['5'])
  })
  it('tolerates cycles', () => {
    const cyclic = [{ id: 'a', parent: 'b', slug: 'a' }, { id: 'b', parent: 'a', slug: 'b' }]
    expect(() => categorySubtree(cyclic[0]!, cyclic)).not.toThrow()
  })
})

describe('canonical section per route kind', () => {
  it('maps both portfolio kinds onto their owning section', () => {
    expect(sectionRouteForKind('project')).toBe('projects')
    expect(sectionRouteForKind('objectEntry')).toBe('objects')
    expect(sectionRouteForKind('page')).toBeNull()
  })
})
