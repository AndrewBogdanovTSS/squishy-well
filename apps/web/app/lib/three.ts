import { COLS, VISIBLE_ROWS } from '@tetris/core'
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  cameraPosition,
  mix,
  mx_fractal_noise_float,
  normalView,
  normalWorld,
  positionGeometry,
  positionLocal,
  positionViewDirection,
  positionWorld,
  time,
  uniform,
  vec3,
} from 'three/tsl'
import { asFloat, asVec3, type FloatNode, type Vec3Node } from './tsl'

/**
 * Board space -> world space. The well is centred on the origin so the camera
 * never has to know how big the playfield is.
 */
export const worldX = (x: number): number => x - COLS / 2 + 0.5
export const worldY = (y: number): number => y - VISIBLE_ROWS / 2 + 0.5

export const WELL_WIDTH = COLS
export const WELL_HEIGHT = VISIBLE_ROWS
export const FLOOR_Y = worldY(0) - 0.5
export const CEILING_Y = worldY(VISIBLE_ROWS - 1) + 0.5

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

/**
 * The neon tubes lighting the well, as line segments in world space.
 *
 * One definition, two consumers that must never disagree: Well.vue hangs the
 * visible fixtures and the real point lights on these, and blockMaterial()
 * computes its scattering against the same segments. A tube that glows in one
 * place and scatters from another is the kind of wrong that looks merely
 * "off" and takes an hour to find.
 *
 * They sit well behind the blocks (z = 0) and clear of the back wall. That
 * offset is the whole trick, and it is why the well got deeper to fit them:
 * lights level with the stack only ever add highlights, because the scattering
 * term below asks whether a tube is *behind* a block from where the camera is
 * standing. At the old 0.62 well depth the answer was always no, the term
 * silently evaluated to zero, and the blocks stayed painted cubes.
 */
export type NeonTube = {
  /**
   * 'monitor' is the bar over the mouth of the well. It is lit by a directional
   * light living in GameScene, not by a lamp here, because it is the scene's
   * only shadow caster and its shadow is load-bearing for gameplay.
   * 'wall' tubes are soft area sources and cast nothing.
   */
  readonly kind: 'monitor' | 'wall'
  readonly a: readonly [number, number, number]
  readonly b: readonly [number, number, number]
  /** the two ends of this tube's gradient; it drifts between them over time */
  readonly color: string
  readonly colorB: string
  /** seconds per full colour cycle, and where in that cycle this tube starts */
  readonly cycle: number
  readonly phase: number
  readonly intensity: number
  /** distance at which this tube's contribution has fallen to a quarter */
  readonly range: number
}

const TUBE_Z = -1.5
const wellLeft = worldX(0) - 0.5
const wellRight = worldX(COLS - 1) + 0.5
const wellBottom = worldY(0) - 0.5
const wellTop = worldY(VISIBLE_ROWS - 1) + 0.5

// Clearance from the blocks comes from TUBE_Z, not from pushing the tubes out
// sideways: at this depth even a tube level with column 0 is ~1.5 away, which
// inverse-square falloff handles fine. Moving them sideways instead buries them
// inside the rails, where they light nothing and cannot be seen.
export const NEON_TUBES: readonly NeonTube[] = [
  // the top one is the brightest: every piece falls directly past it
  {
    kind: 'monitor',
    // Just above the mouth of the well, and deliberately given no fixture: in
    // shot the bar sat on the top edge and pulled the eye straight off the
    // board. The wash it throws down the well is the part worth keeping, so the
    // source stays out of frame and only its light is visible.
    a: [wellLeft + 0.2, wellTop + 1.2, TUBE_Z],
    b: [wellRight - 0.2, wellTop + 1.2, TUBE_Z],
    color: '#22d3ee',
    colorB: '#a5f3fc',
    cycle: 26,
    phase: 0,
    intensity: 1.5,
    // reaches the floor on purpose: the well is 20 units tall, and a range that
    // dies halfway down would leave the settled stack lit only from the sides
    range: 13,
  },
  {
    kind: 'wall',
    a: [wellLeft + 0.05, wellBottom + 0.2, TUBE_Z],
    b: [wellLeft + 0.05, wellTop - 0.6, TUBE_Z],
    color: '#38bdf8',
    colorB: '#22d3ee',
    cycle: 19,
    phase: 0,
    intensity: 0.62,
    range: 5.5,
  },
  // the two walls are deliberately different hues - it is what stops the stack
  // reading as one flat sheet of colour across the width of the well
  {
    kind: 'wall',
    a: [wellRight - 0.05, wellBottom + 0.2, TUBE_Z],
    b: [wellRight - 0.05, wellTop - 0.6, TUBE_Z],
    color: '#c084fc',
    colorB: '#f472b6',
    // offset from the left wall on purpose: in step, the two walls pulse as one
    // and the well reads as a single flashing box rather than two lit sides
    cycle: 23,
    phase: Math.PI * 0.66,
    intensity: 0.62,
    range: 5.5,
  },
]

