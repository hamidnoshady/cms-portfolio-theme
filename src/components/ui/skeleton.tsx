import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 3–6% black, square, gentle opacity pulse, static under `prefers-reduced-motion`
 * (the animation is disabled in `components.css`, not by a JS branch).
 */
export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div aria-hidden="true" className={cn('skeleton', className)} {...props} />
)
