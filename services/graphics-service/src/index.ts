import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'

const app: Application = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/graphics-service.log' }),
  ],
})

const STORAGE_DIR = path.join(__dirname, '../../storage/graphics')
const EXPORTS_DIR = path.join(STORAGE_DIR, 'exports')

interface CanvasElement {
  id: string
  type: string
  properties: Record<string, any>
  createdAt: string
}

interface CanvasData {
  id: string
  width: number
  height: number
  background?: string
  elements: CanvasElement[]
  history: CanvasElement[][]
  redoStack: CanvasElement[][]
  createdAt: string
  updatedAt: string
  name?: string
}

const canvasStore = new Map<string, CanvasData>()

const ensureDirs = async () => {
  await fs.mkdir(EXPORTS_DIR, { recursive: true })
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true })
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'graphics-service',
    timestamp: new Date().toISOString(),
  })
})

app.post('/canvas', async (req: Request, res: Response) => {
  try {
    const { width = 800, height = 600, background = '#ffffff' } = req.body

    if (width <= 0 || height <= 0) {
      return res.status(400).json({ error: 'Invalid canvas dimensions' })
    }

    const canvasId = uuidv4()
    const canvas: CanvasData = {
      id: canvasId,
      width,
      height,
      background,
      elements: [],
      history: [],
      redoStack: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    canvasStore.set(canvasId, canvas)

    res.status(201).json({ success: true, data: canvas })
  } catch (error) {
    logger.error('Failed to create canvas', error)
    res.status(500).json({ error: 'Failed to create canvas' })
  }
})

app.get('/canvas/:id', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }
  res.json({ success: true, data: canvas })
})

app.post('/canvas/:id/elements', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  const element: CanvasElement = {
    id: uuidv4(),
    type: req.body.type || 'rectangle',
    properties: req.body.properties || {},
    createdAt: new Date().toISOString(),
  }

  canvas.history.push([...canvas.elements])
  canvas.redoStack = []
  canvas.elements.push(element)
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true, data: element })
})

app.put('/canvas/:id/elements/:elementId', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  const idx = canvas.elements.findIndex((el) => el.id === req.params.elementId)
  if (idx === -1) {
    return res.status(404).json({ error: 'Element not found' })
  }

  canvas.history.push([...canvas.elements])
  canvas.redoStack = []
  canvas.elements[idx] = {
    ...canvas.elements[idx],
    properties: {
      ...canvas.elements[idx].properties,
      ...req.body.properties,
    },
  }
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true, data: canvas.elements[idx] })
})

app.delete('/canvas/:id/elements/:elementId', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  canvas.history.push([...canvas.elements])
  canvas.redoStack = []
  canvas.elements = canvas.elements.filter((el) => el.id !== req.params.elementId)
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true })
})

app.post('/canvas/:id/undo', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  if (canvas.history.length === 0) {
    return res.json({ success: true, data: canvas.elements })
  }

  const previous = canvas.history.pop() as CanvasElement[]
  canvas.redoStack.push([...canvas.elements])
  canvas.elements = previous

  res.json({ success: true, data: canvas.elements })
})

app.post('/canvas/:id/redo', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  if (canvas.redoStack.length === 0) {
    return res.json({ success: true, data: canvas.elements })
  }

  const nextState = canvas.redoStack.pop() as CanvasElement[]
  canvas.history.push([...canvas.elements])
  canvas.elements = nextState

  res.json({ success: true, data: canvas.elements })
})

app.post('/canvas/:id/export', async (req: Request, res: Response) => {
  try {
    const canvas = canvasStore.get(req.params.id)
    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' })
    }

    const { format = 'json' } = req.body
    const payload = {
      ...canvas,
      format,
      exportedAt: new Date().toISOString(),
    }

    const fileName = `${canvas.id}-${Date.now()}.${format === 'json' ? 'json' : 'txt'}`
    const filePath = path.join(EXPORTS_DIR, fileName)

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')

    res.json({
      success: true,
      data: {
        format,
        fileName,
        path: filePath,
      },
    })
  } catch (error) {
    logger.error('Failed to export canvas', error)
    res.status(500).json({ error: 'Failed to export canvas' })
  }
})

app.post('/canvas/:id/filter', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  res.json({
    success: true,
    data: {
      filterType: req.body.filterType,
      params: req.body.params,
      message: 'Filter applied',
    },
  })
})

app.get('/canvas/:id/stats', (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    return res.status(404).json({ error: 'Canvas not found' })
  }

  res.json({
    success: true,
    data: {
      canvasId: canvas.id,
      elements: canvas.elements.length,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
    },
  })
})

export const start = async () => {
  await ensureDirs()
  return app.listen(PORT, () => {
    logger.info(`Graphics service listening on port ${PORT}`)
  })
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.error('Failed to start graphics service', error)
    process.exit(1)
  })
}

export default app
