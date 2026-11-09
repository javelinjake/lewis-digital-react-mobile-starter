import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

export interface TabBarItem {
  to: string
  label: string
}

/**
 * A screen with a fixed height: the header and footer (the tab bar) stay put and only `ScreenContent` scrolls. With
 * a minimum height instead, a long screen grew the page and pushed the tab bar off the bottom.
 *
 * `column`: on a tablet or desktop browser the screen stays a phone-width column in the middle (header, content and
 * tab bar together) instead of stretching edge to edge. For apps designed portrait-first, such as games.
 */
export function MobileShell({ children, footer, column = false }: { children: ReactNode, footer?: ReactNode, column?: boolean }) {
  if (!column) {
    return (
      <div className="flex h-dvh flex-col bg-base-200">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer}
      </div>
    )
  }
  return (
    <div className="h-dvh bg-base-300">
      <div className="mx-auto flex h-full w-full max-w-xl flex-col bg-base-200 sm:border-x sm:border-base-content/10">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer}
      </div>
    </div>
  )
}

export function SafeAreaView({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div
      className={className}
      style={{
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
      }}
    >
      {children}
    </div>
  )
}

export function ScreenContent({ children }: { children: ReactNode }) {
  return <main className="flex-1 overflow-y-auto px-4 py-4">{children}</main>
}

export function AppBar({ title, onBack, end }: { title: string, onBack?: () => void, end?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-2 border-b border-base-300 bg-base-100 px-2"
      style={{ paddingTop: 'var(--safe-top)', minHeight: 'calc(3.25rem + var(--safe-top))' }}
    >
      {onBack
        ? <button type="button" className="btn btn-ghost btn-circle min-h-11 min-w-11" onClick={onBack} aria-label="Back">←</button>
        : <span className="w-11" />}
      <h1 className="flex-1 truncate text-lg">{title}</h1>
      {end}
    </header>
  )
}

export function BottomTabBar({ items }: { items: TabBarItem[] }) {
  return (
    <nav
      aria-label="Primary"
      className="grid border-t border-base-300 bg-base-100"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, paddingBottom: 'var(--safe-bottom)' }}
    >
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          // The active tab is marked by a bar in the theme's primary colour, not by coloured text: a brand colour on
          // the page background often fails contrast, and the bar carries no text-contrast requirement.
          className={({ isActive }) => `flex min-h-11 items-center justify-center border-t-2 text-sm ${isActive ? 'border-primary font-semibold' : 'border-transparent opacity-70'}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function StackTransition({ children }: { children: ReactNode }) {
  return <div className="ld-fade-in flex min-h-0 flex-1 flex-col">{children}</div>
}
