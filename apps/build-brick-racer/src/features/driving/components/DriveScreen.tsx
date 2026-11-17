import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { useDrivePlan } from '../use-drive-plan'
import { DriveStage } from './DriveStage'
import { BackButton, StatusPanel } from './StatusPanels'

/** Route `/drive`: works out what to drive, explains problems, then hands over to the live stage. */
export function DriveScreen() {
  const navigate = useNavigate()
  const state = useDrivePlan(0)

  switch (state.status) {
    case 'loading':
      return <StatusPanel title="Drive" busy><p className="br-display-sm">Getting your car ready…</p></StatusPanel>
    case 'missing':
      return (
        <StatusPanel title="No car yet" actions={<BackButton onClick={() => navigate('/')} label="Garage" />}>
          <p className="text-lg">Pick or build a car in the garage first.</p>
        </StatusPanel>
      )
    case 'blocked':
      return (
        <StatusPanel
          title="Can’t drive yet"
          actions={(
            <>
              <BackButton onClick={() => navigate('/')} label="Garage" />
              <button type="button" className="btn br-btn br-cta" onClick={() => navigate(`/build/${state.carId}`)}>
                <Icon name="pencil" />
                {' '}
                Back to building
              </button>
            </>
          )}
        >
          <p className="text-lg">{state.message}</p>
        </StatusPanel>
      )
    case 'nofit':
      return (
        <StatusPanel
          title="Too big for the start"
          actions={(
            <>
              <button type="button" className="btn br-btn" onClick={() => navigate(`/build/${state.doc.carId}`)}>
                <Icon name="pencil" />
                {' '}
                Back to building
              </button>
              <button type="button" className="btn br-btn br-cta" onClick={() => navigate(`/drive?challenge=free&place=${state.challenge.environment}&car=${state.doc.carId}`, { replace: true })}>
                <Icon name="car" />
                {' '}
                Free drive instead
              </button>
            </>
          )}
        >
          <p className="text-lg">{state.message}</p>
          <p className="mt-2 opacity-80">Your car is untouched. You can drive it in the open free-drive area.</p>
        </StatusPanel>
      )
    case 'ready':
      return <DriveStage key={`${state.plan.doc.revisionId}-${state.plan.challenge?.id ?? 'free'}-${state.plan.env.id}`} plan={state.plan} />
  }
}
