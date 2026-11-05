import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Pencil, Volume2 } from 'lucide-react'
import { repo, RATING_LABELS } from '@/db'
import type { Card, DueCounts, Rating } from '@/db'
import { previewIntervals } from '@/lib/scheduler'
import { useDecks, useDeck, useSettings } from '@/hooks/useData'
import type { Route } from '@/hooks/useHashRoute'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSpeech } from '@/hooks/useSpeech'
import { useSwipe } from '@/hooks/useSwipe'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { CardFormDialog } from '@/components/CardFormDialog'
import { cn } from '@/lib/utils'

interface StudyPageProps {
  deckId: string
  navigate: (r: Route) => void
}

const RATING_ORDER: Rating[] = [1, 2, 3, 4]

const RATING_BUTTON_STYLES: Record<Rating, string> = {
  1: 'border-again/25 bg-again/10 text-again hover:bg-again/20 focus-visible:ring-again/40 dark:bg-again/15 dark:hover:bg-again/25',
  2: 'border-hard/25 bg-hard/10 text-hard hover:bg-hard/20 focus-visible:ring-hard/40 dark:bg-hard/15 dark:hover:bg-hard/25',
  3: 'border-good/25 bg-good/10 text-good hover:bg-good/20 focus-visible:ring-good/40 dark:bg-good/15 dark:hover:bg-good/25',
  4: 'border-easy/25 bg-easy/10 text-easy hover:bg-easy/20 focus-visible:ring-easy/40 dark:bg-easy/15 dark:hover:bg-easy/25',
}

const CARD_FRAME =
  'relative flex w-full max-w-lg touch-pan-y select-none flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-card text-center shadow-md shadow-neutral-900/5 transition-shadow duration-200 dark:border-neutral-800 dark:shadow-black/30 min-h-[360px] sm:min-h-[440px]'

const REINSERT_WINDOW_MS = 20 * 60 * 1000

