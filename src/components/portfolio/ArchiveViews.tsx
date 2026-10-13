'use client'
import Link from 'next/link'
import { useState } from 'react'
import { CmsImage } from '@/components/media/CmsImage'
import type { Media } from '@/lib/cms/types'

export type ArchiveEntry = {
  href: string
  title: string
  year: null | string
  location: null | string
  type: null | string
  collaborators: null | string
  media: Media | null
}

/**
 * Shared archive presentation for Projects and Objects.
 * Desktop: numbered rows with one photographic preview (hover AND focus update it).
 * Mobile: photographic cards with readable titles/metadata.
 */
export const PortfolioArchive = ({ entries, origin }: { entries: ArchiveEntry[]; origin: string }) => {
  const [selected, setSelected] = useState(0)
  const current = entries[Math.min(selected, Math.max(0, entries.length - 1))] ?? null
  if (entries.length === 0) return null
  return (
    <div className="bang-archive">
      {/* Desktop numbered list */}
      <div className="bang-archive__desktop">
        <ol className="bang-rows">
          {entries.map((e, i) => (
            <li key={e.href}>
              <Link
                className={i === selected ? 'bang-row is-selected' : 'bang-row'}
                href={e.href}
                onFocus={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
              >
                <span className="bang-row__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="bang-row__title">{e.title}</span>
                <span className="bang-row__meta">
                  {[e.type, e.location, e.year].filter(Boolean).join(' — ')}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="bang-preview" aria-hidden="true">
          {current?.media ? (
            <CmsImage key={current.href} media={current.media} origin={origin} ratio="4 / 3" sizes="(min-width:1280px) 32vw, 40vw" alt="" />
          ) : (
            <div className="bang-preview__empty" />
          )}
        </div>
      </div>
      {/* Mobile photographic cards */}
      <ol className="bang-cards">
        {entries.map((e) => (
          <li key={e.href}>
            <article className="bang-card">
              <Link className="bang-card__link" href={e.href}>
                <span className="bang-card__frame">
                  <CmsImage media={e.media} origin={origin} ratio="4 / 3" sizes="100vw" alt={e.title} />
                </span>
                <span className="bang-card__caption">
                  <span className="bang-card__title">{e.title}</span>
                  <span className="bang-card__meta">{[e.type, e.location, e.year].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            </article>
          </li>
        ))}
      </ol>
    </div>
  )
}
