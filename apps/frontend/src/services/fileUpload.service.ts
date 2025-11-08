import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  mimeType: string;
  uploadedAt: string;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'];
const SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'application/json', 'text/csv'];
const SUPPORTED_CODE_TYPES = [
  'text/javascript',
  'text/typescript',
  'text/python',
  'text/java',
  'text/cpp',
  'text/csharp',
  'text/html',
  'text/css',
  'application/json',
  'application/xml',
];

export const getFileCategory = (mimeType: string): 'image' | 'video' | 'document' | 'code' | 'other' => {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
  if (SUPPORTED_CODE_TYPES.includes(mimeType)) return 'code';
  return 'other';
};

export const isFileSizeValid = (size: number, maxSizeMB: number = 100): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const uploadFile = async (
  file: File,
  sessionId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFile> => {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!isFileSizeValid(file.size)) {
    throw new Error(`File size exceeds ${formatFileSize(100 * 1024 * 1024)} limit`);
  }

  onProgress?.({
    fileId,
    fileName: file.name,
    progress: 0,
    status: 'uploading',
  });

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('mimeType', file.type);

    const response = await axios.post(`${API_BASE_URL}/api/files/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        onProgress?.({
          fileId,
          fileName: file.name,
          progress,
          status: 'uploading',
        });
      },
    });

    onProgress?.({
      fileId,
      fileName: file.name,
      progress: 100,
      status: 'success',
      url: response.data.url,
    });

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Upload failed';
    onProgress?.({
      fileId,
      fileName: file.name,
      progress: 0,
      status: 'error',
      error: errorMessage,
    });
    throw error;
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  sessionId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFile[]> => {
  const uploadPromises = files.map(file => uploadFile(file, sessionId, onProgress));
  return Promise.all(uploadPromises);
};

export const deleteFile = async (fileId: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/files/${fileId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
};

export const getFilePreview = (file: UploadedFile): string | null => {
  if (file.mimeType.startsWith('image/')) {
    return file.url;
  }
  if (file.mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    return 'text';
  }
  return null;
};
