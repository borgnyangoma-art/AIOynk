jest.mock('../src/docker', () => require('./mocks/docker').createDockerMock())

import request from 'supertest'

import app from '../src/index'

describe('IDE debugging APIs', () => {
  it('creates sessions, runs, steps, and inspects variables', async () => {
    const create = await request(app)
      .post('/project')
      .send({
        name: 'Debugger',
        language: 'javascript',
        code: 'const value = 42; function main() { const inner = value + 1; console.log(inner); }',
      })

    const projectId = create.body.data.id

    const sessionRes = await request(app)
      .post(`/project/${projectId}/debug/session`)
      .send({ breakpoints: [3, 6] })

    expect(sessionRes.status).toBe(201)
    const sessionId = sessionRes.body.data.id

    const runRes = await request(app).post(`/debug/${sessionId}/run`)
    expect(runRes.body.data.status).toBe('paused')
    expect(runRes.body.data.currentLine).toBe(3)

    const stepRes = await request(app).post(`/debug/${sessionId}/step`)
    expect(stepRes.body.data.currentLine).toBe(6)

    const doneRes = await request(app).post(`/debug/${sessionId}/step`)
    expect(doneRes.body.data.status).toBe('completed')

    const variables = await request(app).get(`/debug/${sessionId}/variables`)
    expect(variables.body.data.find((v: any) => v.name === 'value')?.value).toBe('42')
  })
})
