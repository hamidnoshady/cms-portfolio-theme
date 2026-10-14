import type { ReactNode } from 'react'

import { Breadcrumbs } from '@/components/design/Breadcrumbs'
import { ContentContainer } from '@/components/design/Container'
import { InteriorShell } from '@/components/layout/InteriorShell'
import type { SiteContext } from '@/lib/cms/context'
import type { Crumb } from '@/lib/routing/breadcrumbs'
import type { TranslatedDoc } from '@/lib/seo/translations'
import { getChrome } from '@/lib/theme/chrome'

/**
 * Interior page wrapper: shared corner chrome + optional breadcrumbs + content.
 */
export const InteriorPage = async ({
  children,
  context,
  crumbs,
  currentPath,
  label,
  switchDoc,
  switchQuery,
}: {
  children: ReactNode
  context: SiteContext
  crumbs?: Crumb[]
  currentPath: string
  label?: string
  switchDoc?: TranslatedDoc
  /** Locale-neutral query carried by the language switch (`/search?q=…` or `?page=…`). */
  switchQuery?: string
}) => {
  const chrome = await getChrome(context, currentPath, switchDoc, switchQuery)

  return (
    <InteriorShell
      context={context}
      headerLinks={chrome.headerLinks}
      logo={chrome.logo}
      switchTargets={chrome.switchTargets}
    >
      {crumbs && crumbs.length > 0 && label ? (
        <ContentContainer>
          <Breadcrumbs crumbs={crumbs} label={label} />
        </ContentContainer>
      ) : null}
      {children}
    </InteriorShell>
  )
}
