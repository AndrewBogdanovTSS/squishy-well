import { COLS, VISIBLE_ROWS } from '@tetris/core'
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * Board space -> world space. The well is centred on the origin so the camera
 * never has to know how big the playfield is.
 */
export const worldX = (x: number): number => x - COLS / 2 + 0.5
export const worldY = (y: number): number => y - VISIBLE_ROWS / 2 + 0.5

export const WELL_WIDTH = COLS
export const WELL_HEIGHT = VISIBLE_ROWS
export const FLOOR_Y = worldY(0) - 0.5

let sharedGeometry: THREE.BufferGeometry | null = null

/** One chamfered cube, created once. Bevels are what give the blocks volume. */
export function blockGeometry(): THREE.BufferGeometry {
  if (!sharedGeometry) sharedGeometry = new RoundedBoxGeometry(0.92, 0.92, 0.92, 3, 0.12)
  return sharedGeometry
}

export function disposeSharedGeometry(): void {
  sharedGeometry?.dispose()
  sharedGeometry = null
}

/** Fits the camera so the well always occupies the same share of the viewport. */
export function fitCamera(
  camera: THREE.PerspectiveCamera,
  aspect: number,
  margin = 1.2,
): void {
  const vFov = (camera.fov * Math.PI) / 180
  const halfH = (WELL_HEIGHT / 2) * margin
  const halfW = (WELL_WIDTH / 2) * margin
  const distH = halfH / Math.tan(vFov / 2)
  const distW = halfW / (Math.tan(vFov / 2) * Math.max(aspect, 0.0001))
  camera.position.z = Math.max(distH, distW)
  camera.updateProjectionMatrix()
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
