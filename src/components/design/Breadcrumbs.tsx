import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { Crumb } from '@/lib/routing/breadcrumbs'

/**
 * Breadcrumbs beneath the navbar on every interior page (never on the home stage).
 * The parent segments are real links; the leaf carries `aria-current="page"` and
 * truncates rather than overflowing. Order follows the document direction, so the
 * Persian trail reads right-to-left without extra markup.
 */
export const Breadcrumbs = ({ crumbs, label }: { crumbs: Crumb[]; label: string }) => (
  <Breadcrumb label={label}>
    <BreadcrumbList>
      {crumbs.map((crumb, index) => (
        <BreadcrumbItem key={`${crumb.label}-${index}`}>
          {index > 0 ? <BreadcrumbSeparator /> : null}
          {crumb.href && !crumb.current ? (
            <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
      ))}
    </BreadcrumbList>
  </Breadcrumb>
)
