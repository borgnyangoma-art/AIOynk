jest.mock('../src/docker', () => require('./mocks/docker').createDockerMock())

import request from 'supertest'

import app from '../src/index'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('IDE Service', () => {
  it('creates project, manages files, and runs sandbox execution', async () => {
    const create = await request(app)
      .post('/project')
      .send({ name: 'Run JS', language: 'javascript', code: 'const msg = "Hi"; console.log(msg);' })
    expect(create.status).toBe(201)
    const projectId = create.body.data.id

    const fileRes = await request(app)
      .post(`/project/${projectId}/files`)
      .send({ fileName: 'utils', contents: 'export const sum = (a,b)=>a+b' })
    expect(fileRes.status).toBe(200)

    const files = await request(app).get(`/project/${projectId}/files`)
    expect(files.body.data).toContain('utils.js')

    const syntax = await request(app).post(`/project/${projectId}/syntax`)
    expect(syntax.body.data).toHaveProperty('findings')
    expect(syntax.body.data).toHaveProperty('metrics')

    const run = await request(app).post(`/project/${projectId}/run`).send()
    expect(run.status).toBe(202)
    const executionId = run.body.data.executionId

    await sleep(200)
    const status = await request(app).get(`/execution/${executionId}`)
    expect(status.body.data.status).toBe('success')
    expect(status.body.data.output).toContain('sandbox-output')
  })

  it('returns templates, analysis metrics, and security findings', async () => {
    const create = await request(app)
      .post('/project')
      .send({ name: 'Secure Check', language: 'javascript', code: 'console.log("safe")' })
    const projectId = create.body.data.id

    const template = await request(app)
      .post(`/project/${projectId}/template`)
      .send({ language: 'python' })
    expect(template.body.data.code).toContain('print')

    await request(app)
      .put(`/project/${projectId}`)
      .send({ code: 'eval("2+2")' })

    const security = await request(app).post(`/project/${projectId}/security`)
    expect(security.body.data.findings.length).toBeGreaterThan(0)

    const analysis = await request(app).get(`/project/${projectId}/analysis`)
    expect(analysis.body.data.lineCount).toBeGreaterThan(0)
    expect(analysis.body.data.files).toBeGreaterThan(0)
  })
})
