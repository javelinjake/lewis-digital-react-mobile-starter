import type { DriveAssessment } from '@/game/vehicle/analysis'
import { Icon } from '@/components/ui/Icon'

/**
 * Pre-launch check dialog shared by the Builder's Drive button and the Ready screen (see `use-launch-check`).
 * Blocks only for a concrete simulation problem (and names the cause). Loose pieces get a choice.
 */
export type LaunchPhase = 'idle' | 'blocked' | 'loose'

export function LaunchDialog({
  phase,
  assessment,
  onKeepLoose,
  onFix,
  onClose,
}: {
  phase: Exclude<LaunchPhase, 'idle'>
  assessment: DriveAssessment
  onKeepLoose: () => void
  onFix: (instanceIds: string[]) => void
  onClose: () => void
}) {
  const blocked = phase === 'blocked'
  const first = assessment.blocks[0]
  const looseIds = assessment.spec?.looseInstanceIds ?? []
  return (
    <div className="modal modal-open z-50" role="dialog" aria-modal="true" aria-labelledby="launch-title">
      <div className="modal-box br-panel max-w-md !rounded-none bg-transparent p-4">
        <h2 id="launch-title" className="br-display flex items-center gap-2 text-xl">
          <Icon name={blocked ? 'warn' : 'loose'} />
          {blocked ? 'This car can’t drive yet' : 'Some pieces are loose'}
        </h2>
        <p className="mt-3 text-base">
          {blocked
            ? (first?.message ?? 'Something is stopping this car from being built for the track.')
            : `${looseIds.length} piece${looseIds.length === 1 ? ' is' : 's are'} not joined to the car. You can drive the connected car and keep the loose pieces safe in your garage.`}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn br-btn br-btn-sm" onClick={onClose}>Cancel</button>
          {blocked
            ? <button type="button" className="btn br-btn br-cta" onClick={() => onFix(first?.instanceIds ?? [])}>Go back and fix it</button>
            : (
                <>
                  <button type="button" className="btn br-btn" onClick={() => onFix(looseIds)}>Go back and connect them</button>
                  <button type="button" className="btn br-btn br-cta" onClick={onKeepLoose}>Keep loose pieces in garage</button>
                </>
              )}
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
    </div>
  )
}
