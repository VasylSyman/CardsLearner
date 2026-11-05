import type { Card, CardState, Rating } from '@/db/types'

export const DAY_MS = 24 * 60 * 60 * 1000
export const MINUTE_MS = 60 * 1000

export const LEARNING_STEPS_MIN = [1, 10]
export const RELEARNING_STEPS_MIN = [10]
export const GRADUATING_INTERVAL_DAYS = 1
export const EASY_INTERVAL_DAYS = 4
export const MIN_EASE = 1.3
export const DEFAULT_EASE = 2.5
export const HARD_MULTIPLIER = 1.2
export const EASY_BONUS = 1.3
export const MAX_INTERVAL_DAYS = 365 * 10

export interface ScheduleResult {
  state: CardState
  due: number
  interval: number
  easeFactor: number
  reps: number
  lapses: number
  learningStep: number
  lastReview: number
}

type SchedulableCard = Pick<
  Card,
  'state' | 'interval' | 'easeFactor' | 'reps' | 'lapses' | 'learningStep'
>

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, Math.round(ease * 100) / 100)
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)))
}

function fuzz(days: number): number {
  if (days < 3) return days
  const spread = Math.max(1, Math.round(days * 0.05))
  const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread
  return clampInterval(days + delta)
}

export function schedule(card: SchedulableCard, rating: Rating, now = Date.now()): ScheduleResult {
  const base = {
    reps: card.reps + 1,
    lapses: card.lapses,
    lastReview: now,
    easeFactor: card.easeFactor || DEFAULT_EASE,
  }

  if (card.state === 'new' || card.state === 'learning') {
    const steps = LEARNING_STEPS_MIN
    const step = card.learningStep ?? 0

    if (rating === 1) {
      return {
        ...base,
        state: 'learning',
        learningStep: 0,
        interval: 0,
        due: now + steps[0] * MINUTE_MS,
      }
    }
    if (rating === 2) {
      const mins = step === 0 ? Math.max(steps[0] * 1.5, (steps[0] + (steps[1] ?? steps[0])) / 2) : steps[Math.min(step, steps.length - 1)]
      return {
        ...base,
        state: 'learning',
        learningStep: step,
        interval: 0,
        due: now + mins * MINUTE_MS,
      }
    }
    if (rating === 4) {
      return {
        ...base,
        state: 'review',
        learningStep: 0,
        interval: EASY_INTERVAL_DAYS,
        due: now + EASY_INTERVAL_DAYS * DAY_MS,
      }
    }
    const nextStep = step + 1
    if (nextStep >= steps.length) {
      return {
        ...base,
        state: 'review',
        learningStep: 0,
        interval: GRADUATING_INTERVAL_DAYS,
        due: now + GRADUATING_INTERVAL_DAYS * DAY_MS,
      }
    }
    return {
      ...base,
      state: 'learning',
      learningStep: nextStep,
      interval: 0,
      due: now + steps[nextStep] * MINUTE_MS,
    }
  }

  if (card.state === 'relearning') {
    const steps = RELEARNING_STEPS_MIN
    const step = card.learningStep ?? 0
    if (rating === 1) {
      return {
        ...base,
        state: 'relearning',
        learningStep: 0,
        interval: card.interval,
        due: now + steps[0] * MINUTE_MS,
      }
    }
    if (rating === 2) {
      return {
        ...base,
        state: 'relearning',
        learningStep: step,
        interval: card.interval,
        due: now + steps[Math.min(step, steps.length - 1)] * 1.5 * MINUTE_MS,
      }
    }
    const nextStep = step + 1
    if (rating === 4 || nextStep >= steps.length) {
      const interval = clampInterval(Math.max(1, card.interval))
      return {
        ...base,
        state: 'review',
        learningStep: 0,
        interval,
        due: now + interval * DAY_MS,
      }
    }
    return {
      ...base,
      state: 'relearning',
      learningStep: nextStep,
      interval: card.interval,
      due: now + steps[nextStep] * MINUTE_MS,
    }
  }

  const ease = base.easeFactor
  const prevInterval = Math.max(1, card.interval)

  switch (rating) {
    case 1: {
      const newEase = clampEase(ease - 0.2)
      const newInterval = clampInterval(Math.max(1, prevInterval * 0.2))
      return {
        ...base,
        lapses: card.lapses + 1,
        easeFactor: newEase,
        state: 'relearning',
        learningStep: 0,
        interval: newInterval,
        due: now + RELEARNING_STEPS_MIN[0] * MINUTE_MS,
      }
    }
    case 2: {
      const newEase = clampEase(ease - 0.15)
      const newInterval = fuzz(clampInterval(prevInterval * HARD_MULTIPLIER))
      return {
        ...base,
        easeFactor: newEase,
        state: 'review',
        learningStep: 0,
        interval: newInterval,
        due: now + newInterval * DAY_MS,
      }
    }
    case 3: {
      const newInterval = fuzz(clampInterval(prevInterval * ease))
      return {
        ...base,
        easeFactor: ease,
        state: 'review',
        learningStep: 0,
        interval: newInterval,
        due: now + newInterval * DAY_MS,
      }
    }
    case 4: {
      const newEase = clampEase(ease + 0.15)
      const newInterval = fuzz(clampInterval(prevInterval * ease * EASY_BONUS))
      return {
        ...base,
        easeFactor: newEase,
        state: 'review',
        learningStep: 0,
        interval: newInterval,
        due: now + newInterval * DAY_MS,
      }
    }
  }
}

export function previewIntervals(card: SchedulableCard, now = Date.now()): Record<Rating, string> {
  const fmt = (r: Rating) => formatInterval(schedule(card, r, now).due - now)
  return { 1: fmt(1), 2: fmt(2), 3: fmt(3), 4: fmt(4) }
}

export function formatInterval(ms: number): string {
  if (ms < MINUTE_MS) return '<1m'
  if (ms < 60 * MINUTE_MS) return `${Math.round(ms / MINUTE_MS)}m`
  if (ms < DAY_MS) return `${Math.round(ms / (60 * MINUTE_MS))}h`
  const days = Math.round(ms / DAY_MS)
  if (days < 30) return `${days}d`
  if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')}mo`
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`
}

export function newCardSchedulingFields(now = Date.now()) {
  return {
    state: 'new' as CardState,
    due: now,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    reps: 0,
    lapses: 0,
    learningStep: 0,
  }
}

export function startOfToday(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfToday(now = Date.now()): number {
  return startOfToday(now) + DAY_MS - 1
}
