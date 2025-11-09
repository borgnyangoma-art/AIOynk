import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

import { ARTIFACT_STORE_FILE, TOKEN_STORE_FILE, MAX_VERSIONS, STORAGE_ROOT } from './config'
import { ArtifactRecord, ArtifactVersion, OAuthTokenRecord, UploadContext } from './types'

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true })
}

export class ArtifactStore {
  private artifacts = new Map<string, ArtifactRecord>()

  async load() {
    await ensureDir(STORAGE_ROOT)
    try {
      const data = await fs.readFile(ARTIFACT_STORE_FILE, 'utf-8')
      const parsed: ArtifactRecord[] = JSON.parse(data)
      parsed.forEach((record) => this.artifacts.set(record.id, record))
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  private async persist() {
    await fs.writeFile(
      ARTIFACT_STORE_FILE,
      JSON.stringify(Array.from(this.artifacts.values()), null, 2),
      'utf-8',
    )
  }

  listByUser(userId: string) {
    return Array.from(this.artifacts.values()).filter((artifact) => artifact.userId === userId)
  }

  get(artifactId: string) {
    return this.artifacts.get(artifactId) || null
  }

  async addVersion(context: UploadContext, version: ArtifactVersion) {
    let artifact = this.artifacts.get(context.artifactId || '')
    if (!artifact) {
      const id = context.artifactId || uuidv4()
      artifact = {
        id,
        userId: context.userId,
        tool: context.tool,
        name: context.name,
        latestVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
      }
      this.artifacts.set(id, artifact)
    }

    version.version = artifact.latestVersion + 1
    artifact.latestVersion = version.version
    artifact.updatedAt = new Date().toISOString()
    artifact.versions.unshift(version)

    if (artifact.versions.length > MAX_VERSIONS) {
      artifact.versions = artifact.versions.slice(0, MAX_VERSIONS)
    }

    await this.persist()
    return artifact
  }
}

export class TokenStore {
  private tokens = new Map<string, OAuthTokenRecord>()

  async load() {
    await ensureDir(STORAGE_ROOT)
    try {
      const data = await fs.readFile(TOKEN_STORE_FILE, 'utf-8')
      const parsed: OAuthTokenRecord[] = JSON.parse(data)
      parsed.forEach((record) => this.tokens.set(record.userId, record))
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  private async persist() {
    await fs.writeFile(
      TOKEN_STORE_FILE,
      JSON.stringify(Array.from(this.tokens.values()), null, 2),
      'utf-8',
    )
  }

  async set(userId: string, record: Omit<OAuthTokenRecord, 'userId'>) {
    const payload = {
      userId,
      ...record,
      updatedAt: new Date().toISOString(),
    } satisfies OAuthTokenRecord
    this.tokens.set(userId, payload)
    await this.persist()
    return payload
  }

  async update(userId: string, patch: Partial<OAuthTokenRecord>) {
    const existing = this.tokens.get(userId)
    if (!existing) return null
    const payload: OAuthTokenRecord = {
      ...existing,
      ...patch,
      userId,
      updatedAt: new Date().toISOString(),
    }
    this.tokens.set(userId, payload)
    await this.persist()
    return payload
  }

  get(userId: string) {
    return this.tokens.get(userId) || null
  }
}

export const checksumBuffer = (buffer: Buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex')
