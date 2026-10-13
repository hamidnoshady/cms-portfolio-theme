import {
  PaginationDisabled,
  Pagination as PaginationNav,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import type { Locale } from '@/lib/cms/types'
import { formatNumber } from '@/lib/runtime'
import { cn } from '@/lib/utils/cn'

/**
 * Square pagination. Plain links (no client state) so it works without JS, and the
 * page numbers are the only interactive furniture — no "showing X of Y" chrome.
 * The href/query rules live here; the parts come from the themed shadcn Pagination.
 * `basePath` is always the **localized** archive path, so page 2 of `/en/projects`
 * stays under `/en`; the visible numbers go through the runtime digit formatter.
 */
export const Pagination = ({
  basePath,
  className,
  currentPage,
  label,
  labels,
  locale,
  query = '',
  totalPages,
}: {
  basePath: string
  className?: string
  currentPage: number
  label: string
  labels: { next: string; previous: string }
  locale: Locale
  query?: string
  totalPages: number
}) => {
  if (totalPages <= 1) return null

  const hrefFor = (page: number): string => {
    const params = new URLSearchParams(query.replace(/^\?/, ''))
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    const search = params.toString()
    return search ? `${basePath}?${search}` : basePath
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1,
  )

  return (
    <PaginationNav className={cn(className)} label={label}>
      <PaginationContent>
        <PaginationItem>
          {currentPage > 1 ? (
            <PaginationLink href={hrefFor(currentPage - 1)} rel="prev">
              {labels.previous}
            </PaginationLink>
          ) : (
            <PaginationDisabled>{labels.previous}</PaginationDisabled>
          )}
        </PaginationItem>
        {pages.map((page, index) => {
          const previous = pages[index - 1]
          const gap = previous !== undefined && page - previous > 1
          return (
            <PaginationItem key={page}>
              {gap ? <PaginationEllipsis /> : null}
              <PaginationLink current={page === currentPage} href={hrefFor(page)}>
                {formatNumber(page, locale)}
              </PaginationLink>
            </PaginationItem>
          )
        })}
        <PaginationItem>
          {currentPage < totalPages ? (
            <PaginationLink href={hrefFor(currentPage + 1)} rel="next">
              {labels.next}
            </PaginationLink>
          ) : (
            <PaginationDisabled>{labels.next}</PaginationDisabled>
          )}
        </PaginationItem>
      </PaginationContent>
    </PaginationNav>
  )
}
