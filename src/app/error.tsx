'use client'

import { ErrorState } from '@/components/states/States'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState locale="fa" retry={reset} />
}
