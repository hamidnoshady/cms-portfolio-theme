'use client'

import { useEffect, useRef, useState } from 'react'

import { CmsImage } from '@/components/media/CmsImage'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { TeamMember } from '@/domain/portfolio'
import type { Media } from '@/lib/cms/types'

export type BiographyMember = {
  id: string
  name: string
  role: null | string
  bio: null | string
  photo: Media | null
  socials: Array<{ label: string; url: string }>
}

/**
 * Accessible biography panel used both as a single-member trigger (`member`) and as a
 * compact team rail on About (`members`).
 */
export const TeamBiography = ({
  dir = 'rtl',
  heading,
  labels,
  member,
  members,
  origin = '',
}: {
  closeLabel?: string
  dir?: 'ltr' | 'rtl'
  heading?: string
  labels?: { biography: string; close: string; open: string }
  member?: BiographyMember
  members?: TeamMember[]
  origin?: string
}) => {
  const [openSingle, setOpenSingle] = useState(false)
  const [activeIndex, setActiveIndex] = useState<null | number>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openSingle) return
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpenSingle(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [openSingle])

  if (member && labels) {
    const close = () => {
      setOpenSingle(false)
      triggerRef.current?.focus()
    }
    return (
      <>
        <button
          aria-haspopup="dialog"
          className="bang-btn bang-btn--ghost target-standalone"
          data-cursor="control"
          onClick={() => setOpenSingle(true)}
          ref={triggerRef}
          type="button"
        >
          {labels.open}
        </button>
        {openSingle ? (
          <div className="bang-bio__backdrop">
            <div
              aria-label={`${member.name} — ${labels.biography}`}
              aria-modal="true"
              className="bang-bio"
              ref={panelRef}
              role="dialog"
            >
              <div className="bang-bio__head">
                <h3>{member.name}</h3>
                <button className="bang-btn" onClick={close} type="button">
                  {labels.close}
                </button>
              </div>
              {member.role ? <p className="type-meta">{member.role}</p> : null}
              {member.photo ? (
                <CmsImage
                  alt={member.name}
                  media={member.photo}
                  origin={origin}
                  ratio="4 / 3"
                  sizes="(min-width:768px) 30vw, 90vw"
                />
              ) : null}
              {member.bio ? <p className="type-body">{member.bio}</p> : null}
              {member.socials.length ? (
                <ul className="bang-bio__socials">
                  {member.socials.map((s) => (
                    <li key={s.url}>
                      <a
                        className="link-inline type-ui target-standalone"
                        href={s.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}
      </>
    )
  }

  const list = members ?? []
  if (list.length === 0) return null
  const active = activeIndex !== null ? list[activeIndex] ?? null : null

  return (
    <section aria-label={heading} className="bang-team">
      {heading ? <h2 className="bang-team__heading">{heading}</h2> : null}
      <ul className="bang-team__list">
        {list.map((m, index) => (
          <li className="bang-team__item" key={m.id}>
            <button
              aria-expanded={activeIndex === index}
              aria-haspopup="dialog"
              className="bang-team__trigger target-standalone"
              data-cursor="control"
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <span className="bang-team__name" dir="auto">{m.name}</span>
              {m.role ? <span className="bang-team__role" dir="auto">{m.role}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog onOpenChange={(open) => !open && setActiveIndex(null)} open={active !== null}>
        {active ? (
          <DialogContent aria-describedby={undefined} dir={dir} title={active.name}>
            {active.role ? <p className="type-meta -mt-2 mb-4" dir="auto">{active.role}</p> : null}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              {active.photo ? (
                <div className="md:col-span-5">
                  <CmsImage
                    alt={active.name}
                    className="w-full object-cover"
                    media={active.photo}
                    origin={origin}
                    ratio="4 / 5"
                  />
                </div>
              ) : null}
              <div className={active.photo ? 'md:col-span-7' : 'md:col-span-12'}>
                {active.bio ? (
                  <p className="type-body text-ink-secondary whitespace-pre-line" dir="auto">
                    {active.bio}
                  </p>
                ) : null}
                {active.socials.length > 0 ? (
                  <ul className="mt-5 flex flex-wrap gap-4">
                    {active.socials.map((s) => (
                      <li key={`${s.label}-${s.url}`}>
                        <a
                          className="link-inline type-caption target-standalone"
                          data-cursor="control"
                          href={s.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}
