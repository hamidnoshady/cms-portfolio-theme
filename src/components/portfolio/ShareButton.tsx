'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type ShareLabels = {
  copied: string
  copyLink: string
  done: string
  failed: string
  share: string
}

/** Native share with clipboard fallback and explicit success/error feedback. */
export const ShareButton = ({
  labels,
  title,
  url,
}: {
  labels: ShareLabels
  title: string
  url: string
}) => {
  const [status, setStatus] = useState<null | string>(null)
  const onShare = async () => {
    setStatus(null)
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, url })
        setStatus(labels.done)
        return
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus(labels.done)
    } catch {
      setStatus(labels.failed)
    }
  }
  return (
    <div className="flex items-center gap-3">
      <Button data-cursor="control" onClick={onShare} type="button" variant="default">
        {labels.share}
      </Button>
      <span aria-live="polite" className="type-meta" role="status">
        {status}
      </span>
    </div>
  )
}
