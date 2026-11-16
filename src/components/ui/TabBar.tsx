import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Dumbbell, History, House, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  /** Non-tab routes that belong to this tab (reached from its screen). */
  owns?: readonly string[]
}

const TABS: readonly Tab[] = [
  { to: '/', label: 'Bugün', icon: House, owns: ['/settings'] },
  { to: '/plan', label: 'Plan', icon: CalendarDays, owns: ['/nutrition'] },
  { to: '/exercises', label: 'Hareketler', icon: Dumbbell },
  { to: '/history', label: 'Geçmiş', icon: History },
  { to: '/progress', label: 'İlerleme', icon: TrendingUp },
]

function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.owns?.some((p) => within(pathname, p))) return true
  return tab.to === '/' ? pathname === '/' : within(pathname, tab.to)
}

/** Bottom navigation: five labelled tabs, active by route prefix (incl. nested routes). */
export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Ana menü" className="pb-safe z-30 border-t border-border bg-card/95 backdrop-blur-md">
      <ul className="mx-auto flex h-tabbar max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab, pathname)
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-full flex-col items-center justify-center gap-0.5',
                  active ? 'text-volt' : 'text-text-faint active:text-text',
                )}
              >
                <span
                  aria-hidden
                  className={cx('absolute top-0 h-0.5 w-8 rounded-full bg-volt', !active && 'opacity-0')}
                />
                <tab.icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span className="text-[0.6875rem] leading-none font-semibold">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
