import { ScreenContent } from '@ld/mobile-ui'
import { useParams } from 'react-router'
import { NoteDetail } from '@/features/notes/components/NoteDetail'

export function NoteDetailPage() {
  const { id = '' } = useParams()
  return (
    <ScreenContent>
      <NoteDetail id={id} />
    </ScreenContent>
  )
}
