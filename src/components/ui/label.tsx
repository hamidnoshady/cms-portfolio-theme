'use client'

import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Label, themed.
 *
 * Radix's Label forwards a click on embedded content (the required marker, an inline
 * link) to the associated control, and the theme supplies the same `field__label`
 * treatment the CMS form rendered inline before — so the visual contract and the
 * `htmlFor` association are unchanged.
 */
export const Label = ({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) => (
  <LabelPrimitive.Root className={cn('field__label', className)} {...props} />
)
