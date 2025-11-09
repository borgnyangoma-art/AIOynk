import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import esprima, { Program } from 'esprima'

import Analyzer from './analysis'
import DebugManager from './debugger'
import docker from './docker'
import { SandboxRunner } from './sandbox'
import { CodeProject, ExecutionResult, Language } from './types'
import { getDefaultCode, getEntryFileName, normalizeFileName } from './utils/project'

const app: Application = express()
const PORT = process.env.PORT || 3003

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'logs/ide.log' })],
})

const PROJECTS_DIR = path.join(__dirname, '../../storage/ide-projects')
const EXECUTIONS_DIR = path.join(__dirname, '../../storage/executions')
const LOGS_DIR = path.join(__dirname, '../logs')

const sandboxRunner = new SandboxRunner(docker, logger, EXECUTIONS_DIR)
const analyzer = new Analyzer(sandboxRunner)
const debugManager = new DebugManager()

const SUPPORTED_LANGUAGES: Language[] = ['python', 'javascript', 'java', 'cpp', 'typescript']

const projectStore = new Map<string, CodeProject>()
const executionStore = new Map<string, ExecutionResult>()

const ensureDirs = async () => {
  await fs.mkdir(PROJECTS_DIR, { recursive: true })
  await fs.mkdir(EXECUTIONS_DIR, { recursive: true })
  await fs.mkdir(LOGS_DIR, { recursive: true })
}

const getProjectOr404 = (req: Request, res: Response) => {
  const project = projectStore.get(req.params.id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }
  return project
}

const getSessionOr404 = (sessionId: string, res: Response) => {
  const session = debugManager.getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Debug session not found' })
    return null
  }
  return session
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ide-service',
    timestamp: new Date().toISOString(),
    sandboxReady: true,
  })
})

app.post('/project', async (req: Request, res: Response) => {
  try {
    const language = req.body.language as Language
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' })
    }

    const entryFile = getEntryFileName(language)
    const initialCode = typeof req.body.code === 'string' && req.body.code.length ? req.body.code : getDefaultCode(language)

    const project: CodeProject = {
      id: uuidv4(),
      name: req.body.name || 'Untitled Project',
      language,
      code: initialCode,
      files: { [entryFile]: initialCode },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    projectStore.set(project.id, project)
    logger.info(`IDE project created: ${project.id} (${language})`)

    res.status(201).json({ success: true, data: project })
  } catch (error) {
    logger.error('Error creating project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

app.get('/project/:id', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return
  res.json({ success: true, data: project })
})

app.put('/project/:id', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const { name, code, fileName, fileContent } = req.body as { name?: string; code?: string; fileName?: string; fileContent?: string }

  if (typeof name === 'string') {
    project.name = name
  }

  if (typeof code === 'string') {
    project.code = code
    project.files[getEntryFileName(project.language)] = code
  }

  if (fileName) {
    const normalized = normalizeFileName(project.language, fileName)
    project.files[normalized] = fileContent !== undefined ? String(fileContent) : project.code
  }

  project.updatedAt = new Date()
  res.json({ success: true, data: project })
})

app.get('/project/:id/files', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return
  res.json({ success: true, data: Object.keys(project.files) })
})

app.get('/project/:id/files/:fileName', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const fileName = normalizeFileName(project.language, req.params.fileName)
  const contents = project.files[fileName]
  if (contents === undefined) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.json({ success: true, data: { fileName, contents } })
})

app.post('/project/:id/files', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const { fileName, contents } = req.body as { fileName: string; contents: string }
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' })
  }

  const normalized = normalizeFileName(project.language, fileName)
  project.files[normalized] = String(contents ?? '')
  project.updatedAt = new Date()

  res.json({ success: true, data: project.files })
})

app.delete('/project/:id/files/:fileName', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const fileName = normalizeFileName(project.language, req.params.fileName)
  delete project.files[fileName]
  project.updatedAt = new Date()

  res.status(204).send()
})

app.post('/project/:id/run', async (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const executionId = uuidv4()
  const startTime = Date.now()

  const execution: ExecutionResult = {
    id: executionId,
    projectId: project.id,
    status: 'running',
    output: '',
    executionTime: 0,
  }

  executionStore.set(executionId, execution)

  res.status(202).json({
    success: true,
    data: {
      executionId,
      message: 'Execution started',
      status: 'running',
    },
  })

  executeCode(project, executionId, startTime)
})

app.get('/execution/:id', (req: Request, res: Response) => {
  const execution = executionStore.get(req.params.id)
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' })
  }
  res.json({ success: true, data: execution })
})

