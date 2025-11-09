import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import multer from 'multer'

import { RenderQueue } from './renderer'
import { buildTimeline, syncTimelineDuration } from './timeline'
import { listEffects, findEffectDefinition } from './effects'
import {
  EffectType,
  VideoClip,
  VideoEffect,
  VideoFormat,
  VideoProject,
  VideoQuality,
} from './types'
import {
  getMetrics,
  recordEffectApplication,
  recordTimelineOperation,
  recordVideoProcessing,
  updateActiveClips,
  updateActiveSessions,
  updateMemoryUsage,
  updateVideoSize,
} from './metrics'

const INPUT_FORMATS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv']
const OUTPUT_FORMATS: VideoFormat[] = ['mp4', 'avi', 'mov', 'webm']
const QUALITY_PRESETS: Record<VideoQuality, { bitrate: string; codec: string }> = {
  low: { bitrate: '1500k', codec: 'h264' },
  medium: { bitrate: '3000k', codec: 'h264' },
  high: { bitrate: '6000k', codec: 'h265' },
}
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024

const app: Application = express()
const PORT = process.env.PORT || 3005

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'logs/video.log' })],
})

const UPLOADS_DIR = path.join(__dirname, '../../storage/video-uploads')
const PROJECTS_DIR = path.join(__dirname, '../../storage/video-projects')
const RENDERS_DIR = path.join(__dirname, '../../storage/video-renders')
const LOGS_DIR = path.join(__dirname, 'logs')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(UPLOADS_DIR, { recursive: true })
      .then(() => cb(null, UPLOADS_DIR))
      .catch((error) => cb(error as Error, UPLOADS_DIR))
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${uuidv4()}${extension}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
    if (!INPUT_FORMATS.includes(ext)) {
      return cb(new Error('Unsupported input format'))
    }
    cb(null, true)
  },
})

const projectStore = new Map<string, VideoProject>()
const renderQueue = new RenderQueue(RENDERS_DIR, UPLOADS_DIR, logger)

const ensureDirs = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.mkdir(PROJECTS_DIR, { recursive: true })
  await fs.mkdir(RENDERS_DIR, { recursive: true })
  await fs.mkdir(LOGS_DIR, { recursive: true })
}

const toNumber = (value: any, defaultValue: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

const refreshClipGauge = () => {
  const total = Array.from(projectStore.values()).reduce((sum, project) => sum + project.clips.length, 0)
  updateActiveClips(total)
}

const getProjectOr404 = (req: Request, res: Response) => {
  const project = projectStore.get(req.params.id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }
  return project
}

const createClip = (project: VideoProject, fileName: string, payload: any): VideoClip => {
  const startTime = toNumber(payload.startTime, 0)
  const endTime = toNumber(payload.endTime, startTime + Math.max(1, toNumber(payload.duration, 5)))
  const position = payload.position !== undefined ? toNumber(payload.position, project.timeline.duration) : project.timeline.duration
  const duration = Math.max(0.1, endTime - startTime)
  const track = payload.track !== undefined ? Math.max(0, Number(payload.track)) : 0

  return {
    id: uuidv4(),
    fileName,
    filePath: path.join(UPLOADS_DIR, fileName),
    duration,
    startTime,
    endTime,
    position,
    track,
    effects: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const syncProjectTimeline = (project: VideoProject) => {
  syncTimelineDuration(project)
  project.timeline.markers = project.timeline.markers.sort((a, b) => a.position - b.position)
}

const buildEffectPayload = (type: EffectType, name: string, parameters: Record<string, any> = {}) => {
  const definition = findEffectDefinition(type, name)
  if (!definition) return null
  const normalized: Record<string, any> = {}
  definition.parameters.forEach((param) => {
    if (parameters[param.name] !== undefined) {
      normalized[param.name] = parameters[param.name]
      return
    }
    if (param.default !== undefined) {
      normalized[param.name] = param.default
    }
  })

  return {
    definition,
    parameters: normalized,
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'video-service',
    timestamp: new Date().toISOString(),
    activeProjects: projectStore.size,
    supportedFormats: OUTPUT_FORMATS,
  })
})

app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain')
  res.send(await getMetrics())
})

app.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const { originalname, filename, size } = req.file
    const format = path.extname(originalname).toLowerCase().replace('.', '')
    const metadata = {
      fileName: filename,
      originalName: originalname,
      size,
      format,
      duration: 12,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
    }

    updateVideoSize(size)
    recordVideoProcessing('upload', format, 0.05)

    res.json({ success: true, data: metadata })
  } catch (error) {
    logger.error('Error uploading video', error)
    res.status(500).json({ error: 'Failed to upload video' })
  }
})