/**
 * Where each tube currently sits in its own colour cycle, and the live uniforms
 * the block material scatters with.
 *
 * The tube's surface gradient is animated in the shader off `time`, but the
 * lamp it drives and the scattering it throws are plain values that have to be
 * pushed each frame - so they are computed here from the same cycle, and Well
 * calls updateTubeColors once per frame for all three consumers at once. Three
 * copies of "what colour is this tube right now" is exactly how a fixture ends
 * up glowing one colour and lighting the room another.
 */
const scatterColors = NEON_TUBES.map((tube) => uniform(new THREE.Color(tube.color)))
const _mixTarget = new THREE.Color()

export function tubeBlend(tube: NeonTube, elapsed: number): number {
  return Math.sin((elapsed / tube.cycle) * Math.PI * 2 + tube.phase) * 0.5 + 0.5
}

/** Advances every tube's colour and returns them, in NEON_TUBES order. */
export function updateTubeColors(elapsed: number): readonly THREE.Color[] {
  return NEON_TUBES.map((tube, i) => {
    const live = scatterColors[i]!.value as THREE.Color
    live.set(tube.color).lerp(_mixTarget.set(tube.colorB), tubeBlend(tube, elapsed))
    return live
  })
}

/**
 * The tube's own surface: a gradient between its two colours that slides along
 * its length, so the light looks like it is running through gas rather than
 * being switched on. Two waves at different rates and scales, because a single
 * sine reads as a mechanical pulse the moment you watch it for more than a few
 * seconds.
 */
export function tubeMaterial(tube: NeonTube): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: '#0b1020', roughness: 0.4 })

  // the cylinder is built along its own Y, so this runs the length of the tube
  const along = positionGeometry.y
  const drip = asFloat(along.mul(0.5).sub(time.mul(0.55)).sin().mul(0.5).add(0.5))
  const slow = asFloat(along.mul(0.13).add(time.mul(0.16)).sin().mul(0.5).add(0.5))
  const blend = asFloat(drip.mul(0.45).add(slow.mul(0.55)))

  const a = new THREE.Color(tube.color)
  const b = new THREE.Color(tube.colorB)
  const gradient = asVec3(mix(vec3(a.r, a.g, a.b), vec3(b.r, b.g, b.b), blend))
  material.emissiveNode = asVec3(gradient.mul(1.6 * tube.intensity))

  return material
}

/**
 * The block surface. Shared by the falling piece and the settled stack for the
 * same reason the geometry is: two copies of one look drift apart.
 *
 * What sells it as a solid with depth rather than a lit box is absorption over
 * a short distance - thin edges stay bright while thick centres go rich - under
 * a crisp clearcoat, over a body whose roughness is mottled by noise so no two
 * patches of a face catch the light identically.
 *
 * The emissive is weighted to the rim on purpose. A flat emissive at full
 * palette colour is what reads as overbright: it pushes every pixel past the
 * bloom threshold, which flattens the shading and leaves a line clear nothing
 * left to brighten. At the silhouette it reads as light escaping a solid, and
 * the impact flash gets its range back.
 *
 * Each call returns its own instance - the callers dispose what they made.
 */
