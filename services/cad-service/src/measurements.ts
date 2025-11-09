import { Measurement, MeasurementUnit, Model3D } from './types'

const unitConversions: Record<MeasurementUnit, number> = {
  mm: 1000,
  cm: 100,
  m: 1,
  in: 39.3701,
  ft: 3.28084,
}

const convert = (meters: number, unit: MeasurementUnit) => Number((meters * unitConversions[unit]).toFixed(4))

export const calculateMeasurements = (model: Model3D): Measurement[] => {
  const vertices = model.mesh.vertices
  if (!vertices.length) {
    return []
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i])
    minY = Math.min(minY, vertices[i + 1])
    minZ = Math.min(minZ, vertices[i + 2])
    maxX = Math.max(maxX, vertices[i])
    maxY = Math.max(maxY, vertices[i + 1])
    maxZ = Math.max(maxZ, vertices[i + 2])
  }

  const width = maxX - minX
  const height = maxY - minY
  const depth = maxZ - minZ
  const surfaceArea = 2 * (width * height + width * depth + height * depth)
  const volume = width * height * depth

  const distances: Measurement[] = ['mm', 'cm', 'm', 'in', 'ft'].flatMap((unit) => [
    {
      type: 'distance',
      label: 'width',
      value: convert(width, unit as MeasurementUnit),
      unit: unit as MeasurementUnit,
      from: [minX, 0, 0],
      to: [maxX, 0, 0],
    },
    {
      type: 'distance',
      label: 'height',
      value: convert(height, unit as MeasurementUnit),
      unit: unit as MeasurementUnit,
      from: [0, minY, 0],
      to: [0, maxY, 0],
    },
    {
      type: 'distance',
      label: 'depth',
      value: convert(depth, unit as MeasurementUnit),
      unit: unit as MeasurementUnit,
      from: [0, 0, minZ],
      to: [0, 0, maxZ],
    },
  ])

  const area: Measurement[] = ['m', 'ft'].map((unit) => ({
    type: 'area',
    label: 'surface_area',
    value: convert(surfaceArea, unit as MeasurementUnit),
    unit: unit as MeasurementUnit,
  }))

  const volumes: Measurement[] = ['m', 'ft'].map((unit) => ({
    type: 'volume',
    label: 'volume',
    value: convert(volume, unit as MeasurementUnit),
    unit: unit as MeasurementUnit,
  }))

  return [...distances, ...area, ...volumes]
}
