import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * The two layout primitives the whole theme composes from.
 *
 *   <NavbarShell>  full viewport width, its own edge gutters — the navbar's content
 *                  sits close to the browser edge and does **not** align with the
 *                  1440px container below it.
 *   <ContentContainer>  fluid width, centered, `max-width: 1440px`, safe gutters.
 *
 * Both use padding (never `100vw`), so a scrollbar cannot create horizontal overflow.
 */

export const NavbarShell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('shell-navbar', className)}>{children}</div>
)

export const ContentContainer = ({
  as: Tag = 'div',
  children,
  className,
  id,
}: {
  as?: 'div' | 'footer' | 'header' | 'main' | 'nav' | 'section'
  children: ReactNode
  className?: string
  /** Usually `content`, so the shell's skip link has one target on every state. */
  id?: string
}) => (
  <Tag className={cn('container-content', className)} id={id}>
    {children}
  </Tag>
)
