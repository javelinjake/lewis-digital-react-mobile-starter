import type * as THREE from 'three'
import type { EditContext } from '@/game/build/doc'
/** Environment scenes for the render preview (fake environments until the real ones are authored). */
import type { SceneKit } from '@/render'

export function installEnvScenes(
  _name: string,
  _kit: SceneKit,
  _frame: (min: THREE.Vector3, max: THREE.Vector3) => void,
  _setAngles: (a: { yaw: number, pitch: number }) => void,
  _ctx: EditContext,
  _params: URLSearchParams,
): boolean {
  return false
}
