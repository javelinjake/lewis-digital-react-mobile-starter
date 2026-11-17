import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type QualityTier = 'high' | 'low'

export interface SceneKitOptions {
  quality?: QualityTier
  /** Transparent canvas so page backgrounds show through (garage thumbnails, previews). */
  transparent?: boolean
  /** Soft sun shadow, only honoured on the high tier. */
  shadows?: boolean
}

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available on this device.')
    this.name = 'WebGLUnavailableError'
    this.cause = cause
  }
}

export interface SceneKit {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  hemi: THREE.HemisphereLight
  sun: THREE.DirectionalLight
  readonly quality: QualityTier
  /** Match the canvas to its CSS size. Called automatically when the canvas resizes. */
  resize: () => void
  render: () => void
  setQuality: (quality: QualityTier) => void
  /** Half-size of the area the sun shadow covers, metres. */
  setShadowExtent: (half: number) => void
  /** Keep the sun and its shadow centred on a point (for example the car). */
  followSun: (centre: readonly [number, number, number]) => void
  setFog: (colour: string | null, near?: number, far?: number) => void
  dispose: () => void
}

const SUN_OFFSET = new THREE.Vector3(-3.5, 7, 4)

export function createSceneKit(canvas: HTMLCanvasElement, opts: SceneKitOptions = {}): SceneKit {
  let quality: QualityTier = opts.quality ?? 'high'
  const wantShadows = opts.shadows ?? false

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality === 'high',
      alpha: opts.transparent ?? false,
      powerPreference: 'high-performance',
    })
  }
  catch (error) {
    throw new WebGLUnavailableError(error)
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  if (opts.transparent)
    renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 600)
  camera.position.set(1.4, 0.9, 1.6)

  const hemi = new THREE.HemisphereLight(0xCDE8FF, 0x8A735C, 0.85)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xFFF3DC, 2.1)
  sun.position.copy(SUN_OFFSET)
  sun.target.position.set(0, 0, 0)
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.01
  sun.shadow.radius = 3
  scene.add(sun, sun.target)

  // A studio environment gives the plastic its soft glossy reflections without any asset download.
  let envTexture: THREE.Texture | null = null
  try {
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    envTexture = pmrem.fromScene(room, 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.62
    room.dispose()
    pmrem.dispose()
  }
  catch {
    envTexture = null
  }

  const applyQuality = () => {
    const shadows = wantShadows && quality === 'high'
    renderer.shadowMap.enabled = shadows
    renderer.shadowMap.type = THREE.PCFShadowMap
    sun.castShadow = shadows
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25))
  }
  applyQuality()

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  let observer: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize)
    observer.observe(canvas)
  }

  const kit: SceneKit = {
    renderer,
    scene,
    camera,
    hemi,
    sun,
    get quality() {
      return quality
    },
    resize,
    render: () => renderer.render(scene, camera),
    setQuality(next) {
      if (next === quality)
        return
      quality = next
      applyQuality()
      resize()
      // Shadow map toggles need materials to recompile once.
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m))
          m.forEach(x => (x.needsUpdate = true))
        else if (m)
          m.needsUpdate = true
      })
    },
    setShadowExtent(half) {
      const cam = sun.shadow.camera
      cam.left = -half
      cam.right = half
      cam.top = half
      cam.bottom = -half
      cam.near = 0.5
      cam.far = half * 6
      cam.updateProjectionMatrix()
    },
    followSun(centre) {
      sun.target.position.set(centre[0], centre[1], centre[2])
      sun.position.set(centre[0] + SUN_OFFSET.x, centre[1] + SUN_OFFSET.y, centre[2] + SUN_OFFSET.z)
      sun.target.updateMatrixWorld()
    },
    setFog(colour, near = 20, far = 90) {
      scene.fog = colour ? new THREE.Fog(colour, near, far) : null
    },
    dispose() {
      observer?.disconnect()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry && !mesh.userData.sharedGeometry)
          mesh.geometry.dispose()
      })
      sun.shadow.map?.dispose()
      envTexture?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
  kit.setShadowExtent(3)
  return kit
}
