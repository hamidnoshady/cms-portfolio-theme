import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui's class merger, unchanged. Tailwind only; no second class system. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
