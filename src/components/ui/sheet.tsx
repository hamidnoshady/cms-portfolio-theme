'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Sheet = Radix Dialog with a direction-aware edge panel. Entry/exit are keyframe
 * animations on `data-state` (one animation engine per interaction — the drawer is
 * CSS, Motion is reserved for the home stage) because Radix's Presence waits for a
 * CSS animation before unmounting, which a bare transition does not provide. Radix
 * keeps the focus trap, Escape handling, focus restoration and scroll lock; this
 * component only styles them.
 */
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

export const SheetContent = ({
  children,
  className,
  dir,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { children: ReactNode; dir: 'ltr' | 'rtl' }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="drawer__overlay" />
    <DialogPrimitive.Content
      className={cn('drawer__panel', className)}
      dir={dir}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
)
