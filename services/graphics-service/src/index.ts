import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import multer from 'multer'
import sharp from 'sharp'
import { CanvasRenderingContext2D, createCanvas } from '@napi-rs/canvas'

const app: Application = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

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
const MAX_HISTORY = 50
const SUPPORTED_EXPORTS = ['json', 'png', 'jpg', 'webp', 'svg'] as const

interface CanvasLayer {
  id: string
  name: string
  visible: boolean
  order: number
  createdAt: string
}

interface CanvasElement {
  id: string
  type: string
  properties: Record<string, any>
  createdAt: string
  layerId: string
}

interface CanvasData {
  id: string
  width: number
  height: number
  background?: string
  elements: CanvasElement[]
  history: CanvasElement[][]
  redoStack: CanvasElement[][]
  layers: CanvasLayer[]
  createdAt: string
  updatedAt: string
  name?: string
}

const canvasStore = new Map<string, CanvasData>()

const ensureDirs = async () => {
  await fs.mkdir(EXPORTS_DIR, { recursive: true })
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true })
}

const createBaseLayer = (name = 'Layer 1'): CanvasLayer => ({
  id: uuidv4(),
  name,
  visible: true,
  order: 0,
  createdAt: new Date().toISOString(),
})

const cloneElements = (elements: CanvasElement[]) =>
  elements.map((element) => ({
    ...element,
    properties: { ...element.properties },
  }))

const pushHistory = (canvas: CanvasData) => {
  canvas.history.push(cloneElements(canvas.elements))
  if (canvas.history.length > MAX_HISTORY) {
    canvas.history.shift()
  }
}

const layerOrderMap = (canvas: CanvasData) =>
  canvas.layers.reduce<Record<string, number>>((acc, layer, idx) => {
    acc[layer.id] = idx
    return acc
  }, {})

