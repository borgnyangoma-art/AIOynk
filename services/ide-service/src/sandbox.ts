import { promises as fs } from 'fs'
import path from 'path'
import { PassThrough } from 'stream'
import { Logger } from 'winston'
import Dockerode from 'dockerode'
import ts from 'typescript'
import { v4 as uuidv4 } from 'uuid'

import { CodeProject, Language } from './types'
import { getEntryFileName, normalizeFileName } from './utils/project'

export type SandboxResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

type LanguageConfig = {
  image: string
  run: string
  syntaxCheck?: string
  memory: number
  nanoCpus: number
  timeoutMs: number
}

const LANGUAGE_CONFIG: Record<Language, LanguageConfig> = {
  python: {
    image: 'python:3.11-alpine',
    run: 'python3 {{ENTRY_FILE}}',
    syntaxCheck: 'python3 -m py_compile {{ENTRY_FILE}}',
    memory: 256 * 1024 * 1024,
    nanoCpus: 1_000_000_000,
    timeoutMs: 8000,
  },
  javascript: {
    image: 'node:20-alpine',
    run: 'node {{ENTRY_FILE}}',
    syntaxCheck: 'node --check {{ENTRY_FILE}}',
    memory: 256 * 1024 * 1024,
    nanoCpus: 1_000_000_000,
    timeoutMs: 8000,
  },
  typescript: {
    image: 'node:20-alpine',
    run: 'node main.js',
    syntaxCheck: undefined,
    memory: 256 * 1024 * 1024,
    nanoCpus: 1_000_000_000,
    timeoutMs: 8000,
  },
  java: {
    image: 'eclipse-temurin:21-jdk',
    run: 'sh -c "javac {{ENTRY_FILE}} && java Main"',
    syntaxCheck: 'javac {{ENTRY_FILE}}',
    memory: 512 * 1024 * 1024,
    nanoCpus: 1_500_000_000,
    timeoutMs: 12000,
  },
  cpp: {
    image: 'gcc:13.2',
    run: 'sh -c "g++ {{ENTRY_FILE}} -o main && ./main"',
    syntaxCheck: 'g++ -fsyntax-only {{ENTRY_FILE}}',
    memory: 512 * 1024 * 1024,
    nanoCpus: 1_500_000_000,
    timeoutMs: 12000,
  },
}

const replaceEntryToken = (command: string, entryFile: string) => command.replace(/\{\{ENTRY_FILE\}\}/g, entryFile)

export class SandboxRunner {
  constructor(private docker: Dockerode, private logger: Logger, private workspaceRoot: string) {}

  async run(project: CodeProject, executionId: string) {
    const config = LANGUAGE_CONFIG[project.language]
    return this.execute(project, executionId, config.run, config)
  }

  async checkSyntax(project: CodeProject) {
    const config = LANGUAGE_CONFIG[project.language]
    if (!config.syntaxCheck) {
      return { stdout: '', stderr: '', exitCode: 0, timedOut: false }
    }
    return this.execute(project, `syntax-${uuidv4()}`, config.syntaxCheck, config)
  }

  private async execute(project: CodeProject, executionId: string, command: string, config: LanguageConfig) {
    const workspace = await this.prepareWorkspace(project, executionId)
    try {
      const interpolated = replaceEntryToken(command, workspace.entryFile)
      const binds = [`${workspace.path}:/workspace`]
      const container = await this.docker.createContainer({
        Image: config.image,
        Cmd: ['sh', '-c', interpolated],
        Tty: false,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace',
        HostConfig: {
          Binds: binds,
          Memory: config.memory,
          NanoCpus: config.nanoCpus,
          NetworkMode: 'none',
          AutoRemove: true,
          PidsLimit: 64,
        },
      })

      const stream = await container.attach({ stream: true, stdout: true, stderr: true })
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const collectPromise = this.collectStream(stream, stdoutChunks, stderrChunks)

      await container.start()

      const { timedOut, statusCode } = await this.waitForContainer(container, config.timeoutMs)
      await collectPromise

      return {
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        exitCode: typeof statusCode === 'number' ? statusCode : -1,
        timedOut,
      }
    } catch (error) {
      this.logger.error('Sandbox execution failed', error)
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Sandbox failed',
        exitCode: -1,
        timedOut: false,
      }
    } finally {
      await fs.rm(workspace.path, { recursive: true, force: true })
    }
  }

  private async waitForContainer(container: Dockerode.Container, timeoutMs: number) {
    let timeoutHandle: NodeJS.Timeout | undefined
    let timedOut = false

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(async () => {
        timedOut = true
        try {
          await container.stop({ t: 0 })
        } catch (err) {
          this.logger.warn('Failed to stop timed-out container', err)
        }
        reject(new Error('Execution timed out'))
      }, timeoutMs)
    })

    try {
      const result = (await Promise.race([container.wait(), timeoutPromise])) as { StatusCode?: number }
      if (timeoutHandle) clearTimeout(timeoutHandle)
      return { statusCode: result.StatusCode, timedOut }
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (timedOut) {
        return { statusCode: -1, timedOut: true }
      }
      throw error
    }
  }

  private collectStream(stream: NodeJS.ReadWriteStream, stdoutChunks: Buffer[], stderrChunks: Buffer[]) {
    return new Promise<void>((resolve, reject) => {
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      let closed = 0

      stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
      stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))

      const handleClose = () => {
        closed += 1
        if (closed === 2) {
          resolve()
        }
      }

      stdout.on('end', handleClose)
      stderr.on('end', handleClose)
      stdout.on('error', reject)
      stderr.on('error', reject)

      const modem = (this.docker as any).modem
      if (modem && typeof modem.demuxStream === 'function') {
        modem.demuxStream(stream, stdout, stderr)
      } else {
        stream.on('data', (chunk) => stdout.write(chunk))
        stream.on('end', () => {
          stdout.end()
          stderr.end()
        })
        stream.on('error', reject)
      }
    })
  }

  private async prepareWorkspace(project: CodeProject, executionId: string) {
    const workspacePath = path.join(this.workspaceRoot, executionId)
    await fs.rm(workspacePath, { recursive: true, force: true })
    await fs.mkdir(workspacePath, { recursive: true })

    await Promise.all(
      Object.entries(project.files).map(async ([name, contents]) => {
        const normalized = normalizeFileName(project.language, name)
        const target = path.join(workspacePath, normalized)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, String(contents ?? ''), 'utf-8')
      })
    )

    const entryFile = normalizeFileName(project.language)
    if (!project.files[entryFile]) {
      await fs.writeFile(path.join(workspacePath, entryFile), project.code, 'utf-8')
    }

    if (project.language === 'typescript') {
      const tsCode = project.files[entryFile] || project.code
      const transpiled = ts.transpileModule(tsCode, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 },
      })
      await fs.writeFile(path.join(workspacePath, 'main.js'), transpiled.outputText, 'utf-8')
    }

    return { path: workspacePath, entryFile: getEntryFileName(project.language) }
  }
}
