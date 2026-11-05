import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { repo } from '@/db'
import type { Card, Deck, PartOfSpeech } from '@/db/types'
import { PARTS_OF_SPEECH } from '@/db/types'
import { parseTags } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decks: Deck[]
  card?: Card
  defaultDeckId?: string
  onSaved?: (card: Card | undefined) => void
  onDeleted?: () => void
}

interface FormState {
  deckId: string
  front: string
  context: string
  translationEn: string
  translationUk: string
  partOfSpeech: PartOfSpeech | ''
  notes: string
  tags: string
}

function toForm(card: Card | undefined, defaultDeckId: string): FormState {
  return {
    deckId: card?.deckId ?? defaultDeckId,
    front: card?.front ?? '',
    context: card?.context ?? '',
    translationEn: card?.translationEn ?? '',
    translationUk: card?.translationUk ?? '',
    partOfSpeech: card?.partOfSpeech ?? '',
    notes: card?.notes ?? '',
    tags: card?.tags.join(' ') ?? '',
  }
}

export function CardFormDialog({ open, onOpenChange, decks, card, defaultDeckId, onSaved, onDeleted }: CardFormDialogProps) {
  const fallbackDeck = defaultDeckId ?? decks[0]?.id ?? ''
  const [form, setForm] = useState<FormState>(() => toForm(card, fallbackDeck))
  const [saving, setSaving] = useState(false)
  const [addAnother, setAddAnother] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toForm(card, fallbackDeck))
      setError(null)
    }
  }, [open, card, fallbackDeck])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const valid = form.front.trim() && (form.translationEn.trim() || form.translationUk.trim()) && form.deckId

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!valid) {
      setError('Front and at least one translation are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        deckId: form.deckId,
        front: form.front,
        context: form.context || undefined,
        translationEn: form.translationEn,
        translationUk: form.translationUk,
        partOfSpeech: form.partOfSpeech || undefined,
        notes: form.notes || undefined,
        tags: parseTags(form.tags),
      }
      if (card) {
        await repo.updateCard(card.id, payload)
        onSaved?.(await repo.getCard(card.id))
        onOpenChange(false)
      } else {
        const created = await repo.createCard(payload)
        onSaved?.(created)
        if (addAnother) {
          setForm((f) => ({ ...toForm(undefined, f.deckId), tags: f.tags }))
        } else {
          onOpenChange(false)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!card) return
    if (!window.confirm('Delete this card? This cannot be undone.')) return
    await repo.deleteCard(card.id)
    onDeleted?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{card ? 'Edit card' : 'New card'}</DialogTitle>
            <DialogDescription>Spanish on the front, English and Ukrainian on the back.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="front">Front (Spanish) *</Label>
              <Input id="front" value={form.front} onChange={(e) => set('front', e.target.value)} autoFocus lang="es" placeholder="la biblioteca" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="context">Example sentence</Label>
              <Textarea id="context" rows={2} value={form.context} onChange={(e) => set('context', e.target.value)} lang="es" placeholder="Voy a la biblioteca todos los días." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en">Translation 1 (English)</Label>
              <Input id="en" value={form.translationEn} onChange={(e) => set('translationEn', e.target.value)} placeholder="library" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uk">Translation 2 (Ukrainian)</Label>
              <Input id="uk" value={form.translationUk} onChange={(e) => set('translationUk', e.target.value)} lang="uk" placeholder="бібліотека" />
            </div>
            <div className="space-y-1.5">
              <Label>Part of speech</Label>
              <Select value={form.partOfSpeech || 'none'} onValueChange={(v) => set('partOfSpeech', v === 'none' ? '' : (v as PartOfSpeech))}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PARTS_OF_SPEECH.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deck</Label>
              <Select value={form.deckId} onValueChange={(v) => set('deckId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose deck" />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="nouns travel (space or comma separated)" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Gender, conjugation hints, mnemonics…" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {card ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                  <Trash2 /> Delete
                </Button>
              ) : (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} className="accent-primary" />
                  Add another
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !valid}>
                {card ? 'Save' : 'Add card'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
