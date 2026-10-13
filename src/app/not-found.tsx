import { getSiteOrNull } from '@/lib/cms/endpoints'
import type { Metadata } from 'next'

import { ContentContainer } from '@/components/design/Container'
import { Rule } from '@/components/design/Rule'
import { NotFoundBody } from '@/components/states/States'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale } from '@/lib/cms/types'
import { headers } from 'next/headers'
import { brandName } from '@/lib/theme/brand'

/**
 * 404 inside the root layout. Reached when a document disappears between the proxy's
 * existence check and the render, and for `notFound()` calls that happen after the
 * shell has already streamed (see `docs/LIMITATIONS.md`).
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const headerList = await headers()
  const locale: Locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const site = await getSiteOrNull()
  const title = dictionary(locale).notFoundTitle
  return {
    robots: { follow: false, index: false },
    title: site ? `${title} — ${brandName(site)}` : title,
  }
}

export default async function NotFound() {
  const headerList = await headers()
  const locale: Locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  const t = dictionary(locale)

  return (
    <main className="flex min-h-svh flex-1 flex-col justify-center" id="content">
      <ContentContainer className="py-24">
        <Rule className="mb-10 max-w-[10rem]" tone="decor" />
        <h1 className="type-title max-w-[24ch]">{t.notFoundTitle}</h1>
        <p className="type-body mt-4 max-w-[46ch] text-ink-secondary">{t.notFoundBody}</p>
        <NotFoundBody>
          <a className="link-inline type-ui target-standalone" href={href(THEME_ROUTES.home, locale, { defaultLocale: 'fa' })}>
            {t.home}
          </a>
        </NotFoundBody>
      </ContentContainer>
    </main>
  )
}
