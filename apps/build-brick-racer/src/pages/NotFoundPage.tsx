import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { ScreenHeader } from '@/components/ui/ScreenHeader'

export function NotFoundPage() {
  return (
    <div className="br-screen">
      <ScreenHeader title="Lost?" />
      <div className="br-layer flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-lg">That screen is not in the garage.</p>
        <Link to="/" className="btn br-btn br-cta">
          <Icon name="home" />
          {' '}
          Garage
        </Link>
      </div>
    </div>
  )
}
