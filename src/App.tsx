import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/AppShell'
import { useHashRoute } from '@/hooks/useHashRoute'
import { isCloudConfigured } from '@/db'
import { startSync } from '@/db/syncEngine'
import { seedIfEmpty } from '@/lib/seed'
import { DecksPage } from '@/features/decks/DecksPage'
import { StudyPage } from '@/features/study/StudyPage'
import { BrowserPage } from '@/features/browser/BrowserPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  const { route, navigate } = useHashRoute()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pulled = await startSync().catch(() => false)
      if (!isCloudConfigured || pulled) await seedIfEmpty().catch(console.error)
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {isCloudConfigured ? 'Syncing with cloud...' : 'Loading...'}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AppShell route={route} navigate={navigate}>
        {route.name === 'decks' && <DecksPage navigate={navigate} />}
        {route.name === 'study' && <StudyPage deckId={route.deckId} navigate={navigate} />}
        {route.name === 'browse' && <BrowserPage deckId={route.deckId} navigate={navigate} />}
        {route.name === 'settings' && <SettingsPage />}
      </AppShell>
    </TooltipProvider>
  )
}