app.post('/project', async (req: Request, res: Response) => {
  try {
    const requestedFormat = (req.body.format || 'mp4').toLowerCase()
    const format: VideoFormat = OUTPUT_FORMATS.includes(requestedFormat as VideoFormat) ? (requestedFormat as VideoFormat) : 'mp4'
    const requestedQuality = (req.body.quality || 'medium').toLowerCase()
    const quality: VideoQuality = ['low', 'medium', 'high'].includes(requestedQuality) ? (requestedQuality as VideoQuality) : 'medium'
    const preset = QUALITY_PRESETS[quality]

    const project: VideoProject = {
      id: uuidv4(),
      name: req.body.name || 'Untitled Project',
      description: req.body.description,
      clips: [],
      timeline: {
        duration: 0,
        fps: Number(req.body.fps) || 30,
        resolution: {
          width: req.body?.resolution?.width || 1920,
          height: req.body?.resolution?.height || 1080,
        },
        markers: [],
      },
      settings: {
        format,
        quality,
        codec: preset.codec,
        bitrate: preset.bitrate,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    projectStore.set(project.id, project)
    updateActiveSessions(projectStore.size)
    res.status(201).json({ success: true, data: project })
  } catch (error) {
    logger.error('Error creating project', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

app.get('/project/:id', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return
  res.json({ success: true, data: project })
})

app.post('/project/:id/clips', async (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res)
    if (!project) return

    if (!req.body.fileName) {
      return res.status(400).json({ error: 'fileName is required' })
    }

    const filePath = path.join(UPLOADS_DIR, req.body.fileName)
    await fs.access(filePath).catch(() => {
      throw new Error('Clip source file not found in uploads directory')
    })

    const clip = createClip(project, req.body.fileName, req.body)
    project.clips.push(clip)
    project.updatedAt = new Date()
    syncProjectTimeline(project)
    refreshClipGauge()
    recordTimelineOperation('add_clip')

    res.status(201).json({ success: true, data: clip })
  } catch (error: any) {
    logger.error('Failed to add clip', error)
    res.status(400).json({ error: error.message || 'Failed to add clip' })
  }
})

app.put('/project/:id/clips/:clipId', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const clip = project.clips.find((c) => c.id === req.params.clipId)
  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' })
  }

  if (req.body.startTime !== undefined) {
    clip.startTime = toNumber(req.body.startTime, clip.startTime)
  }
  if (req.body.endTime !== undefined) {
    clip.endTime = toNumber(req.body.endTime, clip.endTime)
  }
  clip.duration = Math.max(0.1, clip.endTime - clip.startTime)
  if (req.body.position !== undefined) {
    clip.position = toNumber(req.body.position, clip.position)
  }
  if (req.body.track !== undefined) {
    clip.track = Math.max(0, Number(req.body.track))
  }

  clip.updatedAt = new Date().toISOString()
  project.updatedAt = new Date()
  syncProjectTimeline(project)
  recordTimelineOperation('update_clip')
  refreshClipGauge()

  res.json({ success: true, data: clip })
})

app.post('/project/:id/clips/:clipId/effects', (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res)
    if (!project) return

    const clip = project.clips.find((c) => c.id === req.params.clipId)
    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' })
    }

    const type = req.body.type as EffectType
    const name = req.body.name
    if (!type || !name) {
      return res.status(400).json({ error: 'type and name are required' })
    }

    const payload = buildEffectPayload(type, name, req.body.parameters || {})
    if (!payload) {
      return res.status(404).json({ error: 'Effect definition not found' })
    }

    const effect: VideoEffect = {
      id: uuidv4(),
      type,
      name,
      parameters: payload.parameters,
      enabled: req.body.enabled !== undefined ? Boolean(req.body.enabled) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    clip.effects.push(effect)
    project.updatedAt = new Date()
    recordEffectApplication(type, 0.01)

    res.status(201).json({ success: true, data: effect })
  } catch (error) {
    logger.error('Failed to add effect', error)
    res.status(500).json({ error: 'Failed to add effect' })
  }
})

app.post('/project/:id/clips/:clipId/effects/:effectId', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const clip = project.clips.find((c) => c.id === req.params.clipId)
  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' })
  }

  const effect = clip.effects.find((e) => e.id === req.params.effectId)
  if (!effect) {
    return res.status(404).json({ error: 'Effect not found' })
  }

  effect.parameters = { ...effect.parameters, ...(req.body.parameters || {}) }
  if (req.body.enabled !== undefined) {
    effect.enabled = Boolean(req.body.enabled)
  }
  effect.updatedAt = new Date().toISOString()
  project.updatedAt = new Date()

  res.json({ success: true, data: effect })
})

app.get('/project/:id/timeline', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return
  res.json({ success: true, data: buildTimeline(project) })
})

app.post('/project/:id/render', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const job = renderQueue.createJob(project)
  res.status(202).json({ success: true, data: job })
})

app.get('/render/:id', (req: Request, res: Response) => {
  const job = renderQueue.getJob(req.params.id)
  if (!job) {
    return res.status(404).json({ error: 'Render job not found' })
  }
  res.json({ success: true, data: job })
})

app.get('/effects', (_req: Request, res: Response) => {
  res.json({ success: true, data: listEffects() })
})

app.get('/formats', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      input: INPUT_FORMATS,
      output: OUTPUT_FORMATS,
      quality: Object.entries(QUALITY_PRESETS).map(([name, preset]) => ({
        name,
        bitrate: preset.bitrate,
        codec: preset.codec,
      })),
    },
  })
})

app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error('Error handling request', err)
  res.status(500).json({ error: err?.message || 'Internal server error' })
})

app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

const start = async () => {
  await ensureDirs()
  const server = app.listen(PORT, () => {
    logger.info(`🎬 Video Service running on port ${PORT}`)
  })
  return server
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.error('Failed to start video service', error)
    process.exit(1)
  })
}

void ensureDirs().catch((error) => logger.error('Failed to prepare directories', error))

setInterval(() => updateMemoryUsage(), 10_000).unref?.()

export { start }
export default app
