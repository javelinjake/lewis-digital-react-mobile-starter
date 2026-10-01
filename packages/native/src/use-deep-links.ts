import { App } from '@capacitor/app'
import { useEffect, useRef } from 'react'
import { deepLinkToPath } from './deep-link'

/** Universal Links / App Links / custom schemes. Listener removed on unmount. */
export function useDeepLinks(onPath: (path: string) => void) {
  const onPathRef = useRef(onPath)
  onPathRef.current = onPath

  useEffect(() => {
    let remove = () => {}
    const pending = App.addListener('appUrlOpen', ({ url }) => {
      const path = deepLinkToPath(url)
      if (path)
        onPathRef.current(path)
    })

    pending.then((handle) => {
      remove = () => {
        void handle.remove()
      }
    }).catch(() => {})

    void App.getLaunchUrl()
      .then((launch) => {
        const path = launch?.url ? deepLinkToPath(launch.url) : null
        if (path && path !== '/')
          onPathRef.current(path)
      })
      .catch(() => {})

    return () => {
      remove()
      void pending.then(handle => handle.remove()).catch(() => {})
    }
  }, [])
}
