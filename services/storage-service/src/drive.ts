import { google } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'

import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  USE_MOCK_GOOGLE,
} from './config'
import logger from './logger'
import {
  DriveClient,
  DriveQuotaInfo,
  DriveUploadRequest,
  DriveUploadResponse,
} from './types'

class GoogleDriveClient implements DriveClient {
  private oauth2 = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  )

  async getQuota(accessToken: string): Promise<DriveQuotaInfo> {
    this.oauth2.setCredentials({ access_token: accessToken })
    const drive = google.drive({ version: 'v3', auth: this.oauth2 })
    const { data } = await drive.about.get({ fields: 'storageQuota' })
    return {
      limit: Number(data.storageQuota?.limit || 0),
      usage: Number(data.storageQuota?.usage || 0),
      usageInDrive: Number(data.storageQuota?.usageInDrive || 0),
      usageInDriveTrash: Number(data.storageQuota?.usageInDriveTrash || 0),
    }
  }

  async ensureAioFolder(accessToken: string, userId: string) {
    this.oauth2.setCredentials({ access_token: accessToken })
    const drive = google.drive({ version: 'v3', auth: this.oauth2 })
    const query = `mimeType='application/vnd.google-apps.folder' and properties has { key='aio_user_id' and value='${userId}' }`
    const files = await drive.files.list({ q: query, fields: 'files(id)' })
    if (files.data.files && files.data.files.length) {
      return files.data.files[0].id as string
    }
    const folder = await drive.files.create({
      requestBody: {
        name: `AIO Creative Hub - ${userId}`,
        mimeType: 'application/vnd.google-apps.folder',
        properties: { aio_user_id: userId },
      },
      fields: 'id',
    })
    return folder.data.id as string
  }

  async upload(params: DriveUploadRequest): Promise<DriveUploadResponse> {
    this.oauth2.setCredentials({ access_token: params.accessToken })
    const drive = google.drive({ version: 'v3', auth: this.oauth2 })
    const response = await drive.files.create({
      requestBody: {
        name: params.fileName,
        parents: [params.folderId],
        description: params.description,
      },
      media: {
        mimeType: params.mimeType,
        body: Buffer.from(params.data),
      },
      fields: 'id,name,mimeType,size,webViewLink,createdTime',
    })
    const data = response.data
    return {
      id: data.id as string,
      name: data.name as string,
      mimeType: data.mimeType as string,
      size: Number(data.size || params.data.length),
      webViewLink: data.webViewLink || undefined,
      createdTime: data.createdTime || new Date().toISOString(),
    }
  }
}

class MemoryDriveClient implements DriveClient {
  private quota: DriveQuotaInfo = {
    limit: 15 * 1024 * 1024 * 1024,
    usage: 0,
    usageInDrive: 0,
    usageInDriveTrash: 0,
  }
  private folders = new Map<string, string>()
  private files = new Map<string, DriveUploadResponse & { data: Buffer }>()

  async getQuota(): Promise<DriveQuotaInfo> {
    return this.quota
  }

  async ensureAioFolder(_accessToken: string, userId: string) {
    if (!this.folders.has(userId)) {
      this.folders.set(userId, uuidv4())
    }
    return this.folders.get(userId) as string
  }

  async upload(params: DriveUploadRequest): Promise<DriveUploadResponse> {
    const id = uuidv4()
    const record: DriveUploadResponse & { data: Buffer } = {
      id,
      name: params.fileName,
      mimeType: params.mimeType,
      size: params.data.length,
      createdTime: new Date().toISOString(),
      webViewLink: `https://drive.google.mock/file/${id}`,
      downloadUrl: `https://drive.google.mock/uc?id=${id}`,
      data: Buffer.from(params.data),
    }
    this.files.set(id, record)
    this.quota.usage += record.size
    this.quota.usageInDrive += record.size
    return record
  }
}

export const driveClient: DriveClient = USE_MOCK_GOOGLE
  ? new MemoryDriveClient()
  : new GoogleDriveClient()
