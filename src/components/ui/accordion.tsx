'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Minus, Plus } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/** Radix Accordion for CMS FAQ blocks: hairline rows, square, no card chrome. */
export const Accordion = AccordionPrimitive.Root

export const AccordionItem = ({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item className={cn('accordion__item', className)} {...props} />
)

export const AccordionTrigger = ({
  children,
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) => (
  <AccordionPrimitive.Header>
    <AccordionPrimitive.Trigger className={cn('accordion__trigger', className)} {...props}>
      {children}
      <span aria-hidden="true" className="relative inline-flex size-4 items-center justify-center">
        <Plus className="[[data-state=open]_&]:hidden" size={16} strokeWidth={1.5} />
        <Minus className="hidden [[data-state=open]_&]:block" size={16} strokeWidth={1.5} />
      </span>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
)

export const AccordionContent = ({
  children,
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content className={cn('accordion__content', className)} {...props}>
    {children}
  </AccordionPrimitive.Content>
)