app.get('/execution/:id/output', (req: Request, res: Response) => {
  const execution = executionStore.get(req.params.id)
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' })
  }

  res.write(`data: ${JSON.stringify(execution)}\n\n`)
  if (['success', 'error', 'timeout'].includes(execution.status)) {
    res.end()
  }
})

app.post('/project/:id/syntax', async (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res)
    if (!project) return
    const report = await analyzer.syntax(project)
    res.json({ success: true, data: report })
  } catch (error) {
    logger.error('Syntax analysis failed', error)
    res.status(500).json({ error: 'Failed to analyze syntax' })
  }
})

app.get('/projects', (_req: Request, res: Response) => {
  const projects = Array.from(projectStore.values()).map((p) => ({
    id: p.id,
    name: p.name,
    language: p.language,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))

  res.json({ success: true, data: projects })
})

app.post('/project/:id/security', (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res)
    if (!project) return
    const report = analyzer.scanSecurity(project)
    res.json({ success: true, data: report })
  } catch (error) {
    logger.error('Security scan failed', error)
    res.status(500).json({ error: 'Failed to scan for security issues' })
  }
})

app.get('/project/:id/analysis', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const lineCount = project.code.split('\n').length
  const charCount = project.code.length
  let functionCount = 0

  if (project.language === 'javascript' || project.language === 'typescript') {
    try {
      const tree = esprima.parseScript(project.code, { tolerant: true }) as Program
      functionCount = tree.body.filter((node) => node.type === 'FunctionDeclaration').length
    } catch {
      functionCount = 0
    }
  }

  res.json({
    success: true,
    data: {
      lineCount,
      charCount,
      functionCount,
      files: Object.keys(project.files).length,
      language: project.language,
    },
  })
})

app.post('/project/:id/template', (req: Request, res: Response) => {
  const { language } = req.body as { language: Language }
  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: 'language is required' })
  }

  res.json({ success: true, data: { language, code: getDefaultCode(language) } })
})

app.post('/project/:id/debug/session', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const breakpoints = Array.isArray(req.body.breakpoints) ? req.body.breakpoints : []
  const session = debugManager.createSession(project.id, breakpoints)
  res.status(201).json({ success: true, data: session })
})

app.post('/debug/:id/breakpoints', (req: Request, res: Response) => {
  const session = getSessionOr404(req.params.id, res)
  if (!session) return

  if (!Array.isArray(req.body.breakpoints)) {
    return res.status(400).json({ error: 'breakpoints must be an array' })
  }

  const updated = debugManager.updateBreakpoints(session.id, session.projectId, req.body.breakpoints)
  res.json({ success: true, data: updated })
})

app.post('/debug/:id/run', (req: Request, res: Response) => {
  const session = getSessionOr404(req.params.id, res)
  if (!session) return
  const project = projectStore.get(session.projectId)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const updated = debugManager.run(session.id, project)
  res.json({ success: true, data: updated })
})

app.post('/debug/:id/step', (req: Request, res: Response) => {
  const session = getSessionOr404(req.params.id, res)
  if (!session) return
  const project = projectStore.get(session.projectId)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const updated = debugManager.step(session.id, project)
  res.json({ success: true, data: updated })
})

app.get('/debug/:id', (req: Request, res: Response) => {
  const session = getSessionOr404(req.params.id, res)
  if (!session) return
  res.json({ success: true, data: session })
})

app.get('/debug/:id/variables', (req: Request, res: Response) => {
  const session = getSessionOr404(req.params.id, res)
  if (!session) return
  const project = projectStore.get(session.projectId)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const variables = debugManager.inspectVariables(session.id, project)
  res.json({ success: true, data: variables })
})

const executeCode = async (project: CodeProject, executionId: string, startTime: number) => {
  const execution = executionStore.get(executionId)
  if (!execution) return

  try {
    const result = await sandboxRunner.run(project, executionId)
    execution.exitCode = result.exitCode
    execution.output = result.stdout
    execution.error = result.stderr || (result.timedOut ? 'Execution timed out' : undefined)
    execution.status = result.timedOut ? 'timeout' : result.exitCode === 0 ? 'success' : 'error'
    execution.executionTime = Date.now() - startTime
    logger.info(`Code executed: ${executionId} status=${execution.status}`)
  } catch (error: any) {
    execution.status = 'error'
    execution.error = error?.message || 'Execution failed'
    execution.executionTime = Date.now() - startTime
    logger.error(`Execution failed: ${executionId}`, error)
  }
}

app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error('Error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

export const start = async () => {
  await ensureDirs()
  return app.listen(PORT, () => {
    logger.info(`💻 IDE Service running on port ${PORT}`)
  })
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.error('Failed to start:', error)
    process.exit(1)
  })
}

export default app
