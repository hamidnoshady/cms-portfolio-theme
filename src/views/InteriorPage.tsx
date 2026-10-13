import type { ReactNode } from 'react'

import { Breadcrumbs } from '@/components/design/Breadcrumbs'
import { ContentContainer } from '@/components/design/Container'
import { InteriorShell } from '@/components/layout/InteriorShell'
import type { SiteContext } from '@/lib/cms/context'
import type { Crumb } from '@/lib/routing/breadcrumbs'
import { getChrome } from '@/lib/theme/chrome'
import type { TranslatedDoc } from '@/lib/seo/translations'

/**
 * Interior page wrapper: chrome + breadcrumbs + content. Every interior view uses it,
 * so the full-width navbar / 1440px content relationship is identical everywhere.
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
  crumbs: Crumb[]
  currentPath: string
  label: string
  switchDoc?: TranslatedDoc
  /** Locale-neutral query carried by the language switch (`/search?q=…`). */
  switchQuery?: string
}) => {
  const chrome = await getChrome(context, currentPath, switchDoc, switchQuery)

  return (
    <InteriorShell
      context={context}
      footerLinks={chrome.footerLinks}
      headerLinks={chrome.headerLinks}
      logo={chrome.logo}
      switchTargets={chrome.switchTargets}
    >
      <ContentContainer>
        <Breadcrumbs crumbs={crumbs} label={label} />
      </ContentContainer>
      {children}
    </InteriorShell>
  )
}
