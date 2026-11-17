import type * as THREE from 'three'

export interface EnvironmentMesh {
  root: THREE.Group
  apply: (scene: THREE.Scene) => void
  dispose: () => void
}

export function buildEnvironment(): EnvironmentMesh {
  throw new Error('not implemented yet')
}
