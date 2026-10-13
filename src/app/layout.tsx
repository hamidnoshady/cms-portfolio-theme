import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'

import { DocumentLocale } from '@/components/layout/DocumentLocale'
import { SmoothScroll } from '@/components/motion/SmoothScroll'
import { getSiteOrNull } from '@/lib/cms/endpoints'
import { labels } from '@/lib/theme/labels'
import { fontFaceCss, fontReport } from '@/lib/theme/fonts'
import { themeCss } from '@/lib/runtime'
import { dirFor } from '@/lib/runtime'
import { documentLocaleConfig } from '@/lib/routing/documentLocale'

import './globals.css'
import { brandName } from '@/lib/theme/brand'

/**
 * Root document.
 *
 * `lang`/`dir` come from the proxy header, never from a hardcoded default, so the
 * Persian tree is genuinely RTL and the English tree genuinely LTR from the first
 * byte. Client navigations do not re-render this layout, so `<DocumentLocale>` keeps
 * the attributes in step with the URL afterwards (FA ⇄ EN without a reload). Per-site design tokens (`themeCss(site.theme)`) and the font faces are emitted
 * here, after the design system, so a tenant's brand colour can only override the raw
 * variables — never the line system, spacing or type scale.
 */

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
}

export const generateMetadata = async (): Promise<Metadata> => {
  const headerList = await headers()
  const locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const site = await getSiteOrNull()
  const origin = process.env.ESHOBE_PUBLIC_ORIGIN ?? undefined
  const favicon = site?.branding?.favicon?.url ?? null
  return {
    metadataBase: origin ? new URL(origin) : undefined,
    description: site?.branding?.tagline ?? undefined,
    icons: favicon ? { icon: favicon } : undefined,
    // A document without any `<title>` is a defect: an unreachable descriptor is the
    // only case where no customer name is known, and it always renders the same
    // "not connected" state, so that state's own wording is the honest fallback.
    title: site ? brandName(site) : labels(locale).unreachableTitle,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const site = await getSiteOrNull()
  const fonts = fontReport()
  if (process.env.NODE_ENV !== 'production' && fonts.shazdeMissing.length > 0) {
    console.warn(
      `[theme] Shazde not installed (${fonts.shazdeMissing.length}/9 weights) — Persian renders on ${fonts.persianFamily}.`,
    )
  }

  return (
    <html dir={dirFor(locale)} lang={locale} suppressHydrationWarning>
      <head>
        {fonts.preload.map((href) => (
          <link as="font" crossOrigin="anonymous" href={href} key={href} rel="preload" type="font/woff2" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() }} />
        {site?.theme ? <style dangerouslySetInnerHTML={{ __html: themeCss(site.theme) }} /> : null}
      </head>
      <body>
        <DocumentLocale config={documentLocaleConfig()} />
        <SmoothScroll />
        {children}
      </body>
    </html>
  )
}
