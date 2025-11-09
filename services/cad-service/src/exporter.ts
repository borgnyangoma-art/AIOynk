import { promises as fs } from 'fs'
import path from 'path'

import { Model3D, ExportFormat } from './types'

const toOBJ = (model: Model3D) => {
  const lines: string[] = [`# ${model.name}`]
  for (let i = 0; i < model.mesh.vertices.length; i += 3) {
    lines.push(`v ${model.mesh.vertices[i]} ${model.mesh.vertices[i + 1]} ${model.mesh.vertices[i + 2]}`)
  }
  model.mesh.faces.forEach((face) => {
    const indices = face.map((idx) => idx + 1).join(' ')
    lines.push(`f ${indices}`)
  })
  return lines.join('\n')
}

const toSTL = (model: Model3D) => {
  const lines: string[] = [`solid ${model.name}`]
  model.mesh.faces.forEach((face) => {
    if (face.length < 3) return
    const idx = face[0] * 3
    lines.push('  facet normal 0 0 0')
    lines.push('    outer loop')
    lines.push(`      vertex ${model.mesh.vertices[idx]} ${model.mesh.vertices[idx + 1]} ${model.mesh.vertices[idx + 2]}`)
    lines.push('    endloop')
    lines.push('  endfacet')
  })
  lines.push(`endsolid ${model.name}`)
  return lines.join('\n')
}

const toGLTF = (model: Model3D) =>
  JSON.stringify(
    {
      asset: { version: '2.0', generator: 'AIO CAD Service' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: model.name }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0 },
              indices: 1,
            },
          ],
        },
      ],
      buffers: [],
      bufferViews: [],
      accessors: [],
    },
    null,
    2,
  )

const toPLY = (model: Model3D) => {
  const header = [
    'ply',
    'format ascii 1.0',
    `element vertex ${model.mesh.vertices.length / 3}`,
    'property float x',
    'property float y',
    'property float z',
    `element face ${model.mesh.faces.length}`,
    'property list uchar int vertex_indices',
    'end_header',
  ]
  const vertices: string[] = []
  for (let i = 0; i < model.mesh.vertices.length; i += 3) {
    vertices.push(`${model.mesh.vertices[i]} ${model.mesh.vertices[i + 1]} ${model.mesh.vertices[i + 2]}`)
  }
  const faces = model.mesh.faces.map((face) => `${face.length} ${face.join(' ')}`)
  return [...header, ...vertices, ...faces].join('\n')
}

const writers: Record<ExportFormat, (model: Model3D) => string> = {
  obj: toOBJ,
  stl: toSTL,
  gltf: toGLTF,
  ply: toPLY,
}

export const exportModel = async (model: Model3D, format: ExportFormat, outputDir: string) => {
  const writer = writers[format]
  const payload = writer(model)
  await fs.mkdir(outputDir, { recursive: true })
  const fileName = `${model.id}-${Date.now()}.${format}`
  const filePath = path.join(outputDir, fileName)
  await fs.writeFile(filePath, payload, 'utf-8')
  return { fileName, filePath, size: payload.length }
}
