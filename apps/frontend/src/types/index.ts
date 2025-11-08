// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Session Types
export interface Session {
  id: string;
  userId: string;
  context: Context;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Context {
  variables: Record<string, any>;
  references: Array<{
    artifactId: string;
    tool: string;
    name: string;
    description?: string;
    timestamp: string;
  }>;
  summary: string;
  tokenCount: number;
}

// Message Types
export interface Message {
  id: string;
  sessionId: string;
  content: string;
  sender: 'user' | 'system';
  intent?: Intent;
  createdAt: string;
}

export interface Intent {
  tool: 'graphics' | 'web' | 'ide' | 'cad' | 'video' | 'chat';
  action: string;
  parameters: Record<string, any>;
  confidence: number;
  needsClarification: boolean;
  suggestions: string[];
}

// Tool Types
export interface Tool {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  tool: string;
  type: string;
  name: string;
  data: any;
  metadata: Record<string, any>;
  filePath?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

// Project Types
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  artifacts: Artifact[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// Graphics Service Types
export interface Canvas {
  id: string;
  width: number;
  height: number;
  background?: string;
  elements: CanvasElement[];
  createdAt: string;
  updatedAt: string;
}

export interface CanvasElement {
  id: string;
  type: string;
  properties: Record<string, any>;
  createdAt: string;
}

// Web Designer Types
export interface WebProject {
  id: string;
  name: string;
  html: string;
  css: string;
  framework?: 'react' | 'vue' | 'vanilla';
  responsive: boolean;
  components: string[];
  createdAt: string;
  updatedAt: string;
}

// IDE Types
export interface CodeProject {
  id: string;
  name: string;
  language: 'python' | 'javascript' | 'java' | 'cpp' | 'typescript';
  code: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResult {
  id: string;
  projectId: string;
  status: 'running' | 'success' | 'error' | 'timeout';
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
}

// CAD Types
export interface Model3D {
  id: string;
  name: string;
  type: 'cube' | 'sphere' | 'cylinder' | 'torus' | 'custom';
  parameters: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    segments?: number;
  };
  vertices: number[];
  faces: number[][];
  material: {
    color: string;
    metalness?: number;
    roughness?: number;
  };
  transformations: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Measurement {
  type: 'distance' | 'angle' | 'area' | 'volume';
  value: number;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  from?: [number, number, number];
  to?: [number, number, number];
}

// Video Types
export interface VideoProject {
  id: string;
  name: string;
  clips: VideoClip[];
  timeline: {
    duration: number;
    fps: number;
    resolution: {
      width: number;
      height: number;
    };
  };
  settings: {
    format: 'mp4' | 'avi' | 'mov' | 'webm';
    quality: 'low' | 'medium' | 'high';
    codec: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VideoClip {
  id: string;
  fileName: string;
  filePath: string;
  duration: number;
  startTime: number;
  endTime: number;
  position: number;
  effects: VideoEffect[];
}

export interface VideoEffect {
  type: 'filter' | 'transition' | 'text' | 'audio';
  name: string;
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface RenderJob {
  id: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  startTime: string;
  endTime?: string;
}
