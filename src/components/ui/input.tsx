import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * shadcn/ui Input, restyled: underline field, square, no shadow, no rounded corners.
 * The CMS form uses these for every single-line and multi-line field so the field
 * treatment lives in one place.
 */
export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn('field__control', className)} {...props} />
)

/** shadcn/ui Textarea — the Input treatment, multi-line. */
export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn('field__control', className)} {...props} />
)
