'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Copy-to-clipboard for an email address or phone number. Progressive: without
 * JavaScript (or without clipboard access) the link beside it still works, and a
 * failed copy simply leaves the label unchanged. The confirmation is announced through
 * a polite live region rather than by colour.
 */
export const CopyButton = ({
  copiedLabel,
  label,
  value,
}: {
  copiedLabel: string
  label: string
  value: string
}) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button className="reach__copy type-meta" onClick={copy} type="button">
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  )
}
