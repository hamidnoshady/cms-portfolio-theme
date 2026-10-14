'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CmsImage } from '@/components/media/CmsImage'
import type { Media } from '@/lib/cms/types'
import type { ArchiveLayout } from '@/lib/theme/settings'
import { cn } from '@/lib/utils/cn'

export type ArchiveEntry = {
  collaborators: null | string
  href: string
  location: null | string
  media: Media | null
  title: string
  type: null | string
  year: null | string
}

const storageKey = (section: string) => `bang:archive:selected:${section}`

/**
 * Shared compact archive presentation for Projects and Objects.
 *
 * - Desktop (`index` or `auto` at `>= 48rem`): compact centered numbered list paired with
 *   an adjacent small photographic preview. Hover, keyboard focus, and click update the
 *   active row (`data-active="true"`, black `#000000` title vs muted `#595959` inactive
 *   rows) and persist the selection in `sessionStorage` so returning from a case study
 *   keeps the visitor's active row.
 * - Mobile (`auto` at `< 48rem`) or `grid` layout: photographic cards with readable
 *   titles and metadata without requiring pointer hover.
 */
export const PortfolioArchive = ({
  entries,
  layout = 'auto',
  origin,
  sectionKey = 'projects',
  startIndex = 1,
}: {
  entries: ArchiveEntry[]
  layout?: ArchiveLayout
  origin: string
  sectionKey?: string
  startIndex?: number
}) => {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    try {
      const savedHref = window.sessionStorage.getItem(storageKey(sectionKey))
      if (!savedHref) return
      const idx = entries.findIndex((entry) => entry.href === savedHref)
      if (idx >= 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved selection from sessionStorage on mount
        setSelected(idx)
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [entries, sectionKey])

  if (entries.length === 0) return null

  const selectIndex = (index: number) => {
    setSelected(index)
    const entry = entries[index]
    if (!entry) return
    try {
      window.sessionStorage.setItem(storageKey(sectionKey), entry.href)
    } catch {
      /* ignore */
    }
  }

  const current = entries[Math.min(selected, Math.max(0, entries.length - 1))] ?? null
  const showIndex = layout === 'auto' || layout === 'index'
  const showCards = layout === 'auto' || layout === 'grid'

  return (
    <div className="bang-archive" data-archive-layout={layout}>
      {showIndex ? (
        <div
          className={cn(
            'bang-archive__desktop bang-archive__stage',
            layout === 'index' && 'bang-archive__desktop--always',
          )}
        >
          <div aria-hidden="true" className="bang-archive__preview bang-preview">
            {current?.media ? (
              <CmsImage
                alt=""
                className="bang-archive__preview-img"
                key={current.href}
                media={current.media}
                origin={origin}
                ratio="4 / 5"
                sizes="(min-width:1280px) 22vw, 32vw"
              />
            ) : (
              <div className="bang-archive__preview-empty bang-preview__empty media-missing" data-media-state="missing" />
            )}
          </div>

          <ol className="bang-archive__list bang-rows">
            {entries.map((e, i) => {
              const isSelected = i === selected
              const numberLabel = String(startIndex + i).padStart(2, '0')
              const meta = [e.type, e.location, e.year].filter(Boolean).join(' — ')
              return (
                <li key={e.href}>
                  <Link
                    className={isSelected ? 'bang-row is-selected' : 'bang-row'}
                    data-active={isSelected ? 'true' : 'false'}
                    data-cursor="control"
                    href={e.href}
                    onClick={() => selectIndex(i)}
                    onFocus={() => selectIndex(i)}
                    onMouseEnter={() => selectIndex(i)}
                  >
                    <span aria-hidden="true" className="bang-row__num">{numberLabel}</span>
                    <span className="bang-row__title" dir="auto">{e.title}</span>
                    {meta ? <span className="bang-row__meta" dir="auto">{meta}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {showCards ? (
        <ol
          className={cn(
            'bang-cards',
            layout === 'auto' && 'bang-cards--auto',
            layout === 'grid' && 'bang-cards--grid',
          )}
        >
          {entries.map((e, i) => {
            const numberLabel = String(startIndex + i).padStart(2, '0')
            const meta = [e.type, e.location, e.year].filter(Boolean).join(' · ')
            return (
              <li key={e.href}>
                <article className="bang-card">
                  <Link
                    className="bang-card__link"
                    data-cursor="control"
                    href={e.href}
                    onClick={() => selectIndex(i)}
                  >
                    <span className="bang-card__media bang-card__frame">
                      <CmsImage
                        alt={e.title}
                        className="bang-card__img"
                        media={e.media}
                        origin={origin}
                        ratio="4 / 3"
                        sizes="(min-width: 768px) 45vw, 100vw"
                      />
                    </span>
                    <span className="bang-card__caption">
                      <span aria-hidden="true" className="bang-card__num">{numberLabel}</span>
                      <span className="bang-card__title" dir="auto">{e.title}</span>
                      {meta ? <span className="bang-card__meta" dir="auto">{meta}</span> : null}
                    </span>
                  </Link>
                </article>
              </li>
            )
          })}
        </ol>
      ) : null}
    </div>
  )
}
