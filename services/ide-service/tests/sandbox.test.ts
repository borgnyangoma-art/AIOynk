import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'

import { SandboxRunner } from '../src/sandbox'
import { CodeProject } from '../src/types'

class FakeContainer {
  private stream = new PassThrough()

  attach = jest.fn(async () => this.stream)

  start = jest.fn(async () => {
    this.stream.write('unit-sandbox-output')
    this.stream.end()
  })

  wait = jest.fn(async () => ({ StatusCode: 0 }))

  stop = jest.fn(async () => undefined)
}

class FakeDocker {
  public modem = {
    demuxStream: (stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream) => {
      stream.on('data', (chunk) => stdout.write(chunk))
      stream.on('end', () => {
        stdout.end()
        stderr.end()
      })
    },
  }

  public createContainer = jest.fn(async () => new FakeContainer())
}

const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}

describe('SandboxRunner', () => {
  it('runs code inside a mocked container with per-language configuration', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ide-sandbox-'))
    const runner = new SandboxRunner(new FakeDocker() as any, logger as any, workspaceRoot)
    const project: CodeProject = {
      id: 'proj',
      name: 'Unit Test',
      language: 'javascript',
      code: 'console.log("unit")',
      files: { 'main.js': 'console.log("unit")' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await runner.run(project, 'execution-1')

    expect(result.stdout).toContain('unit-sandbox-output')
    expect(result.exitCode).toBe(0)

    await fs.rm(workspaceRoot, { recursive: true, force: true })
  })
})
