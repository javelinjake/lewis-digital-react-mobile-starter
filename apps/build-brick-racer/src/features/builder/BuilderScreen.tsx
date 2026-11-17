import { useNavigate, useParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { BuilderWorkspace } from '@/features/builder/components/BuilderWorkspace'
import { useCarLoader } from '@/features/builder/logic/use-car-loader'
import { useEditorStore } from '@/stores/editor.store'
import '@/features/builder/builder.css'
import '@/features/builder/dev-hook'

/** `/build/:carId`. Loads the car, then hands over to the workspace. */
export function BuilderScreen() {
  const { carId } = useParams()
  const navigate = useNavigate()
  const loader = useCarLoader(carId)
  const doc = useEditorStore(s => s.doc)

  if (loader.status === 'ready' && doc && doc.carId === carId)
    return <BuilderWorkspace doc={doc} recovered={loader.recovered} migrated={loader.migrated} />

  return (
    <div className="br-screen" data-testid="builder-loading">
      <ScreenHeader title="Builder" left={<button type="button" className="btn br-btn br-btn-icon" aria-label="Back to garage" onClick={() => navigate('/')}><Icon name="back" /></button>} />
      <div className="br-layer flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {loader.status === 'loading' && <span className="loading loading-spinner loading-lg" role="status" aria-label="Loading your car" />}
        {(loader.status === 'missing' || loader.status === 'error') && (
          <>
            <p className="br-panel max-w-md text-lg" role="alert">
              {loader.status === 'missing' ? 'This car isn’t in the garage any more.' : 'This car couldn’t be opened. It is still saved on this device.'}
            </p>
            <button type="button" className="btn br-btn br-cta" onClick={() => navigate('/')}>Back to garage</button>
          </>
        )}
      </div>
    </div>
  )
}
