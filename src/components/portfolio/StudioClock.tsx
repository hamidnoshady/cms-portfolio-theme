'use client'
import { useEffect, useState } from 'react'

/** Configurable studio clocks from IANA zones. Client-rendered to avoid hydration mismatch. */
export const StudioClock = ({ clocks }: { clocks: Array<{ label: string; zone: string }> }) => {
  const [now, setNow] = useState<null | Date>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock must mount as null (SSR) then hydrate to client time; interval keeps it fresh without full-page rerenders.
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (!clocks.length) return null
  return (
    <p className="type-meta tabular-nums" aria-label="Studio time">
      {clocks.map((c, i) => (
        <span key={c.zone + c.label}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <span>{c.label} </span>
          <time dateTime={now?.toISOString()}>
            {now ? formatTime(now, c.zone) : '--:--'}
          </time>
        </span>
      ))}
    </p>
  )
}

const formatTime = (date: Date, zone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(date)
  } catch {
    return '--:--'
  }
}
