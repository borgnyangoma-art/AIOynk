import { Readable } from 'stream'

export type StorageLocation = 'drive' | 'local' | 'cdn'

export interface DriveUploadRequest {
  accessToken: string
  folderId: string
  fileName: string
  mimeType: string
  data: Buffer
  description?: string
}

export interface DriveUploadResponse {
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink?: string
  downloadUrl?: string
  createdTime: string
}

export interface DriveQuotaInfo {
  limit: number | null
  usage: number
  usageInDrive: number
  usageInDriveTrash: number
}

export interface ArtifactVersion {
  version: number
  storage: StorageLocation
  fileId: string
  size: number
  compressed: boolean
  checksum: string
  createdAt: string
  downloadUrl: string
  metadata: Record<string, any>
  localPath?: string
}

export interface ArtifactRecord {
  id: string
  userId: string
  tool: string
  name: string
  latestVersion: number
  createdAt: string
  updatedAt: string
  versions: ArtifactVersion[]
}

export interface OAuthTokenRecord {
  userId: string
  accessToken: string
  refreshToken: string
  expiryDate: number
  scope?: string
  tokenType?: string
  idToken?: string
  folderId?: string
  updatedAt: string
}

export interface UploadResponse {
  artifactId: string
  version: ArtifactVersion
  artifact: ArtifactRecord
}

export interface UploadContext {
  artifactId?: string
  tool: string
  name: string
  userId: string
  storage: StorageLocation
  compress?: boolean
  includeMetadata?: boolean
}

export interface DriveClient {
  getQuota(accessToken: string): Promise<DriveQuotaInfo>
  ensureAioFolder(accessToken: string, userId: string): Promise<string>
  upload(params: DriveUploadRequest): Promise<DriveUploadResponse>
}

export interface FileDownload {
  stream: Readable
  mimeType: string
  size: number
}
