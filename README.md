# Lingo Cards

A responsive, local-first Spanish flashcard app modeled on Anki. Cards show a Spanish word or phrase on the front and English + Ukrainian translations on the back; reviews are scheduled with an SM-2 style spaced-repetition algorithm. All data lives in your browser (IndexedDB via Dexie) and can be exported/imported as JSON or CSV.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. A starter deck ("Spanish Essentials", 20 cards) is seeded on first launch.

Other scripts:

```bash
npm run build       # typecheck + production build into dist/
npm run preview     # serve the production build
npm run typecheck   # tsc only
npm test            # vitest (scheduler + CSV round-trip tests)
npm run lint        # oxlint
```

## Features

- **Study mode** — Anki flow: front → *Show answer* → Again / Hard / Good / Easy with predicted intervals. Learning steps (1m, 10m), graduating/easy intervals, ease factor, lapses and relearning. Today's New / Learn / Due counters, with per-deck daily limits.
- **Pronunciation** — Web Speech API (Spanish voice selectable in Settings, optional auto-play).
- **Keyboard** — `Space`/`Enter` flip, `1`–`4` rate, `E` edit, `Esc` back to decks.
- **Mobile** — bottom navigation, bottom action bar, tap to flip, swipe left = Again, swipe right = Good.
- **Card browser** — search, filter by deck/tag/state, sortable table, inline editing (double-click a cell), bulk delete / move / reset progress. Compact card list on small screens.
- **Decks** — create, rename, set daily limits, delete.
- **Backup** — JSON export/import (full data incl. scheduling, merge or replace) and CSV import/export (with a downloadable template and header aliases such as `Spanish,English,Ukrainian`).
- **Dark / light / system theme.**

## CSV format

```
front,context,translation_en,translation_uk,part_of_speech,notes,tags,deck
la casa,Mi casa es pequeña.,house,дім,noun,Feminine noun.,nouns home,Spanish Essentials
```

`front` plus at least one translation are required; everything else is optional. Tags are space- or comma-separated; `deck` is created if it does not exist.

## Tech stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style primitives on Radix UI · Lucide icons · Dexie.js (IndexedDB) · PapaParse · Vitest

## Project structure

```
src/
  main.tsx, App.tsx            entry + hash-based routing (#/, #/study/:deckId, #/browse, #/settings)
  index.css                    Tailwind v4 theme tokens (light/dark) and rating colours
  db/
    types.ts                   Card, Deck, ReviewLog, Settings, ExportBundle
    database.ts                Dexie schema (decks, cards, reviewLogs, settings)
    repository.ts              Repository interface — the only API the UI talks to
    dexieRepository.ts         IndexedDB implementation (queue building, review, import/export)
    index.ts                   `repo` singleton — swap the backend here
  lib/
    scheduler.ts               SM-2 scheduler (+ tests in scheduler.test.ts)
    importExport.ts            CSV/JSON helpers (+ tests)
    seed.ts                    starter deck
    utils.ts                   cn, uid, file download/read, formatting
  hooks/
    useData.ts                 Dexie live queries (decks, cards, due counts, tags, settings)
    useKeyboardShortcuts.ts, useSwipe.ts, useSpeech.ts, useTheme.ts, useHashRoute.ts
  components/
    AppShell.tsx               sidebar (desktop) / header + bottom nav (mobile)
    CardFormDialog.tsx         create/edit card modal
    ui/                        button, input, textarea, label, badge, card, dialog,
                               dropdown-menu, select, switch, tooltip, table, kbd
  features/
    decks/                     DecksPage, DeckDialog
    study/                     StudyPage (review session)
    browser/                   BrowserPage, EditableCell
    settings/                  SettingsPage (theme, TTS, backup/restore, danger zone)
```

## Scheduling (SM-2 variant)

| Card state | Again | Hard | Good | Easy |
| --- | --- | --- | --- | --- |
| New / learning | back to step 1 (1 min) | repeat step | next step → graduate at 1 day | graduate at 4 days |
| Review | lapse → relearn (10 min), ease −0.20, interval ×0.2 | interval ×1.2, ease −0.15 | interval × ease | interval × ease × 1.3, ease +0.15 |
| Relearning | 10 min | 15 min | back to review | back to review |

Ease never drops below 1.3; intervals ≥ 3 days get ±5 % fuzz. Learning cards that come due within 20 minutes are re-queued in the same session.

## Connecting a backend later

The UI depends only on the `Repository` interface in `src/db/repository.ts`. To sync with Supabase, Firebase, SQLite, etc., implement that interface (or wrap `DexieRepository` with a sync layer) and change the single export in `src/db/index.ts`. All records already carry string UUIDs and `createdAt`/`updatedAt` timestamps to make merging straightforward.
