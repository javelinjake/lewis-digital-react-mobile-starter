import type { Ref } from 'react'
import type { ContactPreview } from '@/features/builder/logic/contact-preview'
import type { OrbitState, ViewPreset } from '@/features/builder/logic/orbit'
import type { PlacementCandidate } from '@/game/build/candidates'
import type { CarDocument, Forward } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot } from '@/game/lattice'
import { useEffect, useRef, useState } from 'react'
import { registerRings } from '@/features/builder/dev-hook'
import { fromPose, toPose } from '@/features/builder/logic/orbit'
import { WebGLUnavailableError } from '@/render'
import { BuilderViewport } from './controller'

export interface ViewportHandle {
  viewPreset: (kind: ViewPreset) => void
  cycle: (direction: 1 | -1) => void
  commitArmed: () => void
  cancelArmed: () => void
  getYaw: () => number
}

export interface PlacementView {
  def: PartDefinition
  rotation: Rot
  candidates: PlacementCandidate[]
  mirrorPlane2: number | null
}

export interface ViewportProps {
  handleRef: Ref<ViewportHandle>
  doc: CarDocument
  loose: ReadonlySet<string>
  selection: ReadonlySet<string>
  issues: ReadonlySet<string>
  highlight: ReadonlySet<string>
  placement: PlacementView | null
  forwardArrow: Forward | null
  contacts: ContactPreview | null
  reducedMotion: boolean
  onTapPart: (id: string | null, additive: boolean) => void
  onCommit: (candidate: PlacementCandidate) => void
  onCameraSettled: (pose: ReturnType<typeof toPose>) => void
  onArmed: (state: { index: number, count: number } | null) => void
}

/** Owns the canvas and the imperative viewport controller. React only pushes state in; nothing per frame. */
export function ViewportPane(props: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ctrl, setCtrl] = useState<BuilderViewport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host)
      return
    // A fresh canvas per mount: Strict Mode (and context loss) must never reuse a canvas whose WebGL context was released.
    const canvas = document.createElement('canvas')
    canvas.className = 'bd-canvas'
    canvas.setAttribute('aria-label', '3D view of your car. Drag to look around, pinch to zoom.')
    canvas.dataset.testid = 'builder-canvas'
    host.appendChild(canvas)
    let viewport: BuilderViewport
    try {
      viewport = new BuilderViewport(canvas, {
        onTapPart: (id, add) => latest.current.onTapPart(id, add),
        onCommit: c => latest.current.onCommit(c),
        onCameraSettled: (pose: OrbitState) => latest.current.onCameraSettled(toPose(pose)),
        onArmed: s => latest.current.onArmed(s),
        onContextLost: () => setEpoch(e => e + 1),
      }, latest.current.reducedMotion)
    }
    catch (e) {
      canvas.remove()
      setError(e instanceof WebGLUnavailableError ? 'This device can’t show 3D right now. Your car is safe; try the Garage or restart the app.' : 'The builder view could not start.')
      return
    }
    const saved = latest.current.doc.ui.camera
    viewport.setInitialPose(saved ? fromPose(saved) : null)
    setError(null)
    setCtrl(viewport)
    registerRings(() => viewport.ringScreenPositions(), () => viewport.ringCount())
    return () => {
      registerRings(null, null)
      setCtrl(null)
      viewport.dispose()
      canvas.remove()
    }
  }, [epoch])

  useEffect(() => {
    if (!ctrl)
      return
    ctrl.setDocument(props.doc, props.loose)
  }, [ctrl, props.doc.revisionId, props.doc.carId, props.loose]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => ctrl?.setSelection(props.selection), [ctrl, props.selection])
  useEffect(() => ctrl?.setIssues(props.issues), [ctrl, props.issues])
  useEffect(() => ctrl?.setHighlight(props.highlight), [ctrl, props.highlight])
  useEffect(() => ctrl?.setReducedMotion(props.reducedMotion), [ctrl, props.reducedMotion])
  useEffect(() => ctrl?.setPlacement(props.placement), [ctrl, props.placement])
  useEffect(() => ctrl?.setOverlays({ forward: props.forwardArrow, contacts: props.contacts }), [ctrl, props.forwardArrow, props.contacts, props.doc.revisionId])

  useEffect(() => {
    if (typeof props.handleRef === 'function' || !props.handleRef)
      return
    props.handleRef.current = ctrl
      ? {
          viewPreset: k => ctrl.viewPreset(k),
          cycle: d => ctrl.cycle(d),
          commitArmed: () => ctrl.commitArmed(),
          cancelArmed: () => ctrl.cancelArmed(),
          getYaw: () => ctrl.getYaw(),
        }
      : null
  }, [ctrl, props.handleRef])

  return (
    <>
      <div ref={hostRef} className="bd-canvas-host" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center" role="alert">
          <p className="br-panel max-w-sm text-base">{error}</p>
        </div>
      )}
    </>
  )
}
