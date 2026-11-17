import { useState } from 'react'

/** Small modal to rename a car. Enter saves, Escape cancels. */
export function RenameDialog({ name, onSave, onClose }: { name: string, onSave: (name: string) => void, onClose: () => void }) {
  const [value, setValue] = useState(name)
  const submit = () => {
    const trimmed = value.trim()
    if (trimmed)
      onSave(trimmed)
  }
  return (
    <div className="modal modal-open z-50" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <div className="modal-box br-panel max-w-sm !rounded-none bg-transparent p-4">
        <h2 id="rename-title" className="br-display text-xl">Name your car</h2>
        <input
          className="input mt-3 w-full border-2 border-[var(--br-cyan)] bg-[#0e2240] text-lg font-bold text-white"
          value={value}
          maxLength={32}
          autoFocus
          aria-label="Car name"
          onChange={e => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')
              submit()
            if (e.key === 'Escape')
              onClose()
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn br-btn br-btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn br-btn br-cta !min-h-14 !text-xl" disabled={!value.trim()} onClick={submit}>Save</button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
    </div>
  )
}
