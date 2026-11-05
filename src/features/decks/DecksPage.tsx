import { useMemo, useState } from 'react'
import { Layers, MoreHorizontal, Pencil, Plus, Table2, Trash2 } from 'lucide-react'
import { repo } from '@/db'
import type { Deck } from '@/db'
import { useAllDueCounts, useCards, useDecks } from '@/hooks/useData'
import type { Route } from '@/hooks/useHashRoute'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CardFormDialog } from '@/components/CardFormDialog'
import { DeckDialog } from '@/features/decks/DeckDialog'

interface DecksPageProps {
  navigate: (r: Route) => void
}

interface DeckDialogState {
  open: boolean
  deck?: Deck
}

const EMPTY_COUNTS = { newCount: 0, learnCount: 0, dueCount: 0 }

export function DecksPage({ navigate }: DecksPageProps) {
  const decks = useDecks()
  const dueCounts = useAllDueCounts()
  const cards = useCards()
  const [deckDialog, setDeckDialog] = useState<DeckDialogState>({ open: false })
  const [cardDialogOpen, setCardDialogOpen] = useState(false)

  const countByDeck = useMemo(() => {
    const map = new Map<string, number>()
    cards?.forEach((c) => map.set(c.deckId, (map.get(c.deckId) ?? 0) + 1))
    return map
  }, [cards])

  const totalDue = useMemo(
    () =>
      decks?.reduce((sum, d) => {
        const c = dueCounts?.[d.id]
        return sum + (c ? c.newCount + c.learnCount + c.dueCount : 0)
      }, 0) ?? 0,
    [decks, dueCounts],
  )

  if (decks === undefined || dueCounts === undefined || cards === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>
  }

  const deleteDeck = async (d: Deck) => {
    if (!window.confirm(`Delete deck "${d.name}" and all its cards? This cannot be undone.`)) return
    await repo.deleteDeck(d.id)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Decks</h1>
          <p className="text-sm text-muted-foreground">
            {totalDue} card{totalDue === 1 ? '' : 's'} due today
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDeckDialog({ open: true })}>
            <Plus /> New deck
          </Button>
          <Button variant="outline" onClick={() => setCardDialogOpen(true)}>
            <Plus /> Add card
          </Button>
        </div>
      </header>

      {decks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-16 text-center">
          <Layers className="size-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">No decks yet</h2>
            <p className="text-sm text-muted-foreground">Create your first deck to start reviewing cards.</p>
          </div>
          <Button onClick={() => setDeckDialog({ open: true })}>
            <Plus /> New deck
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => {
            const c = dueCounts[d.id] ?? EMPTY_COUNTS
            const done = c.newCount === 0 && c.learnCount === 0 && c.dueCount === 0
            const cardCount = countByDeck.get(d.id) ?? 0
            return (
              <Card key={d.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{d.name}</CardTitle>
                      {d.description && (
                        <CardDescription className="mt-1 line-clamp-2">{d.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-8" aria-label="Deck actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => navigate({ name: 'browse', deckId: d.id })}>
                          <Table2 /> Browse cards
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDeckDialog({ open: true, deck: d })}>
                          <Pencil /> Rename / edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => void deleteDeck(d)}
                        >
                          <Trash2 /> Delete deck
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-sm">
                  <span className="font-medium text-easy">New {c.newCount}</span>
                  <span className="font-medium text-again">Learn {c.learnCount}</span>
                  <span className="font-medium text-good">Due {c.dueCount}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {cardCount} card{cardCount === 1 ? '' : 's'}
                  </span>
                </CardContent>
                <CardFooter className="mt-auto pt-2">
                  <Button
                    className="w-full"
                    disabled={done}
                    onClick={() => navigate({ name: 'study', deckId: d.id })}
                  >
                    {done ? 'Done for today' : 'Study'}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <DeckDialog
        open={deckDialog.open}
        onOpenChange={(open) => setDeckDialog((s) => ({ ...s, open }))}
        deck={deckDialog.deck}
      />
      <CardFormDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} decks={decks} />
    </div>
  )
}
