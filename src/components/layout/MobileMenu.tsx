'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { NavLink } from '@/lib/routing/nav'

/**
 * Mobile drawer: two rules that become a sharp X, a white panel entering from the
 * inline-start edge (right in Persian, left in English via `dir`), hairline rows that
 * settle with a short stagger, and the language switch pinned near the bottom.
 *
 * Radix Dialog owns the focus trap, Escape, focus restoration and scroll lock; the
 * close-on-navigation effect below covers the one thing it cannot know about (the
 * route changed underneath the panel). Reduced motion keeps every state operable —
 * the entry transition is a CSS transform that the global reduced-motion rule
 * shortens to ~0, not a JS gate.
 */
export const MobileMenu = ({
  children,
  dir,
  labels,
  links,
}: {
  children: ReactNode
  dir: 'ltr' | 'rtl'
  labels: { close: string; menu: string; menuTitle: string }
  links: NavLink[]
}) => {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // A route change is an external event, not derived state: the drawer must be gone
    // before the next page paints. This is the pattern Next.js documents for "close a
    // menu on navigation"; the focus/scroll consequences are Radix's to unwind.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-way sync with a navigation event
    setOpen(false)
  }, [pathname])

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <button aria-label={open ? labels.close : labels.menu} className="btn btn--bare btn--square md:hidden" type="button">
          <span aria-hidden="true" className="menu-icon" data-open={open}>
            <span />
            <span />
          </span>
        </button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} dir={dir}>
        <div className="flex items-center justify-between">
          <SheetTitle className="type-label uppercase">{labels.menuTitle}</SheetTitle>
          <button
            aria-label={labels.close}
            className="btn btn--bare btn--square"
            onClick={() => setOpen(false)}
            type="button"
          >
            <span aria-hidden="true" className="menu-icon" data-open="true">
              <span />
              <span />
            </span>
          </button>
        </div>
        <nav className="mt-6 flex flex-1 flex-col" aria-label={labels.menuTitle}>
          {links.length === 0 ? null : (
            <ul>
              {links.map((link, index) => (
                <li
                  className="relative"
                  key={link.href}
                  // Drives the CSS row stagger (`.drawer__row` delay).
                  style={{ '--drawer-row': index } as CSSProperties}
                >
                  <span aria-hidden="true" className="mark top-1/2 -translate-y-1/2" style={{ insetInlineStart: 0 }}>
                    <svg height="10" viewBox="0 0 10 1" width="10">
                      <path d="M0 0.5H10" stroke="currentColor" />
                    </svg>
                  </span>
                  <a
                    aria-current={link.current ? 'page' : undefined}
                    className="drawer__row ps-5"
                    href={link.href}
                    rel={link.external ? 'noreferrer' : undefined}
                    target={link.newTab ? '_blank' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <div className="mt-8 border-t border-line-structural pt-5">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
