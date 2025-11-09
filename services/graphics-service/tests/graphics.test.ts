import request from 'supertest'

import app from '../src/index'

const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwsB7pXVPerAAAAASUVORK5CYII=',
  'base64',
)

describe('Graphics Service', () => {
  it('creates canvas and performs element operations', async () => {
    const create = await request(app)
      .post('/canvas')
      .send({ width: 400, height: 300, background: '#fff7ed' })
    expect(create.status).toBe(201)
    const canvasId = create.body.data.id

    const layers = await request(app).get(`/canvas/${canvasId}/layers`)
    expect(layers.status).toBe(200)
    expect(layers.body.data).toHaveLength(1)

    const newLayer = await request(app)
      .post(`/canvas/${canvasId}/layers`)
      .send({ name: 'Foreground' })
    expect(newLayer.status).toBe(201)
    const layerId = newLayer.body.data.id

    const element = await request(app)
      .post(`/canvas/${canvasId}/elements`)
      .send({ type: 'rectangle', properties: { x: 10, y: 10, width: 120, height: 80 }, layerId })
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

    const pngExport = await request(app)
      .post(`/canvas/${canvasId}/export`)
      .send({ format: 'png' })
    expect(pngExport.status).toBe(200)
    expect(pngExport.body.data.contentType).toBe('image/png')

    const filterRes = await request(app)
      .post(`/canvas/${canvasId}/filter`)
      .send({ filterType: 'grayscale' })
    expect(filterRes.status).toBe(200)

    const transform = await request(app)
      .post('/images/transform')
      .attach('image', BLANK_PNG, { filename: 'blank.png' })
      .field('operation', 'resize')
      .field('width', '2')
      .field('height', '2')
    expect(transform.status).toBe(200)
    expect(transform.body.data.base64).toBeDefined()
  })
})
