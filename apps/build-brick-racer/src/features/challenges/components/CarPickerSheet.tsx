import { useGarageStore } from '@/stores/garage.store'
import { fallbackThumbnailSafe } from '../lib/thumb'

/** Bottom-sheet style picker for CHANGE CAR. Choosing a car makes it the garage's selected car too. */
export function CarPickerSheet({ currentId, onPick, onClose }: { currentId: string | null, onPick: (id: string) => void, onClose: () => void }) {
  const cars = useGarageStore(s => s.cars)
  const thumbs = useGarageStore(s => s.thumbs)
  return (
    <div className="modal modal-open z-50" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="modal-box br-panel max-w-3xl !rounded-none bg-transparent p-4">
        <h2 id="picker-title" className="br-display text-xl">Choose a car</h2>
        <div className="sheet-grid br-scroll mt-3 max-h-[55vh]">
          {cars.map(c => (
            <button key={c.id} type="button" className={`br-card ${c.id === currentId ? 'is-selected' : ''}`} onClick={() => onPick(c.id)} aria-label={c.name}>
              <img src={thumbs[c.id] ?? fallbackThumbnailSafe(c.name)} alt="" className="aspect-[16/10] w-full object-contain" draggable={false} />
              <span className="br-caption !text-sm !font-black">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn br-btn br-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
    </div>
  )
}
