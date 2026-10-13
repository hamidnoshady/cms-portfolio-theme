import Link from 'next/link'
import type { ReactNode } from 'react'

import { ContentContainer } from '@/components/design/Container'
import { DecorativeMark } from '@/components/design/DecorativeMark'
import { Rule } from '@/components/design/Rule'
import { Skeleton } from '@/components/ui/skeleton'
import type { Locale } from '@/lib/cms/types'
import { labels as dictionary } from '@/lib/theme/labels'

/** Shared empty / error / lifecycle states. Skeletons live below them. */

/** The link row shared by `app/not-found.tsx` and the proxy's 404 route. */
export const NotFoundBody = ({ children }: { children: ReactNode }) => <p className="mt-8">{children}</p>

export const EmptyState = ({
  action,
  body,
  locale,
  title,
}: {
  action?: { href: string; label: string }
  body?: string
  locale: Locale
  title?: string
}) => {
  const t = dictionary(locale)
  return (
    <div className="notice notice--plain relative py-16">
      <DecorativeMark className="top-16 -start-1 hidden md:block" variant="offset-l" />
      <h2 className="type-heading ps-4 md:ps-6">{title ?? t.emptyArchiveTitle}</h2>
      <p className="type-body max-w-[46ch] ps-4 text-ink-secondary md:ps-6">{body ?? t.emptyArchiveBody}</p>
      {action ? (
        <p className="ps-4 md:ps-6">
          <Link className="link-inline type-ui target-standalone" href={action.href}>
            {action.label}
          </Link>
        </p>
      ) : null}
    </div>
  )
}

/**
 * The full-page recoverable failure. It owns the `main` landmark and the page `h1`:
 * an error boundary can replace the whole route, and a state without them would be the
 * only page on the site a screen reader could not land in or name.
 */
export const ErrorState = ({ locale, retry }: { locale: Locale; retry?: () => void }) => {
  const t = dictionary(locale)
  return (
    <ContentContainer as="main" className="flex min-h-svh flex-col justify-center py-24" id="content">
      <Rule className="mb-10 max-w-[10rem]" />
      <h1 className="type-title max-w-[24ch]">{t.errorTitle}</h1>
      <p className="type-body mt-4 max-w-[46ch] text-ink-secondary">{t.errorBody}</p>
      {retry ? (
        <p className="mt-6">
          <button className="btn btn--quiet" onClick={retry} type="button">
            {t.reload}
          </button>
        </p>
      ) : null}
    </ContentContainer>
  )
}

/**
 * Lifecycle holding page: a `suspended`/`archived` site answers **200 + noindex** with
 * no portfolio content and no customer identity beyond the name the CMS still returns.
 */
export const HoldingState = ({ locale, name }: { locale: Locale; name?: null | string }) => {
  const t = dictionary(locale)
  return (
    <ContentContainer as="main" className="flex min-h-svh flex-col justify-center py-24" id="content">
      <Rule className="mb-10 max-w-[10rem]" />
      {name ? <p className="type-label">{name}</p> : null}
      <h1 className="type-title mt-4 max-w-[24ch]">{t.holdingTitle}</h1>
      <p className="type-body mt-4 max-w-[46ch] text-ink-secondary">{t.holdingBody}</p>
    </ContentContainer>
  )
}

/**
 * CMS unreachable. Deliberately not a customer-looking page: the theme will not
 * impersonate a studio identity it cannot verify, and it carries `noindex`.
 */
export const UnreachableState = ({ locale }: { locale: Locale }) => {
  const t = dictionary(locale)
  return (
    <ContentContainer as="main" className="flex min-h-svh flex-col justify-center py-24" id="content">
      <Rule className="mb-10 max-w-[10rem]" />
      <h1 className="type-title max-w-[26ch]">{t.unreachableTitle}</h1>
      <p className="type-body mt-4 max-w-[46ch] text-ink-secondary">{t.unreachableBody}</p>
    </ContentContainer>
  )
}

/* --- skeletons: geometry mirrors the real markup -------------------------- */

/**
 * Every skeleton is announced as one busy region with one localized sentence, and the
 * placeholder geometry itself stays `aria-hidden` (the `Skeleton` primitive). Each
 * composition replicates the *resolved* view: same grid, same ratios, same lead/rows
 * rhythm — so content arriving does not reflow the page.
 */
const LoadingLabel = ({ label }: { label: string }) => <span className="sr-only">{label}</span>

export const ProjectGridSkeleton = ({ count = 8, label = '' }: { count?: number; label?: string }) => (
  <div aria-busy="true" className="grid-projects skeleton-region" role="status">
    <LoadingLabel label={label} />
    {Array.from({ length: count }).map((_, index) => (
      <div className="flex flex-col gap-3" key={index}>
        <Skeleton className="w-full" style={{ aspectRatio: '4 / 5' }} />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    ))}
  </div>
)

/** Education: featured entry (text beside a framed media block) then compact rows. */
export const EducationSkeleton = ({ label = '' }: { label?: string }) => (
  <div aria-busy="true" className="skeleton-region" role="status">
    <LoadingLabel label={label} />
    <div className="grid gap-8 border-b border-line-structural pb-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-start">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
      <Skeleton className="w-full" style={{ aspectRatio: '4 / 3' }} />
    </div>
    <ul className="mt-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <li className="entry-row entry-row--compact" key={index}>
          <Skeleton className="w-full" style={{ aspectRatio: '4 / 3' }} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  </div>
)

/** Blog: lead story + latest-notes column split by the structural divider, then rows. */
export const BlogSkeleton = ({ label = '' }: { label?: string }) => (
  <div aria-busy="true" className="skeleton-region" role="status">
    <LoadingLabel label={label} />
    <div className="split">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-2 w-full" style={{ aspectRatio: '3 / 2' }} />
      </div>
      <span aria-hidden="true" className="split__divider rule-v" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="border-b border-line-structural pb-4" key={index}>
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
    <div className="mt-12">
      <Skeleton className="h-px w-full" />
      <ul className="mt-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <li className="entry-row" key={index}>
            <Skeleton className="w-full" style={{ aspectRatio: '1 / 1' }} />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
)

/** Search: the query field, then single-column text results (no thumbnail track). */
export const SearchSkeleton = ({ label = '' }: { label?: string }) => (
  <div aria-busy="true" className="skeleton-region" role="status">
    <LoadingLabel label={label} />
    <Skeleton className="mb-10 h-11 w-full max-w-[36rem]" />
    <ul>
      {Array.from({ length: 4 }).map((_, index) => (
        <li className="entry-row entry-row--single" key={index}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  </div>
)

export const PageSkeleton = ({ label = '' }: { label?: string }) => (
  <div aria-busy="true" className="skeleton-region py-10" role="status">
    <LoadingLabel label={label} />
    <Skeleton className="mb-8 h-9 w-2/5" />
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  </div>
)
