import request from 'supertest'

import app from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Video Service', () => {
  it('uploads media, manages clips/effects, and renders timeline', async () => {
    const upload = await request(app)
      .post('/upload')
      .attach('video', Buffer.from('demo video content'), { filename: 'demo.mp4' })

    expect(upload.status).toBe(200)
    const uploadedFile = upload.body.data.fileName

    const createProject = await request(app)
      .post('/project')
      .send({ name: 'Demo edit', format: 'mov', quality: 'high' })

    expect(createProject.status).toBe(201)
    const projectId = createProject.body.data.id

    const clipRes = await request(app)
      .post(`/project/${projectId}/clips`)
      .send({ fileName: uploadedFile, startTime: 0, endTime: 4, position: 0 })

    expect(clipRes.status).toBe(201)
    const clipId = clipRes.body.data.id

    const effectRes = await request(app)
      .post(`/project/${projectId}/clips/${clipId}/effects`)
      .send({ type: 'filter', name: 'brightness', parameters: { value: 0.3 } })

    expect(effectRes.status).toBe(201)
    expect(effectRes.body.data.name).toBe('brightness')

    const timeline = await request(app).get(`/project/${projectId}/timeline`)
    expect(timeline.status).toBe(200)
    expect(timeline.body.data.frames).toBeGreaterThan(0)

    const render = await request(app).post(`/project/${projectId}/render`)
    expect(render.status).toBe(202)
    const renderId = render.body.data.id

    let status = await request(app).get(`/render/${renderId}`)
    let attempts = 0
    while (status.body.data.status !== 'completed' && attempts < 50) {
      await sleep(50)
      status = await request(app).get(`/render/${renderId}`)
      attempts += 1
    }

    expect(status.body.data.status).toBe('completed')
    expect(status.body.data.progress).toBe(100)

    const effects = await request(app).get('/effects')
    expect(effects.status).toBe(200)
    expect(Object.keys(effects.body.data)).toContain('filter')

    const formats = await request(app).get('/formats')
    expect(formats.status).toBe(200)
    expect(formats.body.data.output).toContain('mp4')
  })
})
