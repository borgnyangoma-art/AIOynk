import path from 'path'

export const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '../../storage')
export const ARTIFACT_STORE_FILE = path.join(STORAGE_ROOT, 'artifacts.json')
export const TOKEN_STORE_FILE = path.join(STORAGE_ROOT, 'tokens.json')
export const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads')
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3006/auth/google/callback'
export const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.aio.local'
export const MAX_VERSIONS = 30
export const USE_MOCK_GOOGLE = process.env.MOCK_GOOGLE !== 'false'
