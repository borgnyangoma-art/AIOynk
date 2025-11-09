import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import { promises as fs } from 'fs'
import path from 'path'
import zlib from 'zlib'
import { v4 as uuidv4 } from 'uuid'

import {
  CDN_BASE_URL,
  UPLOADS_DIR,
  STORAGE_ROOT,
} from './config'
import logger from './logger'
import { driveClient } from './drive'
import { GoogleOAuthService } from './oauth'
import { ArtifactStore, TokenStore, checksumBuffer } from './store'
import {
  uploadCounter,
  exportCounter,
  quotaGauge,
  getMetrics,
  recordHttp,
} from './metrics'
import {
  ArtifactVersion,
  StorageLocation,
  UploadContext,
} from './types'

const app = express()
const PORT = process.env.PORT || 3006

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

const artifactStore = new ArtifactStore()
const tokenStore = new TokenStore()
const oauthService = new GoogleOAuthService(tokenStore)

const boot = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await artifactStore.load()
  await tokenStore.load()
}

const gzipIfNeeded = async (buffer: Buffer, force: boolean) => {
  if (!force && buffer.length < 5 * 1024 * 1024) {
    return { buffer, compressed: false }
  }
  return {
    buffer: await new Promise<Buffer>((resolve, reject) => {
      zlib.gzip(buffer, (err, result) => (err ? reject(err) : resolve(result)))
    }),
    compressed: true,
  }
}

const saveLocalFile = async (
  userId: string,
  artifactId: string,
  version: number,
  buffer: Buffer,
  originalName: string,
) => {
  const ext = path.extname(originalName) || '.bin'
  const artifactDir = path.join(UPLOADS_DIR, userId, artifactId)
  await fs.mkdir(artifactDir, { recursive: true })
  const filePath = path.join(artifactDir, `v${version}${ext}`)
  await fs.writeFile(filePath, buffer)
  return filePath
}

const getLocalUsage = async (userId?: string) => {
  const dir = userId ? path.join(UPLOADS_DIR, userId) : UPLOADS_DIR
  const exists = await fs
    .stat(dir)
    .then(() => true)
    .catch(() => false)
  if (!exists) return 0
  let total = 0
  const walk = async (target: string) => {
    const entries = await fs.readdir(target, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(target, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        const stat = await fs.stat(full)
        total += stat.size
      }
    }
  }
  await walk(dir)
  return total
}

app.use((req, res, next) => {
  res.on('finish', () => recordHttp(req.method, req.path, res.statusCode))
  next()
})

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'storage-service',
    timestamp: new Date().toISOString(),
  })
})

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(await getMetrics())
})

app.get('/auth/google/url', (req, res) => {
  const { userId = 'anonymous' } = req.query
  const state = Buffer.from(
    JSON.stringify({ userId, ts: Date.now() }),
  ).toString('base64url')
  const url = oauthService.generateAuthUrl(state)
  res.json({ success: true, data: { url, state } })
})

app.post('/auth/google/token', async (req, res) => {
  try {
    const { code, userId } = req.body
    if (!code || !userId) {
      return res.status(400).json({ error: 'code and userId required' })
    }
    const tokens = await oauthService.exchangeCode(String(userId), String(code))
    const folderId = await driveClient.ensureAioFolder(
      tokens.access_token || tokens.accessToken,
      String(userId),
    )
    await tokenStore.update(String(userId), {
      folderId,
    })
    res.json({
      success: true,
      data: {
        accessToken: tokens.access_token || tokens.accessToken,
        expiresIn: tokens.expiry_date,
        folderId,
      },
    })
  } catch (error) {
    logger.error('OAuth exchange failed', error)
    res.status(500).json({ error: 'Failed to exchange code' })
  }
})

app.get('/auth/google/status/:userId', (req, res) => {
  const record = tokenStore.get(req.params.userId)
  if (!record) {
    return res.status(404).json({ error: 'No tokens stored' })
  }
  res.json({
    success: true,
    data: {
      folderId: record.folderId || null,
      updatedAt: record.updatedAt,
      expiresAt: record.expiryDate,
    },
  })
})