export function blockMaterial(
  colorNode: Vec3Node,
  emissive: number,
  seed: FloatNode,
): THREE.MeshPhysicalNodeMaterial {
  const material = new THREE.MeshPhysicalNodeMaterial({
    metalness: 0,
    // Worth more now than it used to be: with the tubes sitting behind the
    // blocks there is finally something back there to transmit. Still short of
    // 1 - past about 0.7 the absorption starts eating the palette, and hue is
    // the channel the player actually reads the board by.
    transmission: 0.72,
    ior: 1.42,
    attenuationDistance: 1.55,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.2,
    iridescenceIOR: 1.25,
  })

  // Local space, not world: the falling piece moves every frame, and a
  // world-space field would make the pattern swim across its own faces. The
  // seed is what keeps neighbours from being clones - it is per instance and
  // constant, so a block's insides never change once it exists.
  const grainAt = asVec3(positionLocal.mul(6.5).add(vec3(seed, seed.mul(1.7), seed.mul(2.3))))
  const grain = asFloat(mx_fractal_noise_float(grainAt, 3))
  material.roughnessNode = asFloat(grain.mul(0.1).add(0.2).clamp(0.06, 0.5))

  // Thickness is what absorption is measured through, so varying it over the
  // volume is what gives the block insides: denser veins that swallow more
  // light next to clearer patches that let it through. A constant thickness is
  // why it read as tinted glass rather than as something with stuff in it.
  const veinAt = asVec3(positionLocal.mul(2.1).add(vec3(seed.mul(3.1), seed.mul(0.9), seed.mul(1.3))))
  const vein = asFloat(mx_fractal_noise_float(veinAt, 4))
  material.thicknessNode = asFloat(vein.mul(0.55).add(0.85).clamp(0.25, 1.6))

  material.colorNode = colorNode
  material.attenuationColorNode = colorNode

  // N·V is 1 face-on and 0 at the silhouette, so this is a plain fresnel ramp
  const rim = asFloat(normalView.dot(positionViewDirection).abs().saturate().oneMinus().pow(2.5))
  const glow = asVec3(colorNode.mul(emissive).mul(rim.mul(0.75).add(0.25)))

  // Emissive, because that is the one term added after the lighting model has
  // had its say - the physical model has no back-scatter of its own to hook.
  material.emissiveNode = asVec3(glow.add(scatterFromTubes().mul(colorNode).mul(SCATTER_STRENGTH)))

  return material
}

/** how much of the wrap-around light survives to the camera */
const SCATTER_STRENGTH = 1.05
/** bends the exit direction around the surface normal; 0 is pure straight-through */
const SCATTER_DISTORTION = 0.45
/**
 * Tightens the lobe. Kept deliberately low: at 3+ this is a strict backlight
 * and only blocks with a tube almost exactly behind them glow, which in a well
 * this tall is nearly none of them. Low turns it into wrap-around translucency,
 * so a piece lit from the side still carries light around its edge.
 */
const SCATTER_POWER = 1.9

/**
 * Cheap subsurface scattering: light that entered the far side of the block and
 * came out towards the eye. Real SSS integrates paths through a volume; this
 * takes the one path that matters for a lump of jelly with a lamp behind it,
 * which is why it costs three dot products per tube instead of a render pass.
 *
 * Each tube is treated as the line segment it actually is rather than a point,
 * so a piece halfway up the well is lit from the nearest stretch of the wall
 * rather than from wherever a point light happened to be nailed.
 */
function scatterFromTubes(): Vec3Node {
  const eye = asVec3(cameraPosition.sub(positionWorld).normalize())
  let total = asVec3(vec3(0, 0, 0))

  for (const [i, tube] of NEON_TUBES.entries()) {
    const a = vec3(...tube.a)
    const ab = vec3(tube.b[0] - tube.a[0], tube.b[1] - tube.a[1], tube.b[2] - tube.a[2])
    const lengthSq = Math.max(
      (tube.b[0] - tube.a[0]) ** 2 + (tube.b[1] - tube.a[1]) ** 2 + (tube.b[2] - tube.a[2]) ** 2,
      1e-6,
    )

    // closest point on the tube, so the segment lights like a strip not a bulb
    const t = asFloat(positionWorld.sub(a).dot(ab).div(lengthSq).clamp(0, 1))
    const toLight = asVec3(a.add(ab.mul(t)).sub(positionWorld))
    const distance = asFloat(toLight.length())
    const direction = asVec3(toLight.div(distance.max(0.001)))

    const exit = asVec3(direction.add(normalWorld.mul(SCATTER_DISTORTION)).normalize())
    const behind = asFloat(eye.dot(exit.negate()).saturate().pow(SCATTER_POWER))
    const falloff = asFloat(distance.div(tube.range).pow(2).add(1).reciprocal())

    // through THREE.Color so the scatter lands in the same working colour space
    // the fixture's own emissive does, rather than a raw sRGB triple
    total = asVec3(total.add(asVec3(scatterColors[i]!).mul(behind.mul(falloff).mul(tube.intensity))))
  }

  return total
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
