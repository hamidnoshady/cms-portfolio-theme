'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** Native share with clipboard fallback and explicit success/error feedback. */
export const ShareButton = ({ labels, title, url }: { labels: { copied: string; copyLink: string; failed: string; done: string; share: string }; title: string; url: string }) => {
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
      <Button onClick={onShare} type="button" variant="default">{labels.share}</Button>
      <span aria-live="polite" className="type-meta" role="status">{status}</span>
    </div>
  )
}
