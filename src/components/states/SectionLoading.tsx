import { ContentContainer } from '@/components/design/Container'
import { SectionHeader } from '@/components/design/SectionHeader'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PageSkeleton,
  ProjectGridSkeleton,
} from '@/components/states/States'
import { loadPageContext } from '@/lib/cms/pageContext'
import { breadcrumbsFor } from '@/lib/routing/breadcrumbs'
import { resolveThemeRoute } from '@/lib/routing/resolve'
import { labels as dictionary, type Dictionary } from '@/lib/theme/labels'
import { InteriorPage } from '@/views/InteriorPage'
import type { Locale } from '@/lib/cms/types'

/**
 * Segment-level loading UI.
 *
 * Three rules make this worth its weight:
 *
 * 1. **The shell stays.** The bar the visitor just clicked in, the footer and the
 *    breadcrumb row are the *real* ones — they come from the same chrome the resolved
 *    page renders, so a slow archive never flashes a blank white screen or shifts the
 *    layout when the content lands.
 * 2. **The header survives too.** Archives render their real `SectionHeader` (title,
 *    hairline rule, filter geometry) while loading; only the collection-dependent part
 *    becomes a skeleton, so the visible anchor does not change on resolve.
 * 3. **The skeleton is the real geometry.** Each variant mirrors the component it
 *    replaces: the project grid keeps its 2/3/4 columns and mixed ratios, education
 *    keeps the featured-entry-then-rows rhythm, the blog keeps the lead/latest split
 *    with its divider, and search keeps single-column rows. Nothing is a generic box.
 *
 * Each region carries one localized sentence for screen readers; the placeholder
 * geometry itself is `aria-hidden`. Chrome data (`/api/site`, header, footer) is cached
 * by the CMS client, so the shell is normally warm by the time a visitor navigates —
 * only the archive's own collection read is slow.
 */

export type LoadingVariant = 'detail' | 'objects' | 'page' | 'projects'

const titleFor = (variant: LoadingVariant, t: Dictionary): null | string => {
  switch (variant) {
    case 'projects':
      return t.projects
    case 'objects':
      return t.objects
    default:
      return null
  }
}

const showsFilters = (variant: LoadingVariant): boolean =>
  variant === 'projects' || variant === 'objects'

/** Filter chips exist only when the CMS returned categories; the stub keeps the row. */
const FilterRowSkeleton = () => (
  <div aria-hidden="true" className="filter-group">
    <Skeleton className="h-10 w-24" />
    <Skeleton className="h-10 w-20" />
    <Skeleton className="h-10 w-28" />
  </div>
)

const skeletonFor = (variant: LoadingVariant, label: string) => {
  switch (variant) {
    case 'projects':
    case 'objects':
      return <ProjectGridSkeleton label={label} />
    case 'detail':
    case 'page':
    default:
      return <PageSkeleton label={label} />
  }
}

export const SectionLoading = async ({
  locale,
  path,
  route,
  variant,
}: {
  locale: Locale
  /** Localizable path of the route being loaded, e.g. `/projects`. */
  path: string
  /** Locale-aware segment list for breadcrumb resolution, e.g. `['en', 'projects']`. */
  route: string[]
  variant: LoadingVariant
}) => {
  const outcome = await loadPageContext(locale, path)
  const t = dictionary(locale)
  const skeleton = skeletonFor(variant, t.loading)
  const title = titleFor(variant, t)

  // Chrome unavailable: the skeleton is still the honest thing to show. It is
  // deliberately not the holding or error state — those belong to a resolved read.
  if (!outcome.ok) {
    return (
      <ContentContainer>
        <div className="py-10">{skeleton}</div>
      </ContentContainer>
    )
  }

  const ctx = outcome.ctx
  const crumbs = breadcrumbsFor(resolveThemeRoute(route, ctx.site), ctx.site)

  return (
    <InteriorPage context={ctx} crumbs={crumbs} currentPath={path} label={t.breadcrumb}>
      {title ? (
        <SectionHeader actions={showsFilters(variant) ? <FilterRowSkeleton /> : null} title={title} />
      ) : null}
      <ContentContainer>
        <div className={title ? undefined : 'py-10'}>{skeleton}</div>
      </ContentContainer>
    </InteriorPage>
  )
}
