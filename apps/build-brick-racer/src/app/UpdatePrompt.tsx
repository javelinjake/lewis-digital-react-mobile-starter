import { isNativePlatform } from '@ld/native'
import { ReloadPrompt, useServiceWorker } from '@ld/pwa'
import { useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { useEditorStore } from '@/stores/editor.store'

/** Service-worker update prompt. It never interrupts a run or an unsaved edit. */
export function UpdatePrompt() {
  const nativeShell = isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native'
  const sw = useServiceWorker({ enabled: !nativeShell })
  const driving = useAppStore(s => s.driving)
  const saving = useEditorStore(s => s.saveState === 'saving' || s.saveState === 'error')
  const [dismissed, setDismissed] = useState(false)
  const blocked = driving || saving

  return (
    <ReloadPrompt
      needRefresh={sw.needRefresh && !dismissed}
      blocked={blocked}
      blockedReason={driving ? 'Finish your run before updating.' : 'Your car is still saving.'}
      onUpdate={() => {
        if (!blocked)
          void sw.update()
      }}
      onDismiss={() => setDismissed(true)}
    />
  )
}