const handleUpload = async (
  file: Express.Multer.File,
  context: UploadContext,
): Promise<{ version: ArtifactVersion; artifactId: string }> => {
  const artifactId = context.artifactId || uuidv4()
  const checksum = checksumBuffer(file.buffer)
  const { buffer, compressed } = await gzipIfNeeded(
    file.buffer,
    context.compress ?? false,
  )

  let storageUsed: StorageLocation = context.storage
  let fileId = uuidv4()
  let downloadUrl = ''
  let localPath: string | undefined

  if (context.storage === 'drive') {
    const tokens = tokenStore.get(context.userId)
    if (!tokens?.accessToken) {
      storageUsed = 'local'
      logger.warn('Drive upload requested but no tokens available, fallback to local')
    } else {
      const folderId =
        tokens.folderId ||
        (await driveClient.ensureAioFolder(tokens.accessToken, context.userId))
      if (!tokens.folderId) {
        await tokenStore.update(context.userId, { folderId })
      }
      try {
        const driveResp = await driveClient.upload({
          accessToken: tokens.accessToken,
          folderId,
          fileName: file.originalname || `${artifactId}.bin`,
          mimeType: file.mimetype,
          data: buffer,
          description: `AIO artifact ${artifactId}`,
        })
        fileId = driveResp.id
        downloadUrl =
          driveResp.webViewLink || driveResp.downloadUrl || `https://drive.google.com/file/d/${driveResp.id}/view`
      } catch (error) {
        logger.error('Drive upload failed, storing locally', error)
        storageUsed = 'local'
      }
    }
  }

  if (storageUsed === 'local' || storageUsed === 'cdn') {
    localPath = await saveLocalFile(
      context.userId,
      artifactId,
      (artifactStore.get(artifactId)?.latestVersion || 0) + 1,
      buffer,
      file.originalname || `${artifactId}.bin`,
    )
    downloadUrl =
      storageUsed === 'cdn'
        ? `${CDN_BASE_URL}/artifacts/${artifactId}/latest`
        : `/files/${artifactId}/download`
  }

  const version: ArtifactVersion = {
    version: 0,
    storage: storageUsed,
    fileId,
    size: buffer.length,
    compressed,
    checksum,
    createdAt: new Date().toISOString(),
    downloadUrl,
    metadata: {
      originalName: file.originalname,
      mimeType: file.mimetype,
    },
    localPath,
  }

  const artifact = await artifactStore.addVersion(context, version)
  uploadCounter.inc({ storage: storageUsed, tool: context.tool })
  exportCounter.inc({ tool: context.tool })

  return { version, artifactId: artifact.id }
}

app.post('/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' })
    }
    const { userId, tool, name, storage = 'drive', artifactId, compress } = req.body
    if (!userId || !tool || !name) {
      return res.status(400).json({ error: 'userId, tool and name are required' })
    }
    const context: UploadContext = {
      artifactId,
      userId,
      tool,
      name,
      storage: storage as StorageLocation,
      compress: compress === 'true' || compress === true,
    }

    const result = await handleUpload(req.file, context)
    res.status(201).json({ success: true, data: result })
  } catch (error) {
    logger.error('Upload failed', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

app.get('/users/:userId/files', (req, res) => {
  const artifacts = artifactStore.listByUser(req.params.userId)
  res.json({ success: true, data: artifacts })
})

app.get('/files/:artifactId/versions', (req, res) => {
  const artifact = artifactStore.get(req.params.artifactId)
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' })
  }
  res.json({ success: true, data: artifact.versions })
})

app.get('/files/:artifactId/download', async (req, res) => {
  const artifact = artifactStore.get(req.params.artifactId)
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' })
  }
  const versionParam = req.query.version ? Number(req.query.version) : artifact.latestVersion
  const version = artifact.versions.find((v) => v.version === versionParam)
  if (!version) {
    return res.status(404).json({ error: 'Version not found' })
  }
  if (!version.localPath) {
    return res.json({
      success: true,
      data: { downloadUrl: version.downloadUrl, storage: version.storage },
    })
  }
  try {
    const stream = await fs.readFile(version.localPath)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.send(stream)
  } catch (error) {
    logger.error('Failed to read local file', error)
    res.status(500).json({ error: 'Failed to read file' })
  }
})

app.get('/storage/quota/:userId', async (req, res) => {
  const record = tokenStore.get(req.params.userId)
  const localUsage = await getLocalUsage(req.params.userId)
  quotaGauge.set({ type: 'local' }, localUsage)
  try {
    const driveInfo = record?.accessToken
      ? await driveClient.getQuota(record.accessToken)
      : null
    if (driveInfo) {
      quotaGauge.set({ type: 'drive' }, driveInfo.usage)
    }
    res.json({
      success: true,
      data: {
        drive: driveInfo,
        local: {
          usage: localUsage,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to fetch quota', error)
    res.status(500).json({ error: 'Failed to fetch quota' })
  }
})

boot()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`💾 Storage service running on port ${PORT}`)
    })
  })
  .catch((error) => {
    logger.error('Failed to start storage service', error)
    process.exit(1)
  })

export default app
