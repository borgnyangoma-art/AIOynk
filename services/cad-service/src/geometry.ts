import { v4 as uuidv4 } from 'uuid'
import * as THREE from 'three'

import { Mesh, Model3D, PrimitiveType, Transform } from './types'

const geometryToMesh = (geometry: THREE.BufferGeometry): Mesh => {
  const position = geometry.getAttribute('position')
  const vertices = Array.from(position.array as ArrayLike<number>)

  const faces: number[][] = []
  if (geometry.index) {
    const indexArray = geometry.index.array as ArrayLike<number>
    for (let i = 0; i < indexArray.length; i += 3) {
      faces.push([indexArray[i], indexArray[i + 1], indexArray[i + 2]])
    }
  } else {
    for (let i = 0; i < vertices.length / 3; i += 3) {
      faces.push([i, i + 1, i + 2])
    }
  }

  geometry.dispose()
  return { vertices, faces }
}

const buildBox = (width = 1, height = 1, depth = 1): Mesh => geometryToMesh(new THREE.BoxGeometry(width, height, depth))

const buildSphere = (radius = 0.5, segments = 16): Mesh =>
  geometryToMesh(new THREE.SphereGeometry(radius, segments, segments))

const buildCylinder = (radius = 0.5, height = 1, segments = 16): Mesh =>
  geometryToMesh(new THREE.CylinderGeometry(radius, radius, height, segments))

const buildTorus = (radius = 0.7, tube = 0.2, radialSegments = 16, tubularSegments = 12): Mesh =>
  geometryToMesh(new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments))

const primitiveFactory: Record<PrimitiveType, (params: Record<string, number>) => Mesh> = {
  cube: (params) => buildBox(params.width ?? 1, params.height ?? 1, params.depth ?? 1),
  sphere: (params) => buildSphere(params.radius ?? 0.5, params.segments ?? 24),
  cylinder: (params) => buildCylinder(params.radius ?? 0.5, params.height ?? 1, params.segments ?? 24),
  torus: (params) => buildTorus(params.radius ?? 0.7, params.tube ?? 0.2, params.radialSegments ?? 16, params.tubularSegments ?? 24),
  custom: () => buildBox(1, 1, 1),
}

export const createPrimitive = (type: PrimitiveType, params: Record<string, number> = {}): Model3D => {
  const mesh = primitiveFactory[type](params)
  return {
    id: uuidv4(),
    name: `${type} model`,
    type,
    parameters: params,
    mesh,
    material: {
      color: typeof params.colorHex === 'string' ? params.colorHex : '#cccccc',
      metalness: params.metalness ?? 0.2,
      roughness: params.roughness ?? 0.7,
    },
    transformations: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const generateModelFromDescription = (description: string, type?: PrimitiveType, parameters: Record<string, number> = {}) => {
  const text = (description || '').toLowerCase()
  let resolvedType: PrimitiveType = type || 'cube'
  if (!type) {
    if (text.includes('sphere') || text.includes('ball')) resolvedType = 'sphere'
    else if (text.includes('cylinder')) resolvedType = 'cylinder'
    else if (text.includes('torus') || text.includes('donut')) resolvedType = 'torus'
    else if (text.includes('ring')) resolvedType = 'torus'
  }

  const model = createPrimitive(resolvedType, parameters)
  model.description = description
  model.name = description?.slice(0, 48) || `${resolvedType} concept`
  return model
}

export const applyTransformation = (transform: Transform, payload: { type: string; value: any }) => {
  if (payload.type === 'translate') {
    transform.position = [
      transform.position[0] + (payload.value?.x || 0),
      transform.position[1] + (payload.value?.y || 0),
      transform.position[2] + (payload.value?.z || 0),
    ]
  } else if (payload.type === 'rotate') {
    transform.rotation = [
      transform.rotation[0] + (payload.value?.x || 0),
      transform.rotation[1] + (payload.value?.y || 0),
      transform.rotation[2] + (payload.value?.z || 0),
    ]
  } else if (payload.type === 'scale') {
    transform.scale = [
      transform.scale[0] * (payload.value?.x ?? 1),
      transform.scale[1] * (payload.value?.y ?? 1),
      transform.scale[2] * (payload.value?.z ?? 1),
    ]
  }
}

export const extrudeModel = (model: Model3D, depth = 1) => {
  if (model.type !== 'cube') {
    model.parameters.extrusion = depth
    return
  }
  model.mesh = buildBox(model.parameters.width ?? 1, depth, model.parameters.depth ?? 1)
  model.parameters.height = depth
}

export type MeshEditOperation =
  | { operation: 'move'; vertexIndex: number; value: { x?: number; y?: number; z?: number } }
  | { operation: 'delete'; vertexIndex: number }

export const editMesh = (model: Model3D, op: MeshEditOperation) => {
  const { vertices, faces } = model.mesh
  if (op.operation === 'move') {
    const target = op.vertexIndex * 3
    vertices[target] += op.value.x ?? 0
    vertices[target + 1] += op.value.y ?? 0
    vertices[target + 2] += op.value.z ?? 0
  } else if (op.operation === 'delete') {
    model.mesh.faces = faces.filter((face) => !face.includes(op.vertexIndex))
  }
  model.updatedAt = new Date().toISOString()
}
