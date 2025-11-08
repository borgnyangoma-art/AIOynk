import request from 'supertest'

import app from '../src/index'

describe('Graphics Service', () => {
  it('creates canvas and performs element operations', async () => {
    const create = await request(app)
      .post('/canvas')
      .send({ width: 400, height: 300, background: '#fff7ed' })
    expect(create.status).toBe(201)
    const canvasId = create.body.data.id

    const element = await request(app)
      .post(`/canvas/${canvasId}/elements`)
      .send({ type: 'rectangle', properties: { x: 10, y: 10, width: 120, height: 80 } })
    expect(element.status).toBe(200)
    const elementId = element.body.data.id

    const updated = await request(app)
      .put(`/canvas/${canvasId}/elements/${elementId}`)
      .send({ properties: { fill: '#f97316' } })
    expect(updated.status).toBe(200)
    expect(updated.body.data.properties.fill).toBe('#f97316')

    const undo = await request(app).post(`/canvas/${canvasId}/undo`)
    expect(undo.status).toBe(200)

    const redo = await request(app).post(`/canvas/${canvasId}/redo`)
    expect(redo.status).toBe(200)

    const stats = await request(app).get(`/canvas/${canvasId}/stats`)
    expect(stats.status).toBe(200)
    expect(stats.body.data.canvasId).toBe(canvasId)

    const exportRes = await request(app)
      .post(`/canvas/${canvasId}/export`)
      .send({ format: 'json' })
    expect(exportRes.status).toBe(200)
    expect(exportRes.body.data.format).toBe('json')
  })
})
