import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { repo } from '@/db'
import type { Card, CardState } from '@/db'
import { exportCsv, exportJson } from '@/lib/importExport'
import { DAY_MS, formatInterval } from '@/lib/scheduler'
import { cn, formatDate, formatRelativeDue } from '@/lib/utils'
import { useAllTags, useCards, useDecks } from '@/hooks/useData'
import type { Route } from '@/hooks/useHashRoute'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CardFormDialog } from '@/components/CardFormDialog'
import { EditableCell } from './EditableCell'

interface BrowserPageProps {
  deckId?: string
  navigate: (r: Route) => void
}

type SortKey = 'front' | 'due' | 'interval' | 'ease' | 'reps'
type SortDir = 'asc' | 'desc'

const STATES: CardState[] = ['new', 'learning', 'review', 'relearning']
const RENDER_LIMIT = 500

const STATE_COLORS: Record<CardState, string> = {
  new: 'text-easy',
  learning: 'text-again',
  review: 'text-good',
  relearning: 'text-again',
}

const NUMERIC_SORTS: Record<Exclude<SortKey, 'front'>, (c: Card) => number> = {
  due: (c) => c.due,
  interval: (c) => c.interval,
  ease: (c) => c.easeFactor,
  reps: (c) => c.reps,
}

function dueLabel(card: Card, now: number): string {
  if (card.state === 'new') return 'new'
  if (card.due <= now + 30 * DAY_MS) return formatRelativeDue(card.due)
  return formatDate(card.due)
}

