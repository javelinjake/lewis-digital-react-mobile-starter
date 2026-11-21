import { ScreenContent } from '@ld/mobile-ui'
import { EmptyState } from '@ld/ui'
import { useParams } from 'react-router'
import { LabList, LabPlay } from '@/features/lab/components/LabScreens'
import { labGame } from '@/features/lab/lib/games'

export function LabPage() {
  return <ScreenContent><LabList /></ScreenContent>
}

export function LabPlayPage() {
  const game = labGame(useParams().game)
  return <ScreenContent>{game ? <LabPlay key={game.id} game={game} /> : <EmptyState title="No such game" />}</ScreenContent>
}
