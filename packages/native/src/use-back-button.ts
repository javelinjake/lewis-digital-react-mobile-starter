import { App } from '@capacitor/app'
import { useEffect, useRef } from 'react'
import { isAndroid } from './platform'

export interface BackButtonHandlers {
  onBack: () => void
  onExit?: () => void
}

/** Android hardware back. No-op on iOS and web. Safe under Strict Mode. */
export function useBackButton(handlers: BackButtonHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!isAndroid())
      return

    let remove = () => {}
    const pending = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack)
        handlersRef.current.onBack()
      else if (handlersRef.current.onExit)
        handlersRef.current.onExit()
      else
        void App.minimizeApp()
    })

    pending.then((handle) => {
      remove = () => {
        void handle.remove()
      }
    }).catch(() => {})

    return () => {
      remove()
      void pending.then(handle => handle.remove()).catch(() => {})
    }
  }, [])
}
