import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { repo } from '@/db'
import { cn } from '@/lib/utils'

type EditableField = 'front' | 'translationEn' | 'translationUk'

interface EditableCellProps {
  cardId: string
  field: EditableField
  value: string
  className?: string
  lang?: string
}

/** Inline-editable text cell: double-click or the hover pencil opens an Input;
 *  Enter/blur saves via repo.updateCard, Escape cancels. */
export function EditableCell({ cardId, field, value, className, lang }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!editing) return
    doneRef.current = false
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const patchFor = (text: string) =>
    field === 'front'
      ? { front: text }
      : field === 'translationEn'
        ? { translationEn: text }
        : { translationUk: text }

  const save = () => {
    if (doneRef.current) return
    doneRef.current = true
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      void repo.updateCard(cardId, patchFor(trimmed))
    }
  }

  const cancel = () => {
    doneRef.current = true
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        lang={lang}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        onBlur={() => {
          if (!doneRef.current) save()
        }}
        className={cn(
          'h-8 min-w-28 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
      />
    )
  }

  return (
    <div className={cn('group/cell relative cursor-text', className)} onDoubleClick={startEdit}>
      <span className="block min-w-0 truncate">{value}</span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Edit ${field}`}
        title="Edit"
        onClick={startEdit}
        className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover/cell:block"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  )
}
