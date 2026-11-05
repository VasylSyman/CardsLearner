import { useEffect, useState } from 'react'
import { repo } from '@/db'
import type { Deck } from '@/db'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DeckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deck?: Deck
}

interface FormState {
  name: string
  description: string
  newPerDay: string
  reviewsPerDay: string
}

function toForm(deck?: Deck): FormState {
  return {
    name: deck?.name ?? '',
    description: deck?.description ?? '',
    newPerDay: String(deck?.newPerDay ?? 20),
    reviewsPerDay: String(deck?.reviewsPerDay ?? 200),
  }
}

export function DeckDialog({ open, onOpenChange, deck }: DeckDialogProps) {
  const [form, setForm] = useState<FormState>(() => toForm(deck))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toForm(deck))
      setError(null)
    }
  }, [open, deck])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const valid = form.name.trim().length > 0

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!valid) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const newPerDay = Math.max(0, Math.floor(Number(form.newPerDay) || 0))
      const reviewsPerDay = Math.max(0, Math.floor(Number(form.reviewsPerDay) || 0))
      if (deck) {
        await repo.updateDeck(deck.id, {
          name: form.name.trim(),
          description: form.description || undefined,
          newPerDay,
          reviewsPerDay,
        })
      } else {
        await repo.createDeck({
          name: form.name.trim(),
          description: form.description || undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deck')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{deck ? 'Edit deck' : 'New deck'}</DialogTitle>
            <DialogDescription>
              {deck ? 'Rename the deck or adjust its daily study limits.' : 'Create a new deck of cards.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="deck-name">Name *</Label>
            <Input
              id="deck-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              placeholder="Spanish basics"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deck-description">Description</Label>
            <Input
              id="deck-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Nouns, verbs, everyday phrases..."
            />
          </div>
          {deck && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deck-new-per-day">New cards / day</Label>
                <Input
                  id="deck-new-per-day"
                  type="number"
                  min={0}
                  value={form.newPerDay}
                  onChange={(e) => set('newPerDay', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deck-reviews-per-day">Reviews / day</Label>
                <Input
                  id="deck-reviews-per-day"
                  type="number"
                  min={0}
                  value={form.reviewsPerDay}
                  onChange={(e) => set('reviewsPerDay', e.target.value)}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {deck ? 'Save' : 'Create deck'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
