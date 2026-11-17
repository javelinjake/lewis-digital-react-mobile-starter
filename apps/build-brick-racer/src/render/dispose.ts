import type * as THREE from 'three'

/** Dispose geometries owned by an object tree. Cached shared materials are left alone. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry && !mesh.userData.sharedGeometry)
      mesh.geometry.dispose()
  })
}

export function countTriangles(obj: THREE.Object3D): number {
  let n = 0
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    const position = mesh.isMesh ? mesh.geometry?.getAttribute('position') : undefined
    if (position) {
      const index = mesh.geometry.getIndex()
      n += (index ? index.count : position.count) / 3
    }
  })
  return n
}
