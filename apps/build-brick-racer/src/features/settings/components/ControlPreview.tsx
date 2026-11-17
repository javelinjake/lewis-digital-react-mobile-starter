import { Icon } from '@/components/ui/Icon'

/** A tiny live picture of the driving controls: size follows the slider, sides swap for left-handed play. */
export function ControlPreview({ leftHanded, scale }: { leftHanded: boolean, scale: number }) {
  return (
    <div className={`set-preview ${leftHanded ? 'is-lefty' : ''}`} data-testid="control-preview" data-lefty={leftHanded} data-scale={scale} aria-hidden="true">
      <div className="set-preview-group" style={{ transform: `scale(${scale})` }}>
        <span className="set-preview-pad"><Icon name="arrow-left" size={14} /></span>
        <span className="set-preview-pad"><Icon name="arrow-right" size={14} /></span>
      </div>
      <div className="set-preview-group" style={{ transform: `scale(${scale})` }}>
        <span className="set-preview-pad is-brake"><Icon name="close" size={13} /></span>
        <span className="set-preview-pad is-gas"><Icon name="arrow-up" size={14} /></span>
      </div>
    </div>
  )
}
