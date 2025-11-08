import request from 'supertest'

import app from '../src/index'

describe('Web Designer Service', () => {
  it('lists available components', async () => {
    const res = await request(app).get('/components')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('creates project, attaches components, and evaluates accessibility', async () => {
    const create = await request(app).post('/project').send({ name: 'Test Landing' })
    expect(create.status).toBe(201)
    const projectId = create.body.data.id

    const componentRes = await request(app)
      .post(`/project/${projectId}/components`)
      .send({ componentIds: ['hero-centered', 'feature-grid'] })
    expect(componentRes.status).toBe(200)
    expect(componentRes.body.data.components).toEqual(
      expect.arrayContaining(['hero-centered', 'feature-grid']),
    )

    const accessibility = await request(app).get(`/project/${projectId}/accessibility`)
    expect(accessibility.status).toBe(200)
    expect(accessibility.body.data).toHaveProperty('issues')

    const responsive = await request(app).get(`/project/${projectId}/responsive-preview`)
    expect(responsive.status).toBe(200)
    expect(responsive.body.data.length).toBeGreaterThan(0)

    const frameworkExport = await request(app)
      .post(`/project/${projectId}/framework`)
      .send({ framework: 'react' })
    expect(frameworkExport.status).toBe(200)
    expect(frameworkExport.body.data.framework).toBe('react')
  })
})
