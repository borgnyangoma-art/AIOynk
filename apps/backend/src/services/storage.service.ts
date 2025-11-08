import { promises as fs } from 'fs'
import path from 'path'

import config from '../utils/config'

import logger from './logger.service'

class StorageService {
  private readonly rootDir = path.resolve(config.UPLOAD_DIR)
  private readonly artifactDir = path.join(this.rootDir, 'artifacts')
  private readonly tempDir = path.join(this.rootDir, 'temp')

  async initialize(): Promise<void> {
    await Promise.all([
      this.ensureDir(this.rootDir),
      this.ensureDir(this.artifactDir),
      this.ensureDir(this.tempDir),
    ])
    logger.info(`Storage directories ready at ${this.rootDir}`)
  }

  getArtifactPath(fileName: string): string {
    return path.join(this.artifactDir, fileName)
  }

  getTempPath(fileName: string): string {
    return path.join(this.tempDir, fileName)
  }

  resolveRelative(relativePath: string): string {
    return path.join(this.rootDir, relativePath)
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
  }
}

export default new StorageService()
