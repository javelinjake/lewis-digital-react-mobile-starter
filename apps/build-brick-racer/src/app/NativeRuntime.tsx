import { useAppState, useBackButton } from '@ld/native/react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAppStore } from '@/stores/app.store'
import { useEditorStore } from '@/stores/editor.store'

/**
 * Native lifecycle glue. Backgrounding pauses a live run and flushes the editor; Android back moves
 * through history, except on the Drive screen where it asks that screen to pause.
 */
export function NativeRuntime() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { onPause } = useAppState()

  useBackButton({
    onBack: () => {
      if (pathname.startsWith('/drive'))
        window.dispatchEvent(new Event('br:back'))
      else
        navigate(-1)
    },
  })

  useEffect(() => onPause(() => {
    useAppStore.getState().notifyBackgrounded()
    void useEditorStore.getState().flushSave()
  }), [onPause])

  // On the web the page-visibility event is the equivalent of backgrounding.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        useAppStore.getState().notifyBackgrounded()
        void useEditorStore.getState().flushSave()
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [])

  return null
}