export function StudyPage({ deckId, navigate }: StudyPageProps) {
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [counts, setCounts] = useState<DueCounts>({ newCount: 0, learnCount: 0, dueCount: 0 })
  const [sessionReviewed, setSessionReviewed] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const busy = useRef(false)
  const loadSeq = useRef(0)

  const deck = useDeck(deckId)
  const settings = useSettings()
  const decks = useDecks()
  const { supported, speaking, speak } = useSpeech()

  const card = queue?.[index]
  const intervals = card ? previewIntervals(card) : null

  const loadQueue = useCallback(() => {
    const seq = ++loadSeq.current
    setQueue(null)
    setIndex(0)
    setRevealed(false)
    setSessionReviewed(0)
    repo
      .getStudyQueue(deckId)
      .then((q) => {
        if (loadSeq.current !== seq) return
        setQueue(q.cards)
        setCounts(q.counts)
      })
      .catch(() => {
        if (loadSeq.current === seq) setQueue([])
      })
  }, [deckId])

  useEffect(() => {
    loadQueue()
    void repo.updateSettings({ lastDeckId: deckId })
  }, [deckId, loadQueue])

  // Auto-play the audio for a newly shown card.
  useEffect(() => {
    if (card && settings?.autoPlayAudio && settings.ttsEnabled) {
      speak(card.front, { voiceUri: settings.ttsVoiceUri, rate: settings.ttsRate })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id])

  const rate = useCallback(
    (rating: Rating) => {
      if (!card || !revealed || busy.current) return
      busy.current = true
      setCounts((c) => {
        const bucket = card.state === 'new' ? 'newCount' : card.state === 'review' ? 'dueCount' : 'learnCount'
        return { ...c, [bucket]: Math.max(0, c[bucket] - 1) }
      })
      repo
        .reviewCard(card.id, rating)
        .then((updated) => {
          setQueue((q) => {
            if (!q) return q
            const next = [...q]
            const soon = updated.due - Date.now() < REINSERT_WINDOW_MS
            if ((updated.state === 'learning' || updated.state === 'relearning') && soon) {
              const target = Math.min(index + 1 + 3, next.length)
              next.splice(target, 0, updated)
              setCounts((c) => ({ ...c, learnCount: c.learnCount + 1 }))
            }
            return next
          })
          setIndex((i) => i + 1)
          setRevealed(false)
          setSessionReviewed((n) => n + 1)
          busy.current = false
        })
        .catch(() => {
          busy.current = false
        })
    },
    [card, revealed, index],
  )

  const revealCard = useCallback(() => {
    if (!revealed) setRevealed(true)
  }, [revealed])

  const { handlers, offset, dragging } = useSwipe({
    enabled: revealed,
    onSwipeLeft: () => rate(1),
    onSwipeRight: () => rate(3),
    onTap: revealCard,
  })

  const replaceCard = useCallback((saved?: Card) => {
    if (!saved) return
    setQueue((q) => (q ? q.map((c) => (c.id === saved.id ? saved : c)) : q))
  }, [])

  const shortcuts = useMemo(
    () => ({
      ' ': () => revealCard(),
      Enter: () => revealCard(),
      '1': () => rate(1),
      '2': () => rate(2),
      '3': () => rate(3),
      '4': () => rate(4),
      e: () => {
        if (card) setEditOpen(true)
      },
      Escape: () => navigate({ name: 'decks' }),
    }),
    [revealCard, rate, card, navigate],
  )

  useKeyboardShortcuts(shortcuts, !editOpen)

  if (queue === null) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading session...</div>
  }

  if (card === undefined) {
    const empty = queue.length === 0
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{empty ? 'Nothing due right now' : 'Session complete'}</h2>
          <p className="mt-2 text-muted-foreground">
            {empty
              ? 'Come back later for more reviews.'
              : `You reviewed ${sessionReviewed} card${sessionReviewed === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => navigate({ name: 'decks' })}>
            Back to decks
          </Button>
          <Button onClick={loadQueue}>Study again</Button>
          {empty && (
            <Button variant="outline" onClick={() => navigate({ name: 'browse', deckId })}>
              Browse cards
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-2 border-b border-neutral-200/70 px-2 py-2 sm:gap-3 sm:px-4 dark:border-neutral-800">
        <Button variant="ghost" size="icon" className="size-11 sm:size-10" aria-label="Back to decks" onClick={() => navigate({ name: 'decks' })}>
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{deck?.name ?? 'Study'}</h1>
        <div className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums sm:gap-1.5 sm:text-sm">
          <span className="rounded-full bg-easy/10 px-2 py-0.5 text-easy" title="New">{counts.newCount}</span>
          <span className="rounded-full bg-again/10 px-2 py-0.5 text-again" title="Learning">{counts.learnCount}</span>
          <span className="rounded-full bg-good/10 px-2 py-0.5 text-good" title="Due">{counts.dueCount}</span>
        </div>
        <Button variant="ghost" size="icon" className="size-11 sm:size-10" aria-label="Edit card" onClick={() => setEditOpen(true)}>
          <Pencil />
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-4 sm:px-6 sm:py-8">
        <div
          {...handlers}
          style={{
            transform: `translateX(${offset}px) rotate(${offset / 40}deg)`,
            transition: dragging ? 'none' : 'transform 200ms ease-out',
          }}
          className={cn(CARD_FRAME, dragging && 'shadow-lg')}
        >
          {offset < -40 && (
            <div className="absolute left-5 top-5 z-10 rounded-full border border-again/40 bg-again/10 px-3 py-1 text-sm font-semibold text-again">
              Again
            </div>
          )}
          {offset > 40 && (
            <div className="absolute right-5 top-5 z-10 rounded-full border border-good/40 bg-good/10 px-3 py-1 text-sm font-semibold text-good">
              Good
            </div>
          )}

          <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 sm:px-8">
            <div className="flex max-w-full items-center justify-center gap-2">
              <p lang="es" className="text-balance break-words text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                {card.front}
              </p>
              {supported && settings?.ttsEnabled !== false && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:size-10"
                  aria-label="Play audio"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => speak(card.front, { voiceUri: settings?.ttsVoiceUri, rate: settings?.ttsRate })}
                >
                  <Volume2 className={cn(speaking && 'animate-pulse')} />
                </Button>
              )}
            </div>
            {card.context && (
              <p lang="es" className="max-w-prose text-balance text-sm font-light italic leading-relaxed text-muted-foreground/90">
                {card.context}
              </p>
            )}
          </section>

          <div className="mx-8 h-px shrink-0 bg-neutral-200/80 dark:bg-neutral-800" />

          <section className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:px-8">
            {revealed ? (
              <div className="animate-flip-in flex w-full flex-col items-center gap-4">
                <div className="space-y-1.5">
                  <p className="text-balance text-2xl font-medium leading-snug text-foreground/90">{card.translationEn}</p>
                  <p lang="uk" className="text-balance text-xl font-medium leading-snug text-muted-foreground">
                    {card.translationUk}
                  </p>
                </div>
                {card.notes && (
                  <p className="max-w-prose text-balance text-xs font-light italic leading-relaxed text-muted-foreground/80">
                    {card.notes}
                  </p>
                )}
                {(card.partOfSpeech || card.tags.length > 0) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {card.partOfSpeech && (
                      <Badge variant="secondary" className="rounded-full font-normal capitalize">
                        {card.partOfSpeech}
                      </Badge>
                    )}
                    {card.tags.map((t) => (
                      <Badge key={t} variant="outline" className="rounded-full font-normal capitalize text-muted-foreground">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50 transition-opacity duration-200">
                Tap to reveal
              </p>
            )}
          </section>
        </div>
      </main>

      <footer className="safe-bottom sticky bottom-0 border-t border-neutral-200/70 bg-background/85 px-3 py-3 backdrop-blur-md sm:px-4 sm:py-4 dark:border-neutral-800">
        <div className="mx-auto w-full max-w-lg">
          {revealed && intervals ? (
            <div className="grid grid-cols-4 gap-2">
              {RATING_ORDER.map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  onClick={() => rate(r)}
                  className={cn(
                    'h-auto min-h-[52px] flex-col gap-0.5 rounded-full px-1 py-2 shadow-none sm:min-h-[56px]',
                    RATING_BUTTON_STYLES[r],
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {RATING_LABELS[r]}
                    <Kbd className="hidden border-current/20 bg-transparent px-1 py-0 text-[10px] text-current opacity-60 sm:inline">
                      {r}
                    </Kbd>
                  </span>
                  <span className="text-[11px] font-medium tabular-nums opacity-75">{intervals[r]}</span>
                </Button>
              ))}
            </div>
          ) : (
            <Button onClick={revealCard} size="lg" className="h-[52px] w-full rounded-full text-base shadow-sm sm:h-14">
              Show answer
              <Kbd className="hidden border-white/30 bg-white/15 text-primary-foreground sm:inline">Space</Kbd>
            </Button>
          )}
        </div>
      </footer>

      <CardFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        decks={decks ?? []}
        defaultDeckId={deckId}
        card={card}
        onSaved={replaceCard}
      />
    </div>
  )
}
