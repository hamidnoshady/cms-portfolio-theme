import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

type Role = 'caption' | 'display' | 'error' | 'heading' | 'label' | 'lede' | 'meta' | 'subheading' | 'title' | 'ui'

const defaultTag: Record<Role, ElementType> = {
  caption: 'p',
  display: 'h1',
  error: 'p',
  heading: 'h2',
  label: 'span',
  lede: 'p',
  meta: 'span',
  subheading: 'h3',
  title: 'h1',
  ui: 'span',
}

/** Semantic typography without ad-hoc font sizes anywhere in the tree. */
export const Type = ({
  as,
  children,
  className,
  role,
}: {
  as?: ElementType
  children: ReactNode
  className?: string
  role: Role
}) => {
  const Tag = as ?? defaultTag[role]
  return <Tag className={cn(`type-${role}`, className)}>{children}</Tag>
}
