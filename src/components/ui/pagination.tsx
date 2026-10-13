import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Pagination, themed: square, link-only (works without JS), 40px targets.
 *
 * These are the presentational parts; the route-aware hrefs (page query string,
 * current/disabled states) are built in `components/design/Pagination.tsx`. The list
 * semantics come from `PaginationContent` (a real `<ul>`), and the theme's
 * `.pagination` stylesheet owns the layout.
 */
export const Pagination = ({ className, label = 'pagination', ...props }: ComponentProps<'nav'> & { label?: string }) => (
  <nav aria-label={label} className={cn('pagination', className)} {...props} />
)

export const PaginationContent = ({ className, ...props }: ComponentProps<'ul'>) => (
  <ul className={cn(className)} {...props} />
)

export const PaginationItem = ({ className, ...props }: ComponentProps<'li'>) => (
  <li className={cn('flex items-center gap-2', className)} {...props} />
)

export const PaginationLink = ({
  className,
  current,
  ...props
}: ComponentProps<typeof Link> & { current?: boolean }) => (
  <Link aria-current={current ? 'page' : undefined} className={cn('pagination__item', className)} {...props} />
)

/** The placeholder for a direction that has no page (first/last): announced as disabled. */
export const PaginationDisabled = ({ className, ...props }: ComponentProps<'span'>) => (
  <span aria-disabled="true" className={cn('pagination__item', className)} {...props} />
)

/** The gap marker between distant page numbers — decorative, never announced. */
export const PaginationEllipsis = ({ className, ...props }: ComponentProps<'span'>) => (
  <span aria-hidden="true" className={cn(className)} {...props}>
    …
  </span>
)
