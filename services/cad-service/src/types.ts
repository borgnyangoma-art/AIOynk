export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'torus' | 'custom'

export type Material = {
  color: string
  metalness: number
  roughness: number
}

export type Transform = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type Mesh = {
  vertices: number[]
  faces: number[][]
  normals?: number[]
}

export type Model3D = {
  id: string
  name: string
  description?: string
  type: PrimitiveType
  parameters: Record<string, number>
  mesh: Mesh
  material: Material
  transformations: Transform
  createdAt: string
  updatedAt: string
}

export type MeasurementUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft'

export type Measurement = {
  type: 'distance' | 'angle' | 'area' | 'volume'
  value: number
  unit: MeasurementUnit
  from?: [number, number, number]
  to?: [number, number, number]
  label?: string
}

export type ViewDefinition = {
  id: string
  label: string
  projection: 'perspective' | 'orthographic'
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  options?: Record<string, number>
}

export type ExportFormat = 'obj' | 'stl' | 'gltf' | 'ply'
