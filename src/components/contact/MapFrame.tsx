'use client'

import { useState } from 'react'

import { DecorativeMark } from '@/components/design/DecorativeMark'

/**
 * The studio map. It is a quiet drafting-grid placeholder until the visitor asks for it:
 * a map frame loads the provider's scripts and tells it the visitor's IP address, so
 * nothing is requested until the button is pressed. The "open in maps" link is always
 * there and costs nothing.
 *
 * Provider maps are colour; the frame desaturates them so the page stays black and white.
 */
export const MapFrame = ({
  href,
  kind,
  labels,
  src,
}: {
  href: string
  kind: 'iframe' | 'image'
  labels: { open: string; show: string; title: string }
  src: string
}) => {
  const [shown, setShown] = useState(false)

  return (
    <figure className="map">
      <div className="map__frame">
        {shown ? (
          kind === 'image' ? (
            <img alt={labels.title} className="map__media" height={625} src={src} width={1000} />
          ) : (
            <iframe
              allowFullScreen
              className="map__media"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin"
              src={src}
              title={labels.title}
            />
          )
        ) : (
          <>
            <DecorativeMark className="top-2 start-2" variant="corner" />
            <button className="btn btn--quiet map__show" onClick={() => setShown(true)} type="button">
              {labels.show}
            </button>
          </>
        )}
      </div>
      <figcaption className="mt-3">
        <a className="link-inline type-ui target-standalone" href={href} rel="noreferrer" target="_blank">
          {labels.open}
        </a>
      </figcaption>
    </figure>
  )
}
