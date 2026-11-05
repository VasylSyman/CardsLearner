import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useHashRoute } from '@/hooks/useHashRoute'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SyncIndicatorProps {
  compact?: boolean
}

export function SyncIndicator({ compact = false }: SyncIndicatorProps) {
  const { navigate } = useHashRoute()
  const { configured, phase, pending } = useSyncStatus()

  let icon: ReactNode = <Cloud className="size-4" />
  let label = 'Synced'
  let tone: string | undefined = 'text-muted-foreground'
  if (phase === 'syncing' || phase === 'loading') {
    icon = <RefreshCw className="size-4 animate-spin" />
    label = 'Syncing…'
  } else if (phase === 'offline') {
    icon = <CloudOff className="size-4" />
    label = pending > 0 ? `Offline · ${pending} pending` : 'Offline'
  } else if (phase === 'error') {
    icon = <CloudAlert className="size-4" />
    label = 'Sync error'
    tone = 'text-destructive'
  }

  if (!configured || phase === 'local') return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          onClick={() => navigate({ name: 'settings' })}
          aria-label={label}
          className={cn('justify-start', tone)}
        >
          {icon}
          {!compact && <span className="text-xs">{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
