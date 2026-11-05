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

Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style primitives on Radix UI · Lucide icons · Dexie.js (IndexedDB) · Supabase (optional cloud sync) · PapaParse · Vitest

## Project structure

```
src/
  main.tsx, App.tsx            entry + hash-based routing (#/, #/study/:deckId, #/browse, #/settings)
  index.css                    Tailwind v4 theme tokens (light/dark) and rating colours
  db/
    types.ts                   Card, Deck, ReviewLog, Settings, ExportBundle
    database.ts                Dexie schema (decks, cards, reviewLogs, settings, outbox)
    repository.ts              Repository interface — the only API the UI talks to
    dexieRepository.ts         IndexedDB implementation (queue building, review, import/export)
    supabaseClient.ts          Supabase client + isCloudConfigured
    supabaseMapping.ts         Supabase row types and ms <-> ISO mappers
    syncEngine.ts              outbox flush, cloud pull, realtime subscription, startSync
    syncedRepository.ts        Repository wrapper that mirrors writes through the outbox
    index.ts                   `repo` singleton — swap the backend here
  lib/
    scheduler.ts               SM-2 scheduler (+ tests in scheduler.test.ts)
    importExport.ts            CSV/JSON helpers (+ tests)
    seed.ts                    starter deck
    utils.ts                   cn, uid, file download/read, formatting
  hooks/
    useData.ts                 Dexie live queries (decks, cards, due counts, tags, settings)
    useSyncStatus.ts           live cloud sync status + pending count
    useKeyboardShortcuts.ts, useSwipe.ts, useSpeech.ts, useTheme.ts, useHashRoute.ts
  components/
    AppShell.tsx               sidebar (desktop) / header + bottom nav (mobile)
    SyncIndicator.tsx          cloud sync status in sidebar/header
    CardFormDialog.tsx         create/edit card modal
    ui/                        button, input, textarea, label, badge, card, dialog,
                               dropdown-menu, select, switch, tooltip, table, kbd
  features/
    decks/                     DecksPage, DeckDialog
    study/                     StudyPage (review session)
    browser/                   BrowserPage, EditableCell
    settings/                  SettingsPage (theme, TTS, cloud sync, backup/restore, danger zone)
supabase/
  schema.sql                   cloud schema: tables, indexes, RLS policies, realtime publication
```

## Scheduling (SM-2 variant)

| Card state | Again | Hard | Good | Easy |
| --- | --- | --- | --- | --- |
| New / learning | back to step 1 (1 min) | repeat step | next step → graduate at 1 day | graduate at 4 days |
| Review | lapse → relearn (10 min), ease −0.20, interval ×0.2 | interval ×1.2, ease −0.15 | interval × ease | interval × ease × 1.3, ease +0.15 |
| Relearning | 10 min | 15 min | back to review | back to review |

Ease never drops below 1.3; intervals ≥ 3 days get ±5 % fuzz. Learning cards that come due within 20 minutes are re-queued in the same session.

## Cloud sync (Supabase)

Optional cloud sync keeps Lingo Cards in step across devices while staying fully usable offline.

- **Local cache + outbox** — Dexie (IndexedDB) stays as the reactive store the UI reads from; every local change is queued in a sync outbox and pushed to the cloud.
- **Source of truth** — Supabase Postgres stores decks, cards and review logs. Cloud pulls are authoritative: rows missing from the cloud are removed locally too, and changes from other devices stream in via Realtime.
- **Realtime** — Postgres changes are streamed to open tabs, so edits on one device appear on others within seconds.

### Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL editor**, paste the contents of `supabase/schema.sql` and run it — it creates the tables, indexes, row-level security policies, realtime publication and grants (idempotent, safe to re-run).
3. Copy the **Project URL** and the **anon / public** key from **Settings → API**.
4. Create `.env.local` in the project root:

   ```bash
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```

5. `npm run dev` and open Settings → **Cloud sync** — without env vars the app runs exactly as before, fully local.

### Deploying to GitHub Pages

The build reads the keys from GitHub Actions secrets. In the repo go to **Settings → Secrets and variables → Actions → New repository secret** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Pushing to `main` redeploys with sync enabled.

### Migration note

On first connect with an empty cloud database the app uploads your local decks, cards and reviews automatically. You can also push or pull manually any time from **Settings → Cloud sync → "Sync local to cloud"**.

### Security note

The anon key is a public, publishable key — it ships in the frontend. The RLS policies in `supabase/schema.sql` allow anyone holding the anon key to read and write the shared deck, so treat the vocabulary as public. Never put the `service_role` key in the client.
