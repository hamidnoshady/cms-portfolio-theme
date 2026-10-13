import { cn } from '@/lib/utils/cn'

/**
 * Structural rules. `<Rule />` is the default hairline; emphasis is a 1px solid black
 * line reserved for active/interactive meaning and is *never* the only signal (the
 * current nav item also carries `aria-current`).
 */
export const Rule = ({
  className,
  tone = 'structural',
  vertical = false,
}: {
  className?: string
  tone?: 'decor' | 'emphasis' | 'structural'
  vertical?: boolean
}) => (
  <span
    aria-hidden="true"
    className={cn(
      vertical ? 'rule-v' : 'rule-h',
      tone === 'decor' && (vertical ? 'rule-v--decor' : 'rule-h--decor'),
      tone === 'emphasis' && !vertical && 'rule-h--emphasis',
      tone === 'emphasis' && vertical && 'rule-v--emphasis',
      className,
    )}
  />
)
