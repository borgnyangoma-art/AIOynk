import request from 'supertest'
import { promises as fs } from 'fs'

import app from '../src/index'
import { STORAGE_ROOT } from '../src/config'

describe('Storage Service', () => {
  afterAll(async () => {
    await fs.rm(STORAGE_ROOT, { recursive: true, force: true })
  })

  it('provides Google auth url', async () => {
    const res = await request(app).get('/auth/google/url').query({ userId: 'test-user' })
    expect(res.status).toBe(200)
    expect(res.body.data.url).toContain('http')
    expect(res.body.data.state).toBeDefined()
  })

  it('exchanges mock code for tokens', async () => {
    const res = await request(app)
      .post('/auth/google/token')
      .send({ userId: 'user-1', code: 'mock-code' })
    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toContain('mock-access')
    expect(res.body.data.folderId).toBeTruthy()
  })

  it('uploads files and tracks versions', async () => {
    const buffer = Buffer.from('hello world')
    const res = await request(app)
      .post('/files/upload')
      .field('userId', 'user-1')
      .field('tool', 'graphics')
      .field('name', 'draft')
      .field('storage', 'local')
      .attach('file', buffer, { filename: 'draft.txt' })

    expect(res.status).toBe(201)
    const artifactId = res.body.data.artifactId

    await request(app)
      .post('/files/upload')
      .field('userId', 'user-1')
      .field('tool', 'graphics')
      .field('name', 'draft')
      .field('storage', 'local')
      .field('artifactId', artifactId)
      .attach('file', Buffer.from('v2'), { filename: 'draft.txt' })

    const versions = await request(app).get(`/files/${artifactId}/versions`)
    expect(versions.body.data.length).toBeGreaterThanOrEqual(2)
  })

  it('returns quota details', async () => {
    const res = await request(app).get('/storage/quota/user-1')
    expect(res.status).toBe(200)
    expect(res.body.data.local.usage).toBeGreaterThanOrEqual(0)
  })
})
