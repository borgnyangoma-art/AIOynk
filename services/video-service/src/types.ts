export type EffectType = 'filter' | 'transition' | 'text' | 'audio'
export type VideoFormat = 'mp4' | 'avi' | 'mov' | 'webm'
export type VideoQuality = 'low' | 'medium' | 'high'

export type EffectParameterSchema = {
  name: string
  type: 'number' | 'string' | 'enum'
  default?: number | string
  min?: number
  max?: number
  options?: string[]
}

export type EffectDefinition = {
  type: EffectType
  name: string
  description: string
  parameters: EffectParameterSchema[]
}

export type VideoEffect = {
  id: string
  type: EffectType
  name: string
  parameters: Record<string, any>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type VideoClip = {
  id: string
  fileName: string
  filePath: string
  duration: number
  startTime: number
  endTime: number
  position: number
  track: number
  effects: VideoEffect[]
  createdAt: string
  updatedAt: string
}

export type TimelineMarker = {
  label: string
  position: number
}

export type VideoProject = {
  id: string
  name: string
  description?: string
  clips: VideoClip[]
  timeline: {
    duration: number
    fps: number
    resolution: {
      width: number
      height: number
    }
    markers: TimelineMarker[]
  }
  settings: {
    format: VideoFormat
    quality: VideoQuality
    codec: string
    bitrate: string
  }
  createdAt: Date
  updatedAt: Date
}

export type RenderJobStatus = 'pending' | 'processing' | 'encoding' | 'completed' | 'failed'

export type RenderJob = {
  id: string
  projectId: string
  format: VideoFormat
  resolution: string
  status: RenderJobStatus
  progress: number
  framesRendered: number
  framesTotal: number
  outputPath?: string
  error?: string
  startTime: string
  endTime?: string
}

export type UploadMetadata = {
  fileName: string
  originalName: string
  size: number
  format: string
  duration: number
  fps: number
  resolution: { width: number; height: number }
}
