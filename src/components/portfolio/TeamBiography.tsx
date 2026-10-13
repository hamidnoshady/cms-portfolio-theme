'use client'
import { useEffect, useRef, useState } from 'react'
import { CmsImage } from '@/components/media/CmsImage'
import type { Media } from '@/lib/cms/types'

export type BiographyMember = { id: string; name: string; role: null | string; bio: null | string; photo: Media | null; socials: Array<{ label: string; url: string }> }

/** Accessible biography panel: explicit close, focus restore, Escape, mobile fullscreen. */
export const TeamBiography = ({ labels, member, origin }: { labels: { biography: string; close: string; open: string }; member: BiographyMember; origin: string }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open ])
  const close = () => { setOpen(false); triggerRef.current?.focus() }
  return (
    <>
      <button ref={triggerRef} type="button" className="bang-btn bang-btn--ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {labels.open}
      </button>
      {open ? (
        <div className="bang-bio__backdrop">
          <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${member.name} — ${labels.biography}`} className="bang-bio">
            <div className="bang-bio__head">
              <h3>{member.name}</h3>
              <button type="button" className="bang-btn" onClick={close}>{labels.close}</button>
            </div>
            {member.role ? <p className="type-meta">{member.role}</p> : null}
            {member.photo ? <CmsImage media={member.photo} origin={origin} ratio="4 / 3" sizes="(min-width:768px) 30vw, 90vw" alt={member.name} /> : null}
            {member.bio ? <p className="type-body">{member.bio}</p> : null}
            {member.socials.length ? (
              <ul className="bang-bio__socials">
                {member.socials.map((s) => (
                  <li key={s.url}><a className="link-inline type-ui target-standalone" href={s.url} rel="noreferrer" target="_blank">{s.label}</a></li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
