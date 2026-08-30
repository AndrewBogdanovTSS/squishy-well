import * as THREE from 'three/webgpu'
import {
  Fn,
  If,
  float,
  hash,
  instanceIndex,
  instancedArray,
  instancedBufferAttribute,
  mix,
  normalize,
  uint,
  uniform,
  uniformArray,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { Cell, PieceType } from '@tetris/core'
import { liveFeel } from '~/config/feel'
import { FLOOR_Y, worldX, worldY } from '~/lib/three'
import { asFloat, asVec3, asVec4 } from '~/lib/tsl'
import { PALETTE } from '~/config/palette'

export interface ShatterVFX {
  object: THREE.Object3D
  /** call once per frame with dt in seconds */
  update: (renderer: THREE.Renderer | null, dt: number) => void
  emit: (cells: Cell[]) => void
  dispose: () => void
  readonly mode: 'gpu' | 'cpu' | 'off'
  readonly capacity: number
}

/** at most four rows can be cleared at once */
const MAX_CELLS = 40

function colorOf(type: PieceType, target: THREE.Color): THREE.Color {
  return target.set(PALETTE[type])
}

/* ------------------------------------------------------------------ GPU ---*/

/**
 * A fixed-size pool allocated once, filled by a ring cursor. Nothing is
 * allocated at emit time — spawning a particle system per line clear is how
 * you get a frame hitch exactly when the game is at its most dramatic.
 */
function createGpuVFX(pool: number, perCell: number): ShatterVFX {
  const bufPos = instancedArray(pool, 'vec3')
  const bufVel = instancedArray(pool, 'vec3')
  const bufColor = instancedArray(pool, 'vec3')
  const bufLife = instancedArray(pool, 'vec2') // x = age, y = lifetime (0 = dead)

  const uCursor = uniform(0, 'uint')
  const uActive = uniform(0, 'uint')
  const uSeed = uniform(0, 'uint')
  const uPerCell = uniform(perCell, 'uint')
  const uDt = uniform(0)
  const uSpeed = uniform(liveFeel.particles.speed)

  const origins = Array.from({ length: MAX_CELLS }, () => new THREE.Vector3())
  const colors = Array.from({ length: MAX_CELLS }, () => new THREE.Vector3())
  const uOrigins = uniformArray(origins, 'vec3')
  const uColors = uniformArray(colors, 'vec3')

  const emitNode = Fn(() => {
    If(instanceIndex.lessThan(uActive), () => {
      const cell = instanceIndex.div(uPerCell)
      const slot = uCursor.add(instanceIndex).mod(uint(pool))

      const r1 = hash(instanceIndex.add(uSeed))
      const r2 = hash(instanceIndex.add(uSeed).add(uint(7919)))
      const r3 = hash(instanceIndex.add(uSeed).add(uint(104729)))
      const r4 = hash(instanceIndex.add(uSeed).add(uint(15485863)))

      const origin = asVec3(uOrigins.element(cell))
      const jitter = vec3(r1.sub(0.5), r2.sub(0.5), r3.sub(0.5)).mul(0.95)
      bufPos.element(slot).assign(origin.add(jitter))

      // radially outward from the cell, biased upwards so debris arcs
      const dir = normalize(vec3(r1.sub(0.5), r2.sub(0.15), r3.sub(0.5)).add(vec3(0, 0.25, 0)))
      bufVel.element(slot).assign(dir.mul(uSpeed.mul(r4.mul(0.7).add(0.55))))
      bufColor.element(slot).assign(asVec3(uColors.element(cell)))
      bufLife
        .element(slot)
        .assign(vec2(0, mix(float(liveFeel.particles.lifeMin), float(liveFeel.particles.lifeMax), r2)))
    })
  })().compute(MAX_CELLS * perCell)

  const updateNode = Fn(() => {
    const life = bufLife.element(instanceIndex)
    If(life.y.greaterThan(0), () => {
      const p = bufPos.element(instanceIndex)
      const v = bufVel.element(instanceIndex)

      const nv = v
        .add(vec3(0, float(liveFeel.particles.gravity), 0).mul(uDt))
        .mul(float(1).sub(uDt.mul(float(liveFeel.particles.drag))).max(0))
      const np = p.add(nv.mul(uDt))

      // bounce off the floor of the well instead of falling out of the world
      If(np.y.lessThan(float(FLOOR_Y)), () => {
        bufPos.element(instanceIndex).assign(vec3(np.x, float(FLOOR_Y), np.z))
        bufVel
          .element(instanceIndex)
          .assign(vec3(nv.x.mul(0.7), nv.y.abs().mul(float(liveFeel.particles.bounce)), nv.z.mul(0.7)))
      })
      If(np.y.greaterThanEqual(float(FLOOR_Y)), () => {
        bufPos.element(instanceIndex).assign(np)
        bufVel.element(instanceIndex).assign(nv)
      })

      const age = life.x.add(uDt)
      If(age.greaterThan(life.y), () => {
        bufLife.element(instanceIndex).assign(vec2(0, 0))
      })
      If(age.lessThanEqual(life.y), () => {
        bufLife.element(instanceIndex).assign(vec2(age, life.y))
      })
    })
  })().compute(pool)

  const posAttr = bufPos.toAttribute()
  const lifeAttr = bufLife.toAttribute()
  const colorAttr = bufColor.toAttribute()

  const alive = lifeAttr.y.greaterThan(0).select(float(1), float(0))
  const norm = lifeAttr.x.div(lifeAttr.y.max(0.0001)).clamp(0, 1)
  const fade = norm.oneMinus()

  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  material.positionNode = asVec3(posAttr)
  // values above 1.0 are what bloom actually picks up
  material.colorNode = asVec4(vec4(colorAttr.mul(fade.mul(2.6).add(0.4)), fade.mul(alive)))
  material.scaleNode = asFloat(fade.mul(alive).mul(0.24))

  const sprite = new THREE.Sprite(material)
  sprite.count = pool
  sprite.frustumCulled = false
  sprite.renderOrder = 10
  ;(sprite as unknown as { isSprite: boolean }).isSprite = true

  let cursor = 0
  let seed = 1
  let pendingEmit = false
  const _c = new THREE.Color()

  return {
    object: sprite,
    mode: 'gpu',
    capacity: pool,
    emit(cells: Cell[]) {
      const n = Math.min(cells.length, MAX_CELLS)
      for (let i = 0; i < n; i++) {
        const c = cells[i]!
        origins[i]!.set(worldX(c.x), worldY(c.y), 0)
        colorOf(c.type, _c)
        colors[i]!.set(_c.r, _c.g, _c.b)
      }
      uActive.value = n * perCell
      uSeed.value = (seed = (seed * 1664525 + 1013904223) >>> 0)
      uCursor.value = cursor
      cursor = (cursor + n * perCell) % pool
      pendingEmit = true
    },
    update(renderer, dt) {
      if (!renderer) return
      if (pendingEmit) {
        renderer.compute(emitNode)
        pendingEmit = false
        uActive.value = 0
      }
      uDt.value = Math.min(dt, 0.05)
      renderer.compute(updateNode)
    },
    dispose() {
      material.dispose()
    },
  }
}

/* ------------------------------------------------------------------ CPU ---*/

/**
 * The insurance policy. The WebGL2 backend of WebGPURenderer renders TSL
 * materials perfectly well but has no compute shaders at all, so the whole
 * simulation moves to a typed array here. Written once, never touched again.
 */
function createCpuVFX(pool: number, perCell: number): ShatterVFX {
  const pos = new Float32Array(pool * 3)
  const vel = new Float32Array(pool * 3)
  const life = new Float32Array(pool * 2)
  const colorArray = new Float32Array(pool * 3)
  const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
  colorAttr.setUsage(THREE.DynamicDrawUsage)

  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  material.colorNode = asVec3(instancedBufferAttribute(colorAttr))

  const mesh = new THREE.InstancedMesh(geometry, material, pool)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.count = pool
  mesh.renderOrder = 10

  const _m = new THREE.Matrix4()
  const _v = new THREE.Vector3()
  const _q = new THREE.Quaternion()
  const _s = new THREE.Vector3()
  const _c = new THREE.Color()

  let cursor = 0
  const f = liveFeel.particles

  // start with every particle dead and scaled to zero
  for (let i = 0; i < pool; i++) {
    _s.setScalar(0)
    mesh.setMatrixAt(i, _m.compose(_v.set(0, 0, 0), _q, _s))
  }

  return {
    object: mesh,
    mode: 'cpu',
    capacity: pool,
    emit(cells: Cell[]) {
      const n = Math.min(cells.length, MAX_CELLS)
      for (let ci = 0; ci < n; ci++) {
        const cell = cells[ci]!
        colorOf(cell.type, _c)
        const ox = worldX(cell.x)
        const oy = worldY(cell.y)
        for (let k = 0; k < perCell; k++) {
          const i = cursor
          cursor = (cursor + 1) % pool
          pos[i * 3] = ox + (Math.random() - 0.5) * 0.95
          pos[i * 3 + 1] = oy + (Math.random() - 0.5) * 0.95
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.95
          const dx = Math.random() - 0.5
          const dy = Math.random() - 0.15 + 0.25
          const dz = Math.random() - 0.5
          const len = Math.hypot(dx, dy, dz) || 1
          const speed = f.speed * (0.55 + Math.random() * 0.7)
          vel[i * 3] = (dx / len) * speed
          vel[i * 3 + 1] = (dy / len) * speed
          vel[i * 3 + 2] = (dz / len) * speed
          life[i * 2] = 0
          life[i * 2 + 1] = f.lifeMin + Math.random() * (f.lifeMax - f.lifeMin)
          colorArray[i * 3] = _c.r
          colorArray[i * 3 + 1] = _c.g
          colorArray[i * 3 + 2] = _c.b
        }
      }
      colorAttr.needsUpdate = true
    },
    update(_renderer, dtRaw) {
      const dt = Math.min(dtRaw, 0.05)
      const drag = Math.max(0, 1 - dt * f.drag)
      for (let i = 0; i < pool; i++) {
        const lifetime = life[i * 2 + 1]!
        if (lifetime <= 0) continue
        const age = life[i * 2]! + dt
        if (age > lifetime) {
          life[i * 2 + 1] = 0
          _s.setScalar(0)
          mesh.setMatrixAt(i, _m.compose(_v.set(0, 0, 0), _q, _s))
          continue
        }
        life[i * 2] = age

        let vx = vel[i * 3]! * drag
        let vy = (vel[i * 3 + 1]! + f.gravity * dt) * drag
        let vz = vel[i * 3 + 2]! * drag
        const px = pos[i * 3]! + vx * dt
        let py = pos[i * 3 + 1]! + vy * dt
        const pz = pos[i * 3 + 2]! + vz * dt
        if (py < FLOOR_Y) {
          py = FLOOR_Y
          vy = Math.abs(vy) * f.bounce
          vx *= 0.7
          vz *= 0.7
        }
        pos[i * 3] = px
        pos[i * 3 + 1] = py
        pos[i * 3 + 2] = pz
        vel[i * 3] = vx
        vel[i * 3 + 1] = vy
        vel[i * 3 + 2] = vz

        const fade = 1 - age / lifetime
        _s.setScalar(fade)
        mesh.setMatrixAt(i, _m.compose(_v.set(px, py, pz), _q, _s))
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      mesh.dispose()
    },
  }
}

function createNullVFX(): ShatterVFX {
  return {
    object: new THREE.Object3D(),
    mode: 'off',
    capacity: 0,
    emit: () => {},
    update: () => {},
    dispose: () => {},
  }
}

/**
 * Picks the implementation. Components never learn which one they got —
 * that is the whole point of putting the branch here.
 */
export function createShatterVFX(opts: {
  backend: 'webgpu' | 'webgl' | 'unknown'
  perCell: number
}): ShatterVFX {
  if (opts.perCell <= 0) return createNullVFX()
  const f = liveFeel.particles
  if (opts.backend === 'webgpu') {
    const pool = opts.perCell >= 256 ? f.poolHigh : f.poolMedium
    return createGpuVFX(pool, opts.perCell)
  }
  return createCpuVFX(f.poolCpu, Math.min(opts.perCell, 24))
}
