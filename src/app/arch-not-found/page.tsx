import { headers } from 'next/headers'
import { ContentContainer } from '@/components/design/Container'
import { Rule } from '@/components/design/Rule'
import { NotFoundBody } from '@/components/states/States'
import { href } from '@/lib/routing/locale'
import { THEME_ROUTES } from '@/lib/routing/paths'
import { getSiteOrNull } from '@/lib/cms/endpoints'
import { labels as dictionary } from '@/lib/theme/labels'
import type { Locale } from '@/lib/cms/types'

/** Proxy-rewritten 404 target (see `src/proxy.ts`): same designed page as `not-found.tsx`. */
export default async function ArchNotFound() {
  const headerList = await headers()
  const locale: Locale = headerList.get('x-arch-locale') === 'en' ? 'en' : 'fa'
  await getSiteOrNull()
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
