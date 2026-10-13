import type { Locale } from '@/lib/cms/types'
import { HoldingState, UnreachableState } from '@/components/states/States'

import type { PageContextOutcome } from '@/lib/cms/pageContext'

/** Renders the non-content outcomes of `loadPageContext` consistently. */
export const StateView = ({
  locale,
  outcome,
}: {
  locale: Locale
  outcome: Extract<PageContextOutcome, { ok: false }>
}) =>
  outcome.state === 'holding' ? (
    <HoldingState locale={locale} name={outcome.name} />
  ) : (
    <UnreachableState locale={locale} />
  )
