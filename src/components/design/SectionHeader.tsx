import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

import { ContentContainer } from './Container'
import { DecorativeMark } from './DecorativeMark'
import { Rule } from './Rule'

/**
 * The shared interior-page header: breadcrumbs (rendered by the page), a modest title
 * with a crosshair mark, an optional lede, and the rule that separates the heading
 * area from the archive below it. Not used on the home stage.
 */
export const SectionHeader = ({
  actions,
  children,
  lede,
  mark = 'crosshair',
  title,
}: {
  actions?: ReactNode
  children?: ReactNode
  lede?: null | string
  mark?: 'crosshair' | 'pair'
  title: string
}) => (
  <ContentContainer as="header" className="relative">
    <div className="relative pt-6 pb-8 md:pt-10 md:pb-10">
      <DecorativeMark className="top-8 -start-1 hidden md:block" variant={mark} />
      <h1 className="type-title max-w-[24ch] text-balance ps-4 md:ps-6">{title}</h1>
      {lede ? <p className="type-lede mt-4 ps-4 md:ps-6">{lede}</p> : null}
      {actions ? <div className="mt-6 ps-4 md:ps-6">{actions}</div> : null}
      {children}
    </div>
    <Rule className={cn('mb-10')} />
  </ContentContainer>
)
