'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Button, restyled: square, black-on-white or white-on-black, 44px minimum
 * touch target, no shadow. Variants map onto the theme's `.btn` classes so a Radix
 * `asChild` link and a native `<button>` are visually identical.
 */
const buttonVariants = cva('btn', {
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
  variants: {
    size: {
      default: '',
      square: 'btn--square',
      wide: 'min-w-[12rem]',
    },
    variant: {
      bare: 'btn--bare',
      default: '',
      quiet: 'btn--quiet',
    },
  },
})

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export const Button = ({ asChild = false, className, size, variant, ...props }: ButtonProps) => {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ className, size, variant }))} {...props} />
}

export { buttonVariants }
