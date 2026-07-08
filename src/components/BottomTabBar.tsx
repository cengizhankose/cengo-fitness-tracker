import { NavLink } from 'react-router-dom'
import { Flame, CalendarDays, TrendingUp, ClipboardList } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: Tab[] = [
  { to: '/', label: 'Today', icon: Flame },
  { to: '/weekly', label: 'Plan', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/log', label: 'Log', icon: ClipboardList },
]

export function BottomTabBar() {
  return (
    <nav className="pb-safe z-30 border-t border-border bg-surface-1/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className="group relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
                      isActive ? 'bg-volt opacity-100' : 'opacity-0'
                    }`}
                  />
                  <tab.icon
                    size={22}
                    className={isActive ? 'text-volt' : 'text-text-faint'}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  <span
                    className={`text-[11px] font-semibold ${
                      isActive ? 'text-volt' : 'text-text-faint'
                    }`}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
