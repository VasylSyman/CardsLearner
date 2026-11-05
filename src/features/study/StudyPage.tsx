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
  1: 'bg-again hover:bg-again/90',
  2: 'bg-hard hover:bg-hard/90',
  3: 'bg-good hover:bg-good/90',
  4: 'bg-easy hover:bg-easy/90',
}

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
      <header className="flex items-center gap-3 border-b px-3 py-2 sm:px-4">
        <Button variant="ghost" size="icon" aria-label="Back to decks" onClick={() => navigate({ name: 'decks' })}>
          <ArrowLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{deck?.name ?? 'Study'}</h1>
        <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <span className="text-easy">New {counts.newCount}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-again">Learn {counts.learnCount}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-good">Due {counts.dueCount}</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Edit card" onClick={() => setEditOpen(true)}>
          <Pencil />
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div
          {...handlers}
          style={{
            transform: `translateX(${offset}px) rotate(${offset / 40}deg)`,
            transition: dragging ? 'none' : 'transform 200ms',
          }}
          className="relative flex min-h-[320px] w-full max-w-2xl touch-pan-y select-none flex-col justify-center rounded-xl border bg-card p-6 text-center shadow-sm sm:min-h-[400px] sm:p-8"
        >
          {offset < -40 && (
            <div className="absolute left-5 top-1/2 z-10 -translate-y-1/2 rounded-lg border-2 border-again/50 px-3 py-1 text-xl font-bold text-again/70">
              Again
            </div>
          )}
          {offset > 40 && (
            <div className="absolute right-5 top-1/2 z-10 -translate-y-1/2 rounded-lg border-2 border-good/50 px-3 py-1 text-xl font-bold text-good/70">
              Good
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <p lang="es" className="text-3xl font-semibold leading-tight sm:text-4xl">
              {card.front}
            </p>
            {supported && settings?.ttsEnabled !== false && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Play audio"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => speak(card.front, { voiceUri: settings?.ttsVoiceUri, rate: settings?.ttsRate })}
              >
                <Volume2 className={cn(speaking && 'animate-pulse')} />
              </Button>
            )}
          </div>
          {card.context && <p lang="es" className="mt-2 text-sm text-muted-foreground">{card.context}</p>}

          {revealed && (
            <div className="animate-flip-in mt-6 space-y-4 border-t pt-6">
              <div className="space-y-1">
                <p className="text-xl font-medium">{card.translationEn}</p>
                <p lang="uk" className="text-xl">{card.translationUk}</p>
              </div>
              {(card.partOfSpeech || card.notes || card.tags.length > 0) && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {card.partOfSpeech && (
                    <Badge variant="secondary" className="capitalize">
                      {card.partOfSpeech}
                    </Badge>
                  )}
                  {card.notes && <p className="w-full text-xs text-muted-foreground">{card.notes}</p>}
                  {card.tags.map((t) => (
                    <Badge key={t} variant="outline" className="capitalize">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="safe-bottom sticky bottom-0 border-t bg-card p-3 sm:p-4">
        {revealed && intervals ? (
          <div className="mx-auto grid w-full max-w-2xl grid-cols-4 gap-2">
            {RATING_ORDER.map((r) => (
              <Button
                key={r}
                onClick={() => rate(r)}
                className={cn('h-auto flex-col gap-1 py-3 text-white', RATING_BUTTON_STYLES[r])}
              >
                <span className="flex items-center gap-1.5">
                  {RATING_LABELS[r]}
                  <Kbd className="hidden border-white/40 bg-white/20 px-1 py-0 text-[10px] text-white sm:inline">{r}</Kbd>
                </span>
                <span className="text-xs font-normal text-white/85">{intervals[r]}</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            <Button onClick={revealCard} className="w-full">
              Show answer
              <Kbd className="hidden sm:inline">Space</Kbd>
            </Button>
          </div>
        )}
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
