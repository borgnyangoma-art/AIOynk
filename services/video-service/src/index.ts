import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import multer from 'multer';

const app: Application = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/video.log' })
  ]
});

// Storage
const UPLOADS_DIR = path.join(__dirname, '../../storage/video-uploads');
const PROJECTS_DIR = path.join(__dirname, '../../storage/video-projects');
const RENDERS_DIR = path.join(__dirname, '../../storage/video-renders');

// Configure multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

type VideoClip = {
  id: string;
  fileName: string;
  filePath: string;
  duration: number;
  startTime: number;
  endTime: number;
  position: number;
  effects: VideoEffect[];
};

type VideoEffect = {
  type: 'filter' | 'transition' | 'text' | 'audio';
  name: string;
  parameters: Record<string, any>;
  enabled: boolean;
};

type VideoProject = {
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
  createdAt: Date;
  updatedAt: Date;
};

type RenderJob = {
  id: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
};

const projectStore = new Map<string, VideoProject>();
const renderJobs = new Map<string, RenderJob>();

// Ensure directories
const ensureDirs = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(RENDERS_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'video-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Upload video
app.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const { originalname, filename, size } = req.file;

    // Simulate video metadata extraction
    const metadata = {
      format: path.extname(originalname).toLowerCase().replace('.', ''),
      size,
      duration: 10, // Simulated
      fps: 30,
      resolution: { width: 1920, height: 1080 }
    };

    logger.info(`Video uploaded: ${filename}`);

    res.json({
      success: true,
      data: {
        fileName: filename,
        originalName: originalname,
        size,
        metadata
      }
    });
  } catch (error) {
    logger.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Create project
app.post('/project', async (req: Request, res: Response) => {
  try {
    const { name, format, quality } = req.body;

    const projectId = uuidv4();
    const project: VideoProject = {
      id: projectId,
      name: name || 'Untitled Project',
      clips: [],
      timeline: {
        duration: 0,
        fps: 30,
        resolution: { width: 1920, height: 1080 }
      },
      settings: {
        format: format || 'mp4',
        quality: quality || 'medium',
        codec: 'h264'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    projectStore.set(projectId, project);

    logger.info(`Video project created: ${projectId}`);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get project
app.get('/project/:id', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Add clip to project
app.post('/project/:id/clips', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { fileName, startTime, endTime, position } = req.body;

    const clipId = uuidv4();
    const clip: VideoClip = {
      id: clipId,
      fileName,
      filePath: path.join(UPLOADS_DIR, fileName),
      duration: (endTime - startTime) || 5,
      startTime: startTime || 0,
      endTime: endTime || 5,
      position: position || 0,
      effects: []
    };

    project.clips.push(clip);
    project.updatedAt = new Date();

    // Update timeline duration
    const maxEnd = Math.max(...project.clips.map(c => c.position + c.duration));
    project.timeline.duration = maxEnd;

    res.status(201).json({
      success: true,
      data: clip
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add clip' });
  }
});

// Update clip
app.put('/project/:id/clips/:clipId', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const clipIndex = project.clips.findIndex(c => c.id === req.params.clipId);
    if (clipIndex === -1) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    const { startTime, endTime, position, effects } = req.body;

    if (startTime !== undefined) {
      project.clips[clipIndex].startTime = startTime;
      project.clips[clipIndex].duration = (endTime - startTime) || project.clips[clipIndex].duration;
    }
    if (endTime !== undefined) {
      project.clips[clipIndex].endTime = endTime;
      project.clips[clipIndex].duration = (endTime - project.clips[clipIndex].startTime);
    }
    if (position !== undefined) {
      project.clips[clipIndex].position = position;
    }
    if (effects !== undefined) {
      project.clips[clipIndex].effects = effects;
    }

    project.updatedAt = new Date();

    res.json({
      success: true,
      data: project.clips[clipIndex]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update clip' });
  }
});

// Add effect
app.post('/project/:id/clips/:clipId/effects', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const clip = project.clips.find(c => c.id === req.params.clipId);
    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    const { type, name, parameters } = req.body;

    const effect: VideoEffect = {
      type,
      name,
      parameters: parameters || {},
      enabled: true
    };

    clip.effects.push(effect);
    project.updatedAt = new Date();

    res.status(201).json({
      success: true,
      data: effect
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add effect' });
  }
});

// Get available effects
app.get('/effects', async (req: Request, res: Response) => {
  try {
    const effects = {
      filters: [
        { name: 'blur', parameters: ['radius'], description: 'Gaussian blur' },
        { name: 'brightness', parameters: ['value'], description: 'Adjust brightness' },
        { name: 'contrast', parameters: ['value'], description: 'Adjust contrast' },
        { name: 'saturation', parameters: ['value'], description: 'Adjust saturation' },
        { name: 'grayscale', parameters: [], description: 'Convert to grayscale' },
        { name: 'sepia', parameters: [], description: 'Sepia tone effect' }
      ],
      transitions: [
        { name: 'fade', parameters: ['duration'], description: 'Fade in/out' },
        { name: 'slide', parameters: ['direction', 'duration'], description: 'Slide transition' },
        { name: 'dissolve', parameters: ['duration'], description: 'Dissolve transition' },
        { name: 'wipe', parameters: ['direction', 'duration'], description: 'Wipe transition' }
      ],
      text: [
        { name: 'title', parameters: ['text', 'position', 'size'], description: 'Add text overlay' },
        { name: 'subtitle', parameters: ['text', 'position', 'timing'], description: 'Add subtitle' },
        { name: 'watermark', parameters: ['text', 'opacity', 'position'], description: 'Add watermark' }
      ]
    };

    res.json({ success: true, data: effects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get effects' });
  }
});

// Apply effect
app.post('/project/:id/clips/:clipId/effects/:effectId', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const clip = project.clips.find(c => c.id === req.params.clipId);
    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    const effect = clip.effects.find(e => e.name === req.params.effectId);
    if (!effect) {
      return res.status(404).json({ error: 'Effect not found' });
    }

    const { parameters, enabled } = req.body;

    if (parameters) {
      effect.parameters = { ...effect.parameters, ...parameters };
    }
    if (enabled !== undefined) {
      effect.enabled = enabled;
    }

    project.updatedAt = new Date();

    res.json({
      success: true,
      data: effect
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply effect' });
  }
});

// Render video
app.post('/project/:id/render', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const renderId = uuidv4();
    const renderJob: RenderJob = {
      id: renderId,
      projectId: project.id,
      status: 'pending',
      progress: 0,
      startTime: new Date()
    };

    renderJobs.set(renderId, renderJob);

    // Simulate rendering process
    renderVideoAsync(project, renderJob);

    res.status(202).json({
      success: true,
      data: {
        renderId,
        status: 'pending',
        message: 'Rendering started'
      }
    });
  } catch (error) {
    logger.error('Error starting render:', error);
    res.status(500).json({ error: 'Failed to start rendering' });
  }
});

// Get render status
app.get('/render/:id', async (req: Request, res: Response) => {
  try {
    const renderJob = renderJobs.get(req.params.id);
    if (!renderJob) {
      return res.status(404).json({ error: 'Render job not found' });
    }
    res.json({ success: true, data: renderJob });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get render status' });
  }
});

// Get timeline
app.get('/project/:id/timeline', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate timeline with frame-accurate positioning
    const timeline = {
      duration: project.timeline.duration,
      fps: project.timeline.fps,
      resolution: project.timeline.resolution,
      clips: project.clips.map(clip => ({
        id: clip.id,
        name: clip.fileName,
        start: clip.position,
        end: clip.position + clip.duration,
        duration: clip.duration,
        effects: clip.effects.filter(e => e.enabled).length
      }))
    };

    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Get supported formats
app.get('/formats', async (req: Request, res: Response) => {
  try {
    const formats = {
      input: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv'],
      output: [
        { format: 'mp4', codec: 'h264', description: 'MP4 with H.264' },
        { format: 'mp4', codec: 'h265', description: 'MP4 with H.265' },
        { format: 'avi', codec: 'xvid', description: 'AVI with Xvid' },
        { format: 'mov', codec: 'prores', description: 'QuickTime with ProRes' },
        { format: 'webm', codec: 'vp9', description: 'WebM with VP9' }
      ],
      quality: [
        { name: 'low', bitrate: '1000k' },
        { name: 'medium', bitrate: '2500k' },
        { name: 'high', bitrate: '5000k' }
      ]
    };

    res.json({ success: true, data: formats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get formats' });
  }
});

// Helper functions
async function renderVideoAsync(project: VideoProject, renderJob: RenderJob) {
  try {
    renderJob.status = 'processing';
    renderJob.progress = 0;

    // Simulate rendering process with progress updates
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      renderJob.progress = i;
      logger.info(`Rendering project ${project.id}: ${i}%`);
    }

    // Generate output file
    const outputFileName = `${project.id}-${Date.now()}.${project.settings.format}`;
    const outputPath = path.join(RENDERS_DIR, outputFileName);

    // Simulate output
    await fs.writeFile(outputPath, 'Simulated video render');

    renderJob.status = 'completed';
    renderJob.progress = 100;
    renderJob.outputPath = outputPath;
    renderJob.endTime = new Date();

    logger.info(`Render completed: ${outputFileName}`);

  } catch (error: any) {
    renderJob.status = 'failed';
    renderJob.error = error.message;
    renderJob.endTime = new Date();

    logger.error(`Render failed: ${error.message}`);
  }
}

// Error handlers
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const start = async () => {
  await ensureDirs();
  app.listen(PORT, () => {
    logger.info(`🎬 Video Service running on port ${PORT}`);
  });
};

start().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});

export default app;
