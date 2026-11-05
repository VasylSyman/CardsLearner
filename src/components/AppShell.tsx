import type { ReactNode } from 'react'
import { Layers, GraduationCap, Table2, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SyncIndicator } from '@/components/SyncIndicator'
import { useTheme } from '@/hooks/useTheme'
import type { Route } from '@/hooks/useHashRoute'
import { cn } from '@/lib/utils'

interface AppShellProps {
  route: Route
  navigate: (r: Route) => void
  children: ReactNode
}

const NAV: { name: Route['name']; label: string; icon: typeof Layers; to: Route }[] = [
  { name: 'decks', label: 'Decks', icon: Layers, to: { name: 'decks' } },
  { name: 'browse', label: 'Browse', icon: Table2, to: { name: 'browse' } },
  { name: 'settings', label: 'Settings', icon: Settings, to: { name: 'settings' } },
]

export function AppShell({ route, navigate, children }: AppShellProps) {
  const { resolved, toggle } = useTheme()
  const isStudy = route.name === 'study'

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <button
          onClick={() => navigate({ name: 'decks' })}
          className="mb-6 flex items-center gap-2 px-2 text-left"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Lingo Cards</span>
        </button>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = route.name === item.name || (item.name === 'decks' && isStudy)
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.to)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <SyncIndicator />
        <Button variant="ghost" size="sm" onClick={toggle} className="justify-start gap-3 text-muted-foreground">
          {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </aside>

      <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <button onClick={() => navigate({ name: 'decks' })} className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          <span className="font-semibold">Lingo Cards</span>
        </button>
        <div className="flex items-center gap-1">
          <SyncIndicator compact />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </header>

      <main className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', !isStudy && 'pb-20 md:pb-0')}>
        {children}
      </main>

      {!isStudy && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-card/95 backdrop-blur md:hidden">
          {NAV.map((item) => {
            const active = route.name === item.name
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.to)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-xs font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
