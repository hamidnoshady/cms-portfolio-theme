import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { CustomCursor } from '@/components/home/CustomCursor'
import { DocumentLocale } from '@/components/layout/DocumentLocale'
import { SmoothScroll } from '@/components/motion/SmoothScroll'
import { getSiteOrNull } from '@/lib/cms/endpoints'
import { documentLocaleConfig } from '@/lib/routing/documentLocale'
import { dirFor, themeCss } from '@/lib/runtime'
import { brandName } from '@/lib/theme/brand'
import { fontFaceCss, fontReport } from '@/lib/theme/fonts'
import { labels } from '@/lib/theme/labels'

import './globals.css'

export const viewport: Viewport = {
  colorScheme: 'light',
  initialScale: 1,
  themeColor: '#ffffff',
  viewportFit: 'cover',
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
    title: site ? brandName(site) : labels(locale).unreachableTitle,
  }
}

export default async function RootLayout({
  children,
  overlay,
}: {
  children: ReactNode
  overlay: ReactNode
}) {
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
        {site?.theme ? <style dangerouslySetInnerHTML={{ __html: themeCss(site.theme) }} id="eshobe-theme-vars" /> : null}
      </head>
      <body className="flex min-h-svh flex-col bg-surface-page text-ink-primary antialiased">
        <DocumentLocale config={documentLocaleConfig()} />
        <SmoothScroll />
        {children}
        {overlay}
        <CustomCursor />
      </body>
    </html>
  )
}
