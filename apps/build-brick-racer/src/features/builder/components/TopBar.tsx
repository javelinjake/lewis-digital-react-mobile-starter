import type { BuildMode } from '@/game/persistence/types'
import type { SaveState } from '@/stores/editor.store'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

interface TopBarProps {
  name: string
  onRename: (name: string) => void
  mode: BuildMode
  onMode: (mode: BuildMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  saveState: SaveState
  saveError: 'storage_full' | 'storage_error' | null
  onRetry: () => void
  onBack: () => void
  onHelp: () => void
  onDrive: () => void
}

function NameField({ name, onRename }: { name: string, onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing)
      input.current?.select()
  }, [editing])

  const finish = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== name)
      onRename(draft.trim())
  }

  const startEditing = () => {
    setDraft(name)
    setEditing(true)
  }

  if (editing) {
    return (
      <input
        ref={input}
        className="input bd-name-input"
        value={draft}
        maxLength={24}
        aria-label="Car name"
        onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter')
            finish()
          if (e.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <button type="button" className="bd-name" aria-label={`Car name: ${name}. Tap to rename.`} onClick={startEditing}>
      <span className="truncate">{name}</span>
      <Icon name="pencil" size={16} />
    </button>
  )
}

export function SaveChip({ state, error, onRetry }: { state: SaveState, error: TopBarProps['saveError'], onRetry: () => void }) {
  if (state === 'error') {
    return (
      <div className="bd-save is-error" role="status" data-testid="save-chip" data-state="error">
        <Icon name="warn" size={18} />
        <span>{error === 'storage_full' ? 'Device full' : 'Couldn’t save'}</span>
        <button type="button" className="bd-retry" onClick={onRetry}>Retry</button>
      </div>
    )
  }
  return (
    <div className="bd-save" role="status" data-testid="save-chip" data-state={state === 'saving' ? 'saving' : 'saved'}>
      {state === 'saving' ? <span className="loading loading-spinner loading-xs" /> : <Icon name="check" size={18} />}
      <span>{state === 'saving' ? 'Saving…' : 'Saved'}</span>
    </div>
  )
}

export function TopBar(p: TopBarProps) {
  return (
    <header className="bd-top" aria-label="Builder tools">
      <button type="button" className="btn br-btn br-btn-icon bd-icon-btn" aria-label="Back to garage" onClick={p.onBack}>
        <Icon name="back" />
      </button>
      <NameField name={p.name} onRename={p.onRename} />
      <div className="bd-mode" role="group" aria-label="Build mode">
        {(['easy', 'free'] as const).map(m => (
          <button
            key={m}
            type="button"
            className={`br-tab bd-mode-btn ${p.mode === m ? 'is-active' : ''}`}
            aria-pressed={p.mode === m}
            data-testid={`mode-${m}`}
            onClick={() => p.onMode(m)}
          >
            {m === 'easy' ? 'Easy' : 'Free'}
          </button>
        ))}
      </div>
      <div className="bd-undo">
        <button type="button" className="btn br-btn br-btn-icon bd-icon-btn" aria-label="Undo" disabled={!p.canUndo} onClick={p.onUndo} data-testid="undo">
          <Icon name="undo" />
        </button>
        <button type="button" className="btn br-btn br-btn-icon bd-icon-btn" aria-label="Redo" disabled={!p.canRedo} onClick={p.onRedo} data-testid="redo">
          <Icon name="redo" />
        </button>
      </div>
      <SaveChip state={p.saveState} error={p.saveError} onRetry={p.onRetry} />
      <button type="button" className="btn br-btn br-btn-icon bd-icon-btn bd-hide-narrow" aria-label="Help" onClick={p.onHelp}>
        <Icon name="help" />
      </button>
      <button type="button" className="btn br-btn br-cta bd-drive" onClick={p.onDrive} data-testid="drive">
        Drive
        {' '}
        <Icon name="chevrons" size={22} />
      </button>
    </header>
  )
}
