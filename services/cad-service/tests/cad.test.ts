import { promises as fs } from 'fs'
import path from 'path'
import request from 'supertest'

import app from '../src/index'

describe('CAD Service', () => {
  const storageDir = path.join(__dirname, '../../../storage')

  afterAll(async () => {
    await fs.rm(path.join(storageDir, 'cad-exports'), { recursive: true, force: true })
    await fs.rm(path.join(storageDir, 'cad-models'), { recursive: true, force: true })
  })

  it('creates models, edits mesh, and exports geometry', async () => {
    const createModel = await request(app)
      .post('/model')
      .send({ description: 'A sample cube for packaging mockups' })

    expect(createModel.status).toBe(201)
    const modelId = createModel.body.data.id

    const primitive = await request(app)
      .post('/primitive')
      .send({ type: 'cylinder', parameters: { radius: 0.4, height: 2 } })

    expect(primitive.status).toBe(201)
    const primitiveId = primitive.body.data.id

    const transformRes = await request(app)
      .post(`/model/${modelId}/transform`)
      .send({ type: 'translate', value: { x: 1, y: 0.5, z: -0.5 } })
    expect(transformRes.body.data.transformations.position[0]).toBeCloseTo(1)

    const extrudeRes = await request(app)
      .post(`/model/${modelId}/extrude`)
      .send({ depth: 2 })
    expect(extrudeRes.status).toBe(200)

    const meshMove = await request(app)
      .post(`/model/${modelId}/mesh/edit`)
      .send({ operation: 'move', vertexIndex: 0, value: { z: 0.2 } })
    expect(meshMove.status).toBe(200)

    const measurements = await request(app).get(`/model/${modelId}/measurements`)
    expect(measurements.body.data.length).toBeGreaterThan(0)

    const views = await request(app).get(`/model/${modelId}/views`)
    expect(Array.isArray(views.body.data)).toBe(true)
    expect(views.body.data[0]).toHaveProperty('projection')

    const exportRes = await request(app)
      .post(`/model/${primitiveId}/export`)
      .send({ format: 'obj' })
    expect(exportRes.body.data.format).toBe('obj')
    const exportPath = exportRes.body.data.filePath
    await fs.access(exportPath)
  })
})
