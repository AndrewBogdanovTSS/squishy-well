import { float, vec3, vec4 } from 'three/tsl'

/**
 * `@types/three` types TSL far more strictly than the runtime behaves —
 * `instancedBufferAttribute()` and storage element accessors come back as
 * `Node<unknown>`, which then refuses to slot into a material node.
 * All the casting noise lives here instead of being sprinkled through the
 * components, so there is exactly one place to delete when the types improve.
 */
export type Vec3Node = ReturnType<typeof vec3>
export type Vec4Node = ReturnType<typeof vec4>
export type FloatNode = ReturnType<typeof float>

export const asVec3 = (node: unknown): Vec3Node => node as Vec3Node
export const asVec4 = (node: unknown): Vec4Node => node as Vec4Node
export const asFloat = (node: unknown): FloatNode => node as FloatNode
