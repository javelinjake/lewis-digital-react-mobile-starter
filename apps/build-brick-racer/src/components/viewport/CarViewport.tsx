import type { CarDocument } from '@/game/build/types'
import { useEffect, useRef, useState } from 'react'
import { usePrefsStore } from '@/stores/prefs.store'
import './viewport.css'

/**
 * Live 3D viewport of a car with a slow turntable. Imperative three.js behind a canvas; nothing here
 * re-renders per frame. With reduced motion the car is shown still. If WebGL is unavailable or the render
 * fails, the car's thumbnail image is shown instead so the screen never goes blank.
 */
export function CarViewport({
  doc,
  thumbnail,
  mat = true,
  label,
  className = '',
  /** Starting yaw of the turntable in radians. */
  yaw = 0.55,
  /** Camera distance multiplier. Bigger shows more space around the car. */
  zoom = 1,
}: {
  doc: CarDocument | null
  thumbnail?: string
  mat?: boolean
  label?: string
  className?: string
  yaw?: number
  zoom?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefsStore(s => s.prefs.reducedMotion)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !doc || doc.instances.length === 0)
      return
    let cancelled = false
    let raf = 0
    let cleanup = () => {}
    setFailed(false)

    void (async () => {
      try {
        const [render, three, { catalog }] = await Promise.all([
          import('@/render'),
          import('three'),
          import('@/game/catalog/catalog'),
        ])
        if (cancelled)
          return
        const THREE = three
        const kit = render.createSceneKit(canvas, { transparent: true, quality: 'high' })
        const model = render.buildBuilderModel(doc, catalog)
        const box = new THREE.Box3()
        for (const b of model.bounds.values()) {
          box.expandByPoint(new THREE.Vector3(...b.min))
          box.expandByPoint(new THREE.Vector3(...b.max))
        }
        if (box.isEmpty())
          throw new Error('empty')
        const centre = box.getCenter(new THREE.Vector3())
        const radius = box.getSize(new THREE.Vector3()).length() / 2

        const pivot = new THREE.Group()
        pivot.position.copy(centre)
        model.root.position.sub(centre)
        pivot.add(model.root)
        pivot.rotation.y = yaw
        kit.scene.add(pivot)

        let floor: import('three').Object3D | null = null
        if (mat) {
          floor = render.createFloorMat(radius * 3.1, radius * 3.1)
          floor.position.set(centre.x, box.min.y - 0.002, centre.z)
          kit.scene.add(floor)
        }

        const place = () => {
          const aspect = Math.max(0.5, canvas.clientWidth / Math.max(1, canvas.clientHeight))
          const vFov = (kit.camera.fov * Math.PI) / 180
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
          const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.95 * zoom
          const dir = new THREE.Vector3(0.45, 0.55, 0.7).normalize()
          kit.camera.position.copy(centre).addScaledVector(dir, dist)
          kit.camera.lookAt(centre.x, centre.y - radius * 0.06, centre.z)
          kit.followSun([centre.x, centre.y, centre.z])
        }
        place()
        const observer = typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => {
              place()
              kit.render()
            })
        observer?.observe(canvas)

        const start = performance.now()
        let last = start
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame)
          if (document.visibilityState === 'hidden')
            return
          const dt = (now - last) / 1000
          last = now
          if (!reducedMotion)
            pivot.rotation.y += dt * 0.35
          model.tick((now - start) / 1000)
          kit.render()
        }
        if (reducedMotion) {
          kit.render()
          // A still frame is enough, but keep one cheap refresh so late layout is captured.
          raf = requestAnimationFrame(() => kit.render())
        }
        else {
          raf = requestAnimationFrame(frame)
        }

        cleanup = () => {
          cancelAnimationFrame(raf)
          observer?.disconnect()
          kit.scene.remove(pivot)
          if (floor)
            kit.scene.remove(floor)
          model.dispose()
          kit.dispose()
        }
        if (cancelled)
          cleanup()
      }
      catch {
        if (!cancelled)
          setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [doc, mat, reducedMotion, yaw, zoom])

  const empty = !doc || doc.instances.length === 0
  return (
    <div className={`br-viewport ${className}`} role="img" aria-label={label ?? (doc ? `3D view of ${doc.name}` : 'No car')}>
      {!empty && !failed && <canvas ref={canvasRef} className="br-viewport-canvas" />}
      {(failed || empty) && thumbnail && <img src={thumbnail} alt="" className="br-viewport-fallback" draggable={false} />}
      {empty && !thumbnail && <div className="br-viewport-empty">Nothing built yet</div>}
    </div>
  )
}
