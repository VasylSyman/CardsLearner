import { describe, expect, it } from 'vitest'
import { cardsToCsv, parseCsv } from './importExport'
import type { Card } from '@/db/types'
import { newCardSchedulingFields } from './scheduler'

const card: Card = {
  id: 'c1',
  deckId: 'd1',
  front: 'la casa',
  context: 'Mi casa, "tu casa".',
  translationEn: 'house',
  translationUk: 'дім',
  partOfSpeech: 'noun',
  notes: 'Feminine',
  tags: ['nouns', 'home'],
  ...newCardSchedulingFields(0),
  createdAt: 0,
  updatedAt: 0,
}

describe('CSV import/export', () => {
  it('round-trips a card through CSV', () => {
    const csv = cardsToCsv([card], new Map([['d1', 'Spanish']]))
    const { rows, skipped, errors } = parseCsv(csv)
    expect(errors).toEqual([])
    expect(skipped).toBe(0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      front: 'la casa',
      context: 'Mi casa, "tu casa".',
      translationEn: 'house',
      translationUk: 'дім',
      partOfSpeech: 'noun',
      notes: 'Feminine',
      tags: ['nouns', 'home'],
      deck: 'Spanish',
    })
  })

  it('accepts header aliases and skips rows without a translation', () => {
    const csv = 'Spanish,English,Ukrainian,Tags\nhola,hello,привіт,"basics, greetings"\nadiós,,,\n'
    const { rows, skipped } = parseCsv(csv)
    expect(rows).toHaveLength(1)
    expect(skipped).toBe(1)
    expect(rows[0].tags).toEqual(['basics', 'greetings'])
  })
})