const sortElementsByLayer = (canvas: CanvasData, includeHidden = false) => {
  const orderMap = layerOrderMap(canvas)
  const visibleLayerIds = new Set(
    canvas.layers.filter((layer) => layer.visible).map((layer) => layer.id),
  )
  return canvas.elements.filter((element) => includeHidden || visibleLayerIds.has(element.layerId)).sort((a, b) => {
    const layerDiff = (orderMap[a.layerId] ?? 0) - (orderMap[b.layerId] ?? 0)
    if (layerDiff !== 0) {
      return layerDiff
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

const drawElement = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
  const props = element.properties || {}
  switch (element.type) {
    case 'rectangle': {
      ctx.fillStyle = props.fill || '#000000'
      ctx.globalAlpha = props.opacity ?? 1
      ctx.fillRect(props.x ?? 0, props.y ?? 0, props.width ?? 50, props.height ?? 50)
      ctx.globalAlpha = 1
      break
    }
    case 'circle': {
      ctx.beginPath()
      ctx.fillStyle = props.fill || '#000000'
      const radius = props.radius ?? 25
      ctx.globalAlpha = props.opacity ?? 1
      ctx.arc(props.x ?? radius, props.y ?? radius, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      break
    }
    case 'text': {
      ctx.fillStyle = props.color || '#000000'
      ctx.font = `${props.fontSize ?? 20}px ${props.fontFamily || 'Arial'}`
      ctx.globalAlpha = props.opacity ?? 1
      ctx.fillText(props.text ?? 'Text', props.x ?? 0, props.y ?? 20)
      ctx.globalAlpha = 1
      break
    }
    default:
      break
  }
}

const renderCanvasToPng = async (canvas: CanvasData) => {
  const drawing = createCanvas(canvas.width, canvas.height)
  const ctx = drawing.getContext('2d')
  ctx.fillStyle = canvas.background || '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const orderedElements = sortElementsByLayer(canvas)
  orderedElements.forEach((element) => drawElement(ctx, element))

  return drawing.toBuffer('image/png')
}

const generateSvg = (canvas: CanvasData) => {
  const orderedElements = sortElementsByLayer(canvas)
  const elementMarkup = orderedElements
    .map((element) => {
      const props = element.properties || {}
      switch (element.type) {
        case 'rectangle':
          return `<rect x="${props.x ?? 0}" y="${props.y ?? 0}" width="${props.width ?? 50}" height="${props.height ?? 50}" fill="${props.fill ?? '#000'}" fill-opacity="${props.opacity ?? 1}" />`
        case 'circle':
          return `<circle cx="${props.x ?? props.radius ?? 25}" cy="${props.y ?? props.radius ?? 25}" r="${props.radius ?? 25}" fill="${props.fill ?? '#000'}" fill-opacity="${props.opacity ?? 1}" />`
        case 'text':
          return `<text x="${props.x ?? 0}" y="${props.y ?? 20}" font-size="${props.fontSize ?? 20}" fill="${props.color ?? '#000'}">${props.text ?? 'Text'}</text>`
        default:
          return ''
      }
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><rect width="100%" height="100%" fill="${canvas.background ?? '#fff'}" />${elementMarkup}</svg>`
}

const applyFilter = async (input: Buffer, filterType: string, params: Record<string, any> = {}) => {
  switch (filterType) {
    case 'grayscale':
      return sharp(input).grayscale().toBuffer()
    case 'blur':
      return sharp(input).blur(params.radius ?? 2).toBuffer()
    case 'invert':
      return sharp(input).negate().toBuffer()
    default:
      return sharp(input).toBuffer()
  }
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
      layers: [createBaseLayer()],
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

const getCanvasOr404 = (req: Request, res: Response) => {
  const canvas = canvasStore.get(req.params.id)
  if (!canvas) {
    res.status(404).json({ error: 'Canvas not found' })
    return null
  }
  return canvas
}

app.get('/canvas/:id', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) {
    return
  }
  res.json({ success: true, data: canvas })
})

app.get('/canvas/:id/layers', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return
  res.json({ success: true, data: canvas.layers })
})

app.post('/canvas/:id/layers', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return
  const layer: CanvasLayer = {
    id: uuidv4(),
    name: req.body.name || `Layer ${canvas.layers.length + 1}`,
    visible: true,
    order: canvas.layers.length,
    createdAt: new Date().toISOString(),
  }
  canvas.layers.push(layer)
  canvas.layers.sort((a, b) => a.order - b.order)
  canvas.updatedAt = new Date().toISOString()
  res.status(201).json({ success: true, data: layer })
})

app.patch('/canvas/:id/layers/:layerId', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return
  const layer = canvas.layers.find((entry) => entry.id === req.params.layerId)
  if (!layer) {
    return res.status(404).json({ error: 'Layer not found' })
  }
  if (typeof req.body.name === 'string') {
    layer.name = req.body.name
  }
  if (typeof req.body.visible === 'boolean') {
    layer.visible = req.body.visible
  }
  canvas.updatedAt = new Date().toISOString()
  res.json({ success: true, data: layer })
})

app.post('/canvas/:id/layers/:layerId/order', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return
  const layer = canvas.layers.find((entry) => entry.id === req.params.layerId)
  if (!layer) {
    return res.status(404).json({ error: 'Layer not found' })
  }
  const newOrder = Number(req.body.order)
  if (!Number.isFinite(newOrder)) {
    return res.status(400).json({ error: 'order must be a number' })
  }
  layer.order = Math.max(0, Math.min(newOrder, canvas.layers.length - 1))
  canvas.layers.sort((a, b) => a.order - b.order)
  canvas.layers.forEach((entry, index) => {
    entry.order = index
  })
  canvas.updatedAt = new Date().toISOString()
  res.json({ success: true, data: canvas.layers })
})

const resolveLayerId = (canvas: CanvasData, provided?: string) => {
  if (provided && canvas.layers.some((layer) => layer.id === provided)) {
    return provided
  }
  return canvas.layers[0].id
}

app.post('/canvas/:id/elements', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  const element: CanvasElement = {
    id: uuidv4(),
    type: req.body.type || 'rectangle',
    properties: req.body.properties || {},
    createdAt: new Date().toISOString(),
    layerId: resolveLayerId(canvas, req.body.layerId),
  }

  pushHistory(canvas)
  canvas.redoStack = []
  canvas.elements.push(element)
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true, data: element })
})

app.put('/canvas/:id/elements/:elementId', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  const idx = canvas.elements.findIndex((el) => el.id === req.params.elementId)
  if (idx === -1) {
    return res.status(404).json({ error: 'Element not found' })
  }

  pushHistory(canvas)
  canvas.redoStack = []
  canvas.elements[idx] = {
    ...canvas.elements[idx],
    layerId: resolveLayerId(canvas, req.body.layerId ?? canvas.elements[idx].layerId),
    properties: {
      ...canvas.elements[idx].properties,
      ...req.body.properties,
    },
  }
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true, data: canvas.elements[idx] })
})

app.delete('/canvas/:id/elements/:elementId', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  pushHistory(canvas)
  canvas.redoStack = []
  canvas.elements = canvas.elements.filter((el) => el.id !== req.params.elementId)
  canvas.updatedAt = new Date().toISOString()

  res.json({ success: true })
})

app.post('/canvas/:id/undo', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  if (canvas.history.length === 0) {
    return res.json({ success: true, data: canvas.elements })
  }

  const previous = canvas.history.pop() as CanvasElement[]
  canvas.redoStack.push(cloneElements(canvas.elements))
  canvas.redoStack = canvas.redoStack.slice(-MAX_HISTORY)
  canvas.elements = previous

  res.json({ success: true, data: canvas.elements })
})

app.post('/canvas/:id/redo', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  if (canvas.redoStack.length === 0) {
    return res.json({ success: true, data: canvas.elements })
  }

  const nextState = canvas.redoStack.pop() as CanvasElement[]
  pushHistory(canvas)
  canvas.elements = nextState

  res.json({ success: true, data: canvas.elements })
})

app.post('/canvas/:id/export', async (req: Request, res: Response) => {
  try {
    const canvas = getCanvasOr404(req, res)
    if (!canvas) return

    const format = (req.body.format || 'json').toLowerCase()
    if (!SUPPORTED_EXPORTS.includes(format as (typeof SUPPORTED_EXPORTS)[number])) {
      return res.status(400).json({ error: 'Unsupported export format' })
    }

    if (format === 'json') {
      const payload = {
        ...canvas,
        format,
        exportedAt: new Date().toISOString(),
      }
      const fileName = `${canvas.id}-${Date.now()}.json`
      const filePath = path.join(EXPORTS_DIR, fileName)
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
      return res.json({
        success: true,
        data: {
          format,
          fileName,
          path: filePath,
        },
      })
    }

    const pngBuffer = await renderCanvasToPng(canvas)
    let output: Buffer
    let contentType = 'image/png'
    if (format === 'png') {
      output = pngBuffer
    } else if (format === 'jpg') {
      output = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer()
      contentType = 'image/jpeg'
    } else if (format === 'webp') {
      output = await sharp(pngBuffer).webp({ quality: 90 }).toBuffer()
      contentType = 'image/webp'
    } else {
      const svgPayload = generateSvg(canvas)
      output = Buffer.from(svgPayload, 'utf8')
      contentType = 'image/svg+xml'
    }

    const fileName = `${canvas.id}-${Date.now()}.${format}`
    const filePath = path.join(EXPORTS_DIR, fileName)
    await fs.writeFile(filePath, output)

    res.json({
      success: true,
      data: {
        format,
        fileName,
        path: filePath,
        contentType,
        size: output.length,
      },
    })
  } catch (error) {
    logger.error('Failed to export canvas', error)
    res.status(500).json({ error: 'Failed to export canvas' })
  }
})

app.post('/canvas/:id/filter', async (req: Request, res: Response) => {
  try {
    const canvas = getCanvasOr404(req, res)
    if (!canvas) return
    const { filterType = 'grayscale', params = {} } = req.body
    const base = await renderCanvasToPng(canvas)
    const filtered = await applyFilter(base, filterType, params)
    const fileName = `${canvas.id}-filter-${Date.now()}.png`
    const filePath = path.join(EXPORTS_DIR, fileName)
    await fs.writeFile(filePath, filtered)
    res.json({
      success: true,
      data: { filterType, fileName, path: filePath },
    })
  } catch (error) {
    logger.error('Failed to apply filter', error)
    res.status(500).json({ error: 'Failed to apply filter' })
  }
})

app.post('/images/transform', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'image file is required' })
    }
    const { operation = 'resize' } = req.body
    let pipeline = sharp(req.file.buffer)

    if (operation === 'resize') {
      const width = parseInt(req.body.width, 10) || undefined
      const height = parseInt(req.body.height, 10) || undefined
      if (!width && !height) {
        return res.status(400).json({ error: 'width or height required for resize' })
      }
      pipeline = pipeline.resize(width, height, { fit: req.body.fit || 'cover' })
    } else if (operation === 'crop') {
      const width = parseInt(req.body.width, 10)
      const height = parseInt(req.body.height, 10)
      const left = parseInt(req.body.left, 10) || 0
      const top = parseInt(req.body.top, 10) || 0
      if (!width || !height) {
        return res.status(400).json({ error: 'width and height required for crop' })
      }
      pipeline = pipeline.extract({ width, height, left, top })
    } else if (operation === 'filter') {
      const type = req.body.type || 'grayscale'
      if (type === 'grayscale') {
        pipeline = pipeline.grayscale()
      } else if (type === 'blur') {
        pipeline = pipeline.blur(parseFloat(req.body.radius) || 2)
      } else if (type === 'sharpen') {
        pipeline = pipeline.sharpen()
      }
    }

    const transformed = await pipeline.toBuffer()
    res.json({
      success: true,
      data: {
        contentType: 'image/png',
        base64: transformed.toString('base64'),
        size: transformed.length,
      },
    })
  } catch (error) {
    logger.error('Failed to transform image', error)
    res.status(500).json({ error: 'Failed to transform image' })
  }
})

app.get('/canvas/:id/stats', (req: Request, res: Response) => {
  const canvas = getCanvasOr404(req, res)
  if (!canvas) return

  res.json({
    success: true,
    data: {
      canvasId: canvas.id,
      elements: canvas.elements.length,
      layers: canvas.layers.length,
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
