import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Tool, Artifact } from '../../types'

interface GraphicsContext {
  canvasData?: string
  objects?: any[]
  selectedTool?: string
  color?: string
  brushSize?: number
}

interface WebDesignerContext {
  html?: string
  css?: string
  selectedBlocks?: string[]
  currentView?: 'visual' | 'code'
}

interface IDEContext {
  files?: { id: string; name: string; code: string; language: string }[]
  activeFileId?: string
  currentLanguage?: string
  output?: string
}

interface CADContext {
  currentPrimitive?: string
  width?: number
  height?: number
  depth?: number
  radius?: number
  color?: string
  position?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number }
  scale?: { x: number; y: number; z: number }
}

interface VideoEditorContext {
  clips?: any[]
  currentTime?: number
  duration?: number
  selectedClip?: string | null
}

interface ToolContexts {
  graphics?: GraphicsContext
  web?: WebDesignerContext
  ide?: IDEContext
  cad?: CADContext
  video?: VideoEditorContext
}

interface ToolState {
  currentTool: Tool | null
  tools: Tool[]
  artifacts: Artifact[]
  contexts: ToolContexts
  isLoading: boolean
  error: string | null
}

const initialState: ToolState = {
  currentTool: null,
  tools: [
    {
      id: 'graphics',
      name: 'Graphics Editor',
      icon: '🎨',
      color: '#ec4899',
      description: 'Design graphics and edit images',
    },
    {
      id: 'web',
      name: 'Web Designer',
      icon: '🌐',
      color: '#3b82f6',
      description: 'Create websites and web layouts',
    },
    {
      id: 'ide',
      name: 'Code IDE',
      icon: '💻',
      color: '#10b981',
      description: 'Write and run code',
    },
    {
      id: 'cad',
      name: '3D CAD',
      icon: '🎲',
      color: '#f59e0b',
      description: 'Create 3D models and designs',
    },
    {
      id: 'video',
      name: 'Video Editor',
      icon: '🎬',
      color: '#8b5cf6',
      description: 'Edit videos and animations',
    },
  ],
  artifacts: [],
  contexts: {},
  isLoading: false,
  error: null,
}

const toolSlice = createSlice({
  name: 'tool',
  initialState,
  reducers: {
    setCurrentTool: (state, action: PayloadAction<Tool>) => {
      state.currentTool = action.payload
    },
    updateToolContext: (
      state,
      action: PayloadAction<{ toolId: string; context: any }>
    ) => {
      const { toolId, context } = action.payload
      state.contexts[toolId as keyof ToolContexts] = {
        ...state.contexts[toolId as keyof ToolContexts],
        ...context,
      }
    },
    clearToolContext: (state, action: PayloadAction<string>) => {
      const toolId = action.payload
      state.contexts[toolId as keyof ToolContexts] = undefined
    },
    addArtifact: (state, action: PayloadAction<Artifact>) => {
      state.artifacts.unshift(action.payload)
    },
    addArtifacts: (state, action: PayloadAction<Artifact[]>) => {
      state.artifacts = [...action.payload, ...state.artifacts]
    },
    updateArtifact: (state, action: PayloadAction<Artifact>) => {
      const index = state.artifacts.findIndex((a) => a.id === action.payload.id)
      if (index !== -1) {
        state.artifacts[index] = action.payload
      }
    },
    deleteArtifact: (state, action: PayloadAction<string>) => {
      state.artifacts = state.artifacts.filter((a) => a.id !== action.payload)
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
})

export const {
  setCurrentTool,
  updateToolContext,
  clearToolContext,
  addArtifact,
  addArtifacts,
  updateArtifact,
  deleteArtifact,
  setLoading,
  setError,
} = toolSlice.actions

export default toolSlice.reducer
