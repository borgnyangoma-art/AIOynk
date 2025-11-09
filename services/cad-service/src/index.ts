import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import path from 'path'
import winston from 'winston'

import { createPrimitive, editMesh, extrudeModel, generateModelFromDescription, applyTransformation } from './geometry'
import { exportModel } from './exporter'
import { calculateMeasurements } from './measurements'
import { getViewDefinitions } from './views'
import { ExportFormat, Model3D, PrimitiveType } from './types'
import {
  getMetrics,
  recordExport,
  recordMeshOperation,
  recordModelGeneration,
  updateActiveSessions,
  updateActiveTriangles,
  updateActiveVertices,
  updateMemoryUsage,
} from './metrics'

const app: Application = express()
const PORT = process.env.PORT || 3004

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'logs/cad.log' })],
})

const MODELS_DIR = path.join(__dirname, '../../storage/cad-models')
const EXPORTS_DIR = path.join(__dirname, '../../storage/cad-exports')
const LOGS_DIR = path.join(__dirname, 'logs')

const modelStore = new Map<string, Model3D>()

const ensureDirs = async () => {
  await fs.mkdir(MODELS_DIR, { recursive: true })
  await fs.mkdir(EXPORTS_DIR, { recursive: true })
  await fs.mkdir(LOGS_DIR, { recursive: true })
}

const storeModel = async (model: Model3D) => {
  modelStore.set(model.id, model)
  await fs.mkdir(MODELS_DIR, { recursive: true })
  await fs.writeFile(path.join(MODELS_DIR, `${model.id}.json`), JSON.stringify(model, null, 2), 'utf-8')
  updateActiveSessions(modelStore.size)
  updateActiveVertices(model.mesh.vertices.length / 3)
  updateActiveTriangles(model.mesh.faces.length)
}

const getModelOr404 = (req: Request, res: Response) => {
  const model = modelStore.get(req.params.id)
  if (!model) {
    res.status(404).json({ error: 'Model not found' })
    return null
  }
  return model
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'cad-service', timestamp: new Date().toISOString(), models: modelStore.size })
})

app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain')
  res.send(await getMetrics())
})

app.post('/model', async (req: Request, res: Response) => {
  try {
    const start = Date.now()
    const model = generateModelFromDescription(req.body.description || 'Concept Model', req.body.type as PrimitiveType, req.body.parameters || {})
    await storeModel(model)
    recordModelGeneration(model.type, (Date.now() - start) / 1000)
    res.status(201).json({ success: true, data: model })
  } catch (error) {
    logger.error('Failed to create model', error)
    recordModelGeneration(req.body?.type || 'custom', 0, 'error')
    res.status(500).json({ error: 'Failed to create model' })
  }
})

app.get('/model/:id', (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return
  res.json({ success: true, data: model })
})

app.put('/model/:id', async (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return

  model.parameters = { ...model.parameters, ...(req.body.parameters || {}) }
  if (req.body.material) {
    model.material = { ...model.material, ...req.body.material }
  }
  if (req.body.transformations) {
    model.transformations = { ...model.transformations, ...req.body.transformations }
  }
  model.updatedAt = new Date().toISOString()
  await storeModel(model)
  res.json({ success: true, data: model })
})

app.post('/primitive', async (req: Request, res: Response) => {
  try {
    const type = (req.body.type as PrimitiveType) || 'cube'
    const start = Date.now()
    const model = createPrimitive(type, req.body.parameters || {})
    await storeModel(model)
    recordModelGeneration(type, (Date.now() - start) / 1000)
    res.status(201).json({ success: true, data: model })
  } catch (error) {
    logger.error('Failed to generate primitive', error)
    res.status(500).json({ error: 'Failed to generate primitive' })
  }
})

app.post('/model/:id/transform', async (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return
  applyTransformation(model.transformations, req.body)
  model.updatedAt = new Date().toISOString()
  await storeModel(model)
  res.json({ success: true, data: model })
})

app.post('/model/:id/extrude', async (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return
  extrudeModel(model, Number(req.body.depth) || 1)
  model.updatedAt = new Date().toISOString()
  await storeModel(model)
  res.json({ success: true, data: model })
})

app.post('/model/:id/export', async (req: Request, res: Response) => {
  try {
    const model = getModelOr404(req, res)
    if (!model) return

    const format = (req.body.format as ExportFormat) || 'obj'
    const start = Date.now()
    const file = await exportModel(model, format, EXPORTS_DIR)
    recordExport(format, (Date.now() - start) / 1000)
    res.json({ success: true, data: { ...file, format } })
  } catch (error) {
    logger.error('Failed to export model', error)
    res.status(500).json({ error: 'Failed to export model' })
  }
})

app.get('/model/:id/measurements', (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return
  res.json({ success: true, data: calculateMeasurements(model) })
})

app.get('/model/:id/views', (_req: Request, res: Response) => {
  res.json({ success: true, data: getViewDefinitions() })
})

app.post('/model/:id/mesh/edit', async (req: Request, res: Response) => {
  const model = getModelOr404(req, res)
  if (!model) return

  try {
    editMesh(model, req.body)
    model.updatedAt = new Date().toISOString()
    await storeModel(model)
    recordMeshOperation(req.body.operation)
    res.json({ success: true, data: model })
  } catch (error) {
    logger.error('Failed mesh edit', error)
    recordMeshOperation(req.body.operation || 'unknown', 'error')
    res.status(400).json({ error: 'Failed to edit mesh' })
  }
})

app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error', err)
  res.status(500).json({ error: err?.message || 'Internal server error' })
})

app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

const start = async () => {
  await ensureDirs()
  const server = app.listen(PORT, () => {
    logger.info(`🎲 CAD Service running on port ${PORT}`)
  })
  return server
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.error('Failed to start CAD service', error)
    process.exit(1)
  })
}

void ensureDirs().catch((error) => logger.error('Failed to prepare directories', error))
setInterval(() => updateMemoryUsage(), 10_000).unref?.()

export { start }
export default app
