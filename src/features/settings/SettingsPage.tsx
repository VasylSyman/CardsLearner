import { useRef, useState } from 'react'
import { Download, Trash2, Upload, Volume2 } from 'lucide-react'
import { repo } from '@/db'
import type { ExportBundle } from '@/db'
import {
  CSV_HEADERS,
  exportCsv,
  exportJson,
  importCsvRows,
  isExportBundle,
  parseCsv,
} from '@/lib/importExport'
import type { CsvParseResult } from '@/lib/importExport'
import { downloadTextFile, readFileAsText } from '@/lib/utils'
import { useDecks, useSettings } from '@/hooks/useData'
import { useTheme } from '@/hooks/useTheme'
import { useSpeech } from '@/hooks/useSpeech'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function SettingsPage() {
  const settings = useSettings()
  const decks = useDecks()
  const { theme, setTheme } = useTheme()
  const { supported, speak, voices } = useSpeech()

  const [status, setStatus] = useState('')
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [importJson, setImportJson] = useState<ExportBundle | null>(null)
  const [importingJson, setImportingJson] = useState(false)
  const [csvPreview, setCsvPreview] = useState<CsvParseResult | null>(null)
  const [csvTarget, setCsvTarget] = useState<string>('')
  const [newDeckName, setNewDeckName] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)

  if (settings === undefined || decks === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>
  }

  const onJsonFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const parsed: unknown = JSON.parse(text)
      if (!isExportBundle(parsed)) {
        setStatus('That file is not a Lingo Cards JSON backup.')
        return
      }
      setImportJson(parsed)
    } catch (err) {
      setStatus(err instanceof Error ? `Could not read backup: ${err.message}` : 'Could not read backup.')
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = ''
    }
  }

  const doImportJson = async (mode: 'merge' | 'replace') => {
    if (!importJson) return
    setImportingJson(true)
    try {
      const res = await repo.importBundle(importJson, mode)
      setStatus(`Imported ${res.decks} deck${res.decks === 1 ? '' : 's'}, ${res.cards} card${res.cards === 1 ? '' : 's'}.`)
      setImportJson(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImportingJson(false)
    }
  }

  const onCsvFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const result = parseCsv(text)
      setCsvPreview(result)
      setCsvTarget(decks[0]?.id ?? '__new__')
      setNewDeckName('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not read CSV.')
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  const doCsvImport = async () => {
    if (!csvPreview || csvPreview.rows.length === 0) return
    if (csvTarget === '__new__' && !newDeckName.trim()) {
      setStatus('Enter a name for the new deck.')
      return
    }
    setImportingCsv(true)
    try {
      let deckId = csvTarget
      if (csvTarget === '__new__') {
        const d = await repo.createDeck({ name: newDeckName.trim() })
        deckId = d.id
      }
      const count = await importCsvRows(csvPreview.rows, deckId)
      setStatus(`Imported ${count} card${count === 1 ? '' : 's'}.`)
      setCsvPreview(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImportingCsv(false)
    }
  }

  const downloadTemplate = () => {
    const example = ['hola', '', 'hello', 'привіт', 'interjection', '', 'basics greetings', 'Spanish Essentials']
    downloadTextFile('lingo-cards-template.csv', `${CSV_HEADERS.join(',')}\n${example.join(',')}`, 'text/csv')
  }

  const clearAllData = async () => {
    if (!window.confirm('Delete ALL decks, cards and settings? This cannot be undone. Export a backup first.')) return
    await repo.clearAll()
    window.location.hash = '#/'
    window.location.reload()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences, backups and app info.</p>
      </header>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how Lingo Cards looks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="theme">Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="w-40" id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio / pronunciation</CardTitle>
          <CardDescription>Text-to-speech for Spanish card fronts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="tts">Enable text-to-speech</Label>
              <p className="text-xs text-muted-foreground">Speak card fronts during study.</p>
            </div>
            <Switch
              id="tts"
              checked={settings.ttsEnabled}
              onCheckedChange={(v) => void repo.updateSettings({ ttsEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="autoplay">Auto-play on new card</Label>
              <p className="text-xs text-muted-foreground">Play the front automatically when a card appears.</p>
            </div>
            <Switch
              id="autoplay"
              checked={settings.autoPlayAudio}
              onCheckedChange={(v) => void repo.updateSettings({ autoPlayAudio: v })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="voice">Voice</Label>
              <Select
                value={settings.ttsVoiceUri ?? 'default'}
                onValueChange={(v) =>
                  void repo.updateSettings(v === 'default' ? { ttsVoiceUri: undefined } : { ttsVoiceUri: v })
                }
              >
                <SelectTrigger id="voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {voices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Rate: {settings.ttsRate.toFixed(1)}</Label>
              <input
                id="rate"
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={settings.ttsRate}
                onChange={(e) =>
                  void repo.updateSettings({ ttsRate: Math.round(e.target.valueAsNumber * 10) / 10 })
                }
                className="w-full accent-primary"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!supported}
              onClick={() => speak('Hola, ¿cómo estás?', { voiceUri: settings.ttsVoiceUri, rate: settings.ttsRate })}
            >
              <Volume2 /> Test
            </Button>
            {!supported && <p className="text-xs text-muted-foreground">Text-to-speech is not supported in this browser.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; restore</CardTitle>
          <CardDescription>Export your cards or restore from a backup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void exportJson()}>
              <Download /> Export JSON
            </Button>
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download /> Export CSV (all cards)
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => jsonInputRef.current?.click()}>
              <Upload /> Import JSON
            </Button>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onJsonFile(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
              <Upload /> Import CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => void onCsvFile(e.target.files?.[0])}
            />
          </div>
          <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">CSV format</p>
            <p className="break-all font-mono">{CSV_HEADERS.join(',')}</p>
            <p className="mt-1">Tags are space-separated; the deck column is optional.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={downloadTemplate}>
              <Download /> Download template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Irreversible actions. Handle with care.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => void clearAllData()}>
            <Trash2 /> Delete all data
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Wipes every deck, card and setting from this browser.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard shortcuts</CardTitle>
          <CardDescription>While studying cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Show answer</dt>
              <dd className="flex items-center gap-1">
                <Kbd>Space</Kbd>
                <Kbd>Enter</Kbd>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Rate card</dt>
              <dd className="flex items-center gap-1">
                <Kbd>1</Kbd>–<Kbd>4</Kbd> Again / Hard / Good / Easy
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Edit card</dt>
              <dd>
                <Kbd>E</Kbd>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Go back</dt>
              <dd>
                <Kbd>Esc</Kbd>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Local-first. All data is stored in this browser (IndexedDB). Export regularly to back up.
          </p>
        </CardContent>
      </Card>

      <Dialog open={importJson !== null} onOpenChange={(open) => { if (!open && !importingJson) setImportJson(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Import backup</DialogTitle>
            <DialogDescription>
              {importJson &&
                `${importJson.decks.length} deck${importJson.decks.length === 1 ? '' : 's'} and ${importJson.cards.length} card${importJson.cards.length === 1 ? '' : 's'} found in the backup.`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Merge keeps your existing data and upserts cards by id. Replace wipes all current data first.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={importingJson} onClick={() => setImportJson(null)}>
              Cancel
            </Button>
            <Button disabled={importingJson} onClick={() => void doImportJson('merge')}>
              Merge
            </Button>
            <Button variant="destructive" disabled={importingJson} onClick={() => void doImportJson('replace')}>
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={csvPreview !== null} onOpenChange={(open) => { if (!open && !importingCsv) setCsvPreview(null) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              {csvPreview &&
                `${csvPreview.rows.length} row${csvPreview.rows.length === 1 ? '' : 's'} ready${csvPreview.skipped > 0 ? `, ${csvPreview.skipped} skipped` : ''}.`}
            </DialogDescription>
          </DialogHeader>

          {csvPreview && csvPreview.errors.length > 0 && (
            <div className="max-h-24 space-y-0.5 overflow-y-auto rounded-md bg-muted p-2 text-xs text-destructive">
              {csvPreview.errors.slice(0, 8).map((e, i) => (
                <p key={i} className="truncate">
                  {e}
                </p>
              ))}
            </div>
          )}

          {csvPreview && csvPreview.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Front</TableHead>
                  <TableHead>English</TableHead>
                  <TableHead>Ukrainian</TableHead>
                  <TableHead>Deck</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.rows.slice(0, 5).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-32 truncate">{r.front}</TableCell>
                    <TableCell className="max-w-32 truncate">{r.translationEn}</TableCell>
                    <TableCell className="max-w-32 truncate">{r.translationUk}</TableCell>
                    <TableCell className="max-w-24 truncate">{r.deck ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="space-y-2">
            <Label>Target deck</Label>
            <Select
              value={csvTarget}
              onValueChange={(v) => {
                setCsvTarget(v)
                if (v !== '__new__') setNewDeckName('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose deck" />
              </SelectTrigger>
              <SelectContent>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">Create new deck…</SelectItem>
              </SelectContent>
            </Select>
            {csvTarget === '__new__' && (
              <Input
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="New deck name"
              />
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={importingCsv} onClick={() => setCsvPreview(null)}>
              Cancel
            </Button>
            <Button disabled={importingCsv || (csvPreview?.rows.length ?? 0) === 0} onClick={() => void doCsvImport()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