export function BrowserPage({ deckId, navigate }: BrowserPageProps) {
  const decks = useDecks()
  const cards = useCards(deckId)
  const allTags = useAllTags()

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<CardState | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editCard, setEditCard] = useState<Card | undefined>(undefined)
  const [addOpen, setAddOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDeckId, setMoveDeckId] = useState<string>('')

  const filtered = useMemo(() => {
    if (cards === undefined) return undefined
    const q = search.trim().toLowerCase()
    let list = cards
    if (tagFilter !== 'all') list = list.filter((c) => c.tags.includes(tagFilter))
    if (stateFilter !== 'all') list = list.filter((c) => c.state === stateFilter)
    if (q) {
      list = list.filter(
        (c) =>
          c.front.toLowerCase().includes(q) ||
          (c.context ?? '').toLowerCase().includes(q) ||
          c.translationEn.toLowerCase().includes(q) ||
          c.translationUk.toLowerCase().includes(q) ||
          (c.notes ?? '').toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    const sorted = [...list]
    if (sortKey) {
      sorted.sort((a, b) => {
        const cmp =
          sortKey === 'front' ? a.front.localeCompare(b.front) : NUMERIC_SORTS[sortKey](a) - NUMERIC_SORTS[sortKey](b)
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt)
    }
    return sorted
  }, [cards, search, tagFilter, stateFilter, sortKey, sortDir])

  const visible = filtered === undefined ? undefined : filtered.slice(0, RENDER_LIMIT)
  // Timestamp for due labels; refreshed on an interval so relative labels stay truthful.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = visible !== undefined && visible.length > 0 && visible.every((c) => selected.has(c.id))
  const someVisibleSelected = visible !== undefined && visible.some((c) => selected.has(c.id))
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  const toggleAllVisible = () => {
    if (visible === undefined) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((c) => next.delete(c.id))
      else visible.forEach((c) => next.add(c.id))
      return next
    })
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const clearSelection = () => setSelected(new Set())

  const resetSelectedProgress = async () => {
    const ids = [...selected]
    if (!window.confirm(`Reset progress for ${ids.length} selected card${ids.length === 1 ? '' : 's'}?`)) return
    await repo.resetCardProgress(ids)
    clearSelection()
  }

  const deleteSelected = async () => {
    const ids = [...selected]
    if (!window.confirm(`Delete ${ids.length} selected card${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    await repo.deleteCards(ids)
    clearSelection()
  }

  const moveSelected = async () => {
    if (!moveDeckId || selected.size === 0) return
    const ids = [...selected]
    await Promise.all(ids.map((id) => repo.updateCard(id, { deckId: moveDeckId })))
    clearSelection()
    setMoveOpen(false)
  }

  const openMoveDialog = () => {
    setMoveDeckId(deckId ?? decks?.[0]?.id ?? '')
    setMoveOpen(true)
  }

  if (cards === undefined || decks === undefined || allTags === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>
  }

  const noCards = cards.length === 0
  const showCapNote = (filtered?.length ?? 0) > RENDER_LIMIT

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
          {visible && (
            <p className="text-sm text-muted-foreground">
              {visible.length} of {cards.length} cards
            </p>
          )}
        </div>
      </header>

      {noCards ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-16 text-center">
          <div>
            <h2 className="text-lg font-semibold">No cards yet</h2>
            <p className="text-sm text-muted-foreground">Add your first card to start building your deck.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> Add card
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1 sm:min-w-56">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards..."
                className="pl-8"
              />
            </div>
            <Select value={deckId ?? 'all'} onValueChange={(v) => navigate(v === 'all' ? { name: 'browse' } : { name: 'browse', deckId: v })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Deck" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decks</SelectItem>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as CardState | 'all')}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {STATES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Add card
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Export options">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => void exportCsv(deckId)}>
                  Export CSV ({deckId ? 'filtered deck' : 'all decks'})
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportJson()}>Export JSON backup</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {showCapNote && (
            <p className="text-xs text-muted-foreground">Showing first {RENDER_LIMIT} — refine your search</p>
          )}

          {selected.size > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <span className="text-sm font-medium">
                {selected.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => void resetSelectedProgress()}>
                Reset progress
              </Button>
              <Button variant="outline" size="sm" onClick={openMoveDialog}>
                Move to deck…
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void deleteSelected()}>
                <Trash2 /> Delete
              </Button>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          )}

          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      role="checkbox"
                      aria-label="Select all visible"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="size-4 accent-primary"
                    />
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('front')}>
                      Front <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead>English</TableHead>
                  <TableHead>Ukrainian</TableHead>
                  <TableHead>POS</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('due')}>
                      Due <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('interval')}>
                      Interval <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('ease')}>
                      Ease <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('reps')}>
                      Reps <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible?.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        role="checkbox"
                        checked={selected.has(card.id)}
                        onChange={() => toggleSelect(card.id)}
                        className="size-4 accent-primary"
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <EditableCell cardId={card.id} field="front" value={card.front} lang="es" className="font-semibold" />
                      {card.context && <p className="truncate text-xs text-muted-foreground">{card.context}</p>}
                    </TableCell>
                    <TableCell className="max-w-44">
                      <EditableCell cardId={card.id} field="translationEn" value={card.translationEn} />
                    </TableCell>
                    <TableCell className="max-w-44">
                      <EditableCell cardId={card.id} field="translationUk" value={card.translationUk} lang="uk" />
                    </TableCell>
                    <TableCell>
                      {card.partOfSpeech ? (
                        <Badge variant="secondary" className="capitalize">
                          {card.partOfSpeech}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-36">
                      <div className="flex flex-wrap gap-1">
                        {card.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        {card.tags.length > 3 && <span className="text-xs text-muted-foreground">+{card.tags.length - 3}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('font-medium capitalize', STATE_COLORS[card.state])}>{card.state}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{dueLabel(card, now)}</TableCell>
                    <TableCell className="whitespace-nowrap">{card.interval > 0 ? formatInterval(card.interval * DAY_MS) : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{card.easeFactor.toFixed(2)}</TableCell>
                    <TableCell>{card.reps}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Edit card" onClick={() => setEditCard(card)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {visible?.map((card) => (
              <li key={card.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    role="checkbox"
                    checked={selected.has(card.id)}
                    onChange={() => toggleSelect(card.id)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setEditCard(card)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                  >
                    <span className="font-semibold" lang="es">
                      {card.front}
                    </span>
                    <span className="text-sm text-muted-foreground">{card.translationEn}</span>
                    <span lang="uk" className="text-sm text-muted-foreground">
                      {card.translationUk}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className={cn('text-xs font-medium capitalize', STATE_COLORS[card.state])}>{card.state}</span>
                      {card.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <CardFormDialog open={addOpen} onOpenChange={setAddOpen} decks={decks} defaultDeckId={deckId} />
      <CardFormDialog
        open={editCard !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditCard(undefined)
        }}
        decks={decks}
        defaultDeckId={deckId}
        card={editCard}
      />

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to deck</DialogTitle>
            <DialogDescription>
              Move {selected.size} selected card{selected.size === 1 ? '' : 's'} to another deck.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Deck</Label>
            <Select value={moveDeckId} onValueChange={setMoveDeckId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose deck" />
              </SelectTrigger>
              <SelectContent>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!moveDeckId} onClick={() => void moveSelected()}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
