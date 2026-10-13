import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Breadcrumb, themed.
 *
 * Presentational parts only; the route-aware trail (`Crumb[]` with translated labels)
 * stays in `components/design/Breadcrumbs.tsx`. The root takes the accessible name the
 * caller supplies, the separator is `/` and decorative, and the current page keeps
 * `aria-current="page"` — the theme's own breadcrumb contract, restyled into the
 * shadcn component shape (optionally truncated by the `.breadcrumbs` styles).
 */
export const Breadcrumb = ({ children, className, label, ...props }: ComponentProps<'nav'> & { label: string }) => (
  <nav aria-label={label} className={cn(className)} {...props}>
    {children}
  </nav>
)

export const BreadcrumbList = ({ className, ...props }: ComponentProps<'ol'>) => (
  <ol className={cn('breadcrumbs', className)} {...props} />
)

export const BreadcrumbItem = ({ className, ...props }: ComponentProps<'li'>) => (
  <li className={cn('flex min-w-0 items-center gap-2', className)} {...props} />
)

export const BreadcrumbLink = ({ className, ...props }: ComponentProps<typeof Link>) => (
  <Link className={cn(className)} {...props} />
)

export const BreadcrumbPage = ({ className, ...props }: ComponentProps<'span'>) => (
  <span aria-current="page" className={cn(className)} {...props} />
)

export const BreadcrumbSeparator = ({ children, className, ...props }: ComponentProps<'span'>) => (
  <span aria-hidden="true" className={cn('breadcrumbs__sep', className)} {...props}>
    {children ?? '/'}
  </span>
)
