'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Dialog, themed: white panel, hairline edge, square, no shadow.
 *
 * Compositional on purpose — the parts are exported and the consumer supplies the
 * layout; a titled dialog gets the theme's header row for free. The backdrop is the
 * dialog's own `.dialog__overlay` (a half-opacity black fade), not the navigation
 * drawer's wash: the two patterns are styled independently.
 *
 * The media lightbox is **not** built from `DialogContent`: it composes the Radix
 * primitives directly in `components/media/Lightbox.tsx` so Motion can animate the
 * overlay, the layer and the image change (the drawer does the same with CSS in
 * `sheet.tsx`). Portals render on `document.body`, so consumers pass `dir` explicitly.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = ({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay className={cn('dialog__overlay', className)} {...props} />
)

export const DialogContent = ({
  children,
  className,
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title?: string }) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-[60] max-h-[90svh] w-[min(90vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto p-6',
        title ? 'surface-panel' : undefined,
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="type-subheading">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close aria-label="close" className="btn btn--bare btn--square">
            <X aria-hidden="true" size={18} strokeWidth={1.5} />
          </DialogPrimitive.Close>
        </div>
      ) : null}
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
)
