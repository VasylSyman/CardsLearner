import Papa from 'papaparse'
import { repo } from '@/db'
import type { Card, CardInput, ExportBundle, PartOfSpeech } from '@/db/types'
import { PARTS_OF_SPEECH } from '@/db/types'
import { downloadTextFile } from './utils'

export const CSV_HEADERS = [
  'front',
  'context',
  'translation_en',
  'translation_uk',
  'part_of_speech',
  'notes',
  'tags',
  'deck',
] as const

const HEADER_ALIASES: Record<string, (typeof CSV_HEADERS)[number]> = {
  front: 'front',
  spanish: 'front',
  es: 'front',
  word: 'front',
  context: 'context',
  sentence: 'context',
  example: 'context',
  example_sentence: 'context',
  'example sentence': 'context',
  translation_en: 'translation_en',
  english: 'translation_en',
  en: 'translation_en',
  translation1: 'translation_en',
  'translation 1': 'translation_en',
  translation_uk: 'translation_uk',
  ukrainian: 'translation_uk',
  uk: 'translation_uk',
  ua: 'translation_uk',
  translation2: 'translation_uk',
  'translation 2': 'translation_uk',
  part_of_speech: 'part_of_speech',
  pos: 'part_of_speech',
  'part of speech': 'part_of_speech',
  notes: 'notes',
  note: 'notes',
  tags: 'tags',
  tag: 'tags',
  deck: 'deck',
}

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase()
  return HEADER_ALIASES[key] ?? key
}

function toPos(raw?: string): PartOfSpeech | undefined {
  const v = raw?.trim().toLowerCase()
  if (!v) return undefined
  return (PARTS_OF_SPEECH as string[]).includes(v) ? (v as PartOfSpeech) : 'other'
}

export function cardsToCsv(cards: Card[], deckNames: Map<string, string>): string {
  const rows = cards.map((c) => ({
    front: c.front,
    context: c.context ?? '',
    translation_en: c.translationEn,
    translation_uk: c.translationUk,
    part_of_speech: c.partOfSpeech ?? '',
    notes: c.notes ?? '',
    tags: c.tags.join(' '),
    deck: deckNames.get(c.deckId) ?? '',
  }))
  return Papa.unparse({ fields: [...CSV_HEADERS], data: rows.map((r) => CSV_HEADERS.map((h) => r[h])) })
}

export interface ParsedCsvRow {
  front: string
  context?: string
  translationEn: string
  translationUk: string
  partOfSpeech?: PartOfSpeech
  notes?: string
  tags: string[]
  deck?: string
}

export interface CsvParseResult {
  rows: ParsedCsvRow[]
  skipped: number
  errors: string[]
}

export function parseCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  })
  const rows: ParsedCsvRow[] = []
  let skipped = 0
  for (const r of result.data) {
    const front = (r.front ?? '').trim()
    const en = (r.translation_en ?? '').trim()
    const uk = (r.translation_uk ?? '').trim()
    if (!front || (!en && !uk)) {
      skipped++
      continue
    }
    rows.push({
      front,
      context: r.context?.trim() || undefined,
      translationEn: en,
      translationUk: uk,
      partOfSpeech: toPos(r.part_of_speech),
      notes: r.notes?.trim() || undefined,
      tags: (r.tags ?? '')
        .split(/[,\s;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      deck: r.deck?.trim() || undefined,
    })
  }
  return {
    rows,
    skipped,
    errors: result.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`),
  }
}

export async function importCsvRows(rows: ParsedCsvRow[], fallbackDeckId: string): Promise<number> {
  const decks = await repo.listDecks()
  const byName = new Map(decks.map((d) => [d.name.toLowerCase(), d.id]))
  const inputs: CardInput[] = []
  for (const r of rows) {
    let deckId = fallbackDeckId
    if (r.deck) {
      const key = r.deck.toLowerCase()
      let id = byName.get(key)
      if (!id) {
        const d = await repo.createDeck({ name: r.deck })
        id = d.id
        byName.set(key, id)
      }
      deckId = id
    }
    inputs.push({
      deckId,
      front: r.front,
      context: r.context,
      translationEn: r.translationEn,
      translationUk: r.translationUk,
      partOfSpeech: r.partOfSpeech,
      notes: r.notes,
      tags: r.tags,
    })
  }
  const created = await repo.createCards(inputs)
  return created.length
}

export async function exportJson() {
  const bundle = await repo.exportAll()
  const stamp = new Date().toISOString().slice(0, 10)
  downloadTextFile(`lingo-cards-backup-${stamp}.json`, JSON.stringify(bundle, null, 2), 'application/json')
}

export async function exportCsv(deckId?: string) {
  const [cards, decks] = await Promise.all([repo.listCards(deckId), repo.listDecks()])
  const names = new Map(decks.map((d) => [d.id, d.name]))
  const stamp = new Date().toISOString().slice(0, 10)
  downloadTextFile(`lingo-cards-${stamp}.csv`, cardsToCsv(cards, names), 'text/csv')
}

export function isExportBundle(value: unknown): value is ExportBundle {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.decks) && Array.isArray(v.cards)
}
