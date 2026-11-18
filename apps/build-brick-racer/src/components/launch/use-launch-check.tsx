import type { ReactNode } from 'react'
import type { LaunchPhase } from '@/components/launch/LaunchDialog'
import type { DriveAssessment } from '@/game/vehicle/analysis'
import { useState } from 'react'
import { LaunchDialog } from '@/components/launch/LaunchDialog'

export function useLaunchCheck(assess: () => DriveAssessment | null, onLaunch: () => void, onFix: (instanceIds: string[]) => void) {
  const [phase, setPhase] = useState<LaunchPhase>('idle')
  const [assessment, setAssessment] = useState<DriveAssessment | null>(null)

  const start = () => {
    const a = assess()
    setAssessment(a)
    if (!a) {
      return
    }
    if (a.blocks.length > 0)
      setPhase('blocked')
    else if (a.spec && a.spec.looseInstanceIds.length > 0)
      setPhase('loose')
    else
      onLaunch()
  }

  const close = () => setPhase('idle')

  const dialog: ReactNode = phase === 'idle' || !assessment
    ? null
    : (
        <LaunchDialog
          phase={phase}
          assessment={assessment}
          onKeepLoose={() => {
            close()
            onLaunch()
          }}
          onFix={(ids) => {
            close()
            onFix(ids)
          }}
          onClose={close}
        />
      )

  return { start, dialog, phase }
}
