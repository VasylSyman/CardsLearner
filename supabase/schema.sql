-- Lingo Cards cloud schema. Idempotent: safe to run repeatedly.
-- Shared deck: anyone holding the anon key may read/write. Replace with auth.uid() checks if you add sign-in.

create extension if not exists pgcrypto;

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  new_per_day integer not null default 20,
  reviews_per_day integer not null default 200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  spanish text not null,
  example_sentence text,
  english text not null,
  ukrainian text not null,
  part_of_speech text,
  notes text,
  tags text[] not null default '{}',
  state text not null default 'new' check (state in ('new','learning','review','relearning')),
  next_review_at timestamptz not null default now(),
  interval integer not null default 0,
  ease_factor double precision not null default 2.5,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  learning_step integer not null default 0,
  last_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  state text not null default 'new',
  interval integer not null default 0,
  ease_factor double precision not null default 2.5,
  reviewed_at timestamptz not null default now()
);

create index if not exists cards_deck_id_idx on public.cards (deck_id);
create index if not exists cards_next_review_at_idx on public.cards (next_review_at);
create index if not exists review_logs_deck_id_reviewed_at_idx on public.review_logs (deck_id, reviewed_at);
create index if not exists review_logs_card_id_idx on public.review_logs (card_id);

alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;

drop policy if exists "public_all_decks" on public.decks;
create policy "public_all_decks" on public.decks for all to anon, authenticated using (true) with check (true);

drop policy if exists "public_all_cards" on public.cards;
create policy "public_all_cards" on public.cards for all to anon, authenticated using (true) with check (true);

drop policy if exists "public_all_review_logs" on public.review_logs;
create policy "public_all_review_logs" on public.review_logs for all to anon, authenticated using (true) with check (true);

-- Realtime: add each table to the default publication (note: already-added tables raise duplicate_object).
do $$ begin
  alter publication supabase_realtime add table public.decks;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.cards;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.review_logs;
exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant all on public.decks, public.cards, public.review_logs to anon, authenticated;
