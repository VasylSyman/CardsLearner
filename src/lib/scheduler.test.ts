import { describe, expect, it } from 'vitest'
import { DAY_MS, MINUTE_MS, newCardSchedulingFields, schedule } from './scheduler'

const NOW = 1_700_000_000_000

function fresh() {
  return newCardSchedulingFields(NOW)
}

describe('schedule — new/learning cards', () => {
  it('Again on a new card keeps it in learning, due in 1 minute', () => {
    const r = schedule(fresh(), 1, NOW)
    expect(r.state).toBe('learning')
    expect(r.learningStep).toBe(0)
    expect(r.due).toBe(NOW + 1 * MINUTE_MS)
  })

  it('Good on a new card advances to step 2 (10 minutes)', () => {
    const r = schedule(fresh(), 3, NOW)
    expect(r.state).toBe('learning')
    expect(r.learningStep).toBe(1)
    expect(r.due).toBe(NOW + 10 * MINUTE_MS)
  })

  it('Good on the last learning step graduates to review with a 1 day interval', () => {
    const step1 = schedule(fresh(), 3, NOW)
    const r = schedule(step1, 3, NOW)
    expect(r.state).toBe('review')
    expect(r.interval).toBe(1)
    expect(r.due).toBe(NOW + DAY_MS)
  })

  it('Easy on a new card graduates immediately with a 4 day interval', () => {
    const r = schedule(fresh(), 4, NOW)
    expect(r.state).toBe('review')
    expect(r.interval).toBe(4)
    expect(r.due).toBe(NOW + 4 * DAY_MS)
  })
})

describe('schedule — review cards (SM-2)', () => {
  const review = { ...fresh(), state: 'review' as const, interval: 10, easeFactor: 2.5, reps: 5 }

  it('Good multiplies interval by ease', () => {
    const r = schedule(review, 3, NOW)
    expect(r.state).toBe('review')
    expect(r.easeFactor).toBe(2.5)
    expect(r.interval).toBeGreaterThanOrEqual(23)
    expect(r.interval).toBeLessThanOrEqual(27)
  })

  it('Hard uses the 1.2 multiplier and lowers ease by 0.15', () => {
    const r = schedule(review, 2, NOW)
    expect(r.easeFactor).toBe(2.35)
    expect(r.interval).toBeGreaterThanOrEqual(11)
    expect(r.interval).toBeLessThanOrEqual(13)
  })

  it('Easy applies the bonus and raises ease by 0.15', () => {
    const r = schedule(review, 4, NOW)
    expect(r.easeFactor).toBe(2.65)
    expect(r.interval).toBeGreaterThanOrEqual(30)
  })

  it('Again lapses the card into relearning and lowers ease by 0.2', () => {
    const r = schedule(review, 1, NOW)
    expect(r.state).toBe('relearning')
    expect(r.lapses).toBe(1)
    expect(r.easeFactor).toBe(2.3)
    expect(r.due).toBe(NOW + 10 * MINUTE_MS)
    expect(r.interval).toBe(2)
  })

  it('never drops ease below 1.3', () => {
    let card = { ...review, easeFactor: 1.4 }
    for (let i = 0; i < 5; i++) card = { ...card, ...schedule(card, 1, NOW), state: 'review' as const }
    expect(card.easeFactor).toBe(1.3)
  })

  it('Good after relearning returns the card to review', () => {
    const lapsed = schedule(review, 1, NOW)
    const r = schedule(lapsed, 3, NOW)
    expect(r.state).toBe('review')
    expect(r.interval).toBe(2)
    expect(r.due).toBe(NOW + 2 * DAY_MS)
  })
})
