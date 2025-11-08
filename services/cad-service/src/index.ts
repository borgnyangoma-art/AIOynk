import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const app: Application = express();
const PORT = process.env.PORT || 3004;

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
    new winston.transports.File({ filename: 'logs/cad.log' })
  ]
});

// Storage
const MODELS_DIR = path.join(__dirname, '../../storage/cad-models');
const EXPORTS_DIR = path.join(__dirname, '../../storage/cad-exports');

type Model3D = {
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
  createdAt: Date;
  updatedAt: Date;
};

type Measurement = {
  type: 'distance' | 'angle' | 'area' | 'volume';
  value: number;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  from?: [number, number, number];
  to?: [number, number, number];
};

const modelStore = new Map<string, Model3D>();

// Ensure directories
const ensureDirs = async () => {
  await fs.mkdir(MODELS_DIR, { recursive: true });
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'cad-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Create 3D model from description
app.post('/model', async (req: Request, res: Response) => {
  try {
    const { description, type, parameters } = req.body;

    const modelId = uuidv4();
    const model = generateModelFromDescription(description, type, parameters);

    model.id = modelId;
    model.createdAt = new Date();
    model.updatedAt = new Date();

    modelStore.set(modelId, model);

    logger.info(`3D model created: ${modelId} (${type})`);

    res.status(201).json({
      success: true,
      data: model
    });
  } catch (error) {
    logger.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

// Get model
app.get('/model/:id', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ success: true, data: model });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get model' });
  }
});

// Update model
app.put('/model/:id', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const { parameters, material, transformations } = req.body;

    if (parameters) model.parameters = { ...model.parameters, ...parameters };
    if (material) model.material = { ...model.material, ...material };
    if (transformations) model.transformations = { ...model.transformations, ...transformations };

    model.updatedAt = new Date();

    res.json({ success: true, data: model });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update model' });
  }
});

// Generate primitive
app.post('/primitive', async (req: Request, res: Response) => {
  try {
    const { type, parameters } = req.body;

    if (!['cube', 'sphere', 'cylinder', 'torus'].includes(type)) {
      return res.status(400).json({ error: 'Invalid primitive type' });
    }

    const modelId = uuidv4();
    const model = createPrimitive(type, parameters || {});

    model.id = modelId;
    model.createdAt = new Date();
    model.updatedAt = new Date();

    modelStore.set(modelId, model);

    res.status(201).json({
      success: true,
      data: model
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate primitive' });
  }
});

// Apply transformation
app.post('/model/:id/transform', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const { type, value } = req.body;

    if (type === 'translate') {
      model.transformations.position[0] += value.x || 0;
      model.transformations.position[1] += value.y || 0;
      model.transformations.position[2] += value.z || 0;
    } else if (type === 'rotate') {
      model.transformations.rotation[0] += value.x || 0;
      model.transformations.rotation[1] += value.y || 0;
      model.transformations.rotation[2] += value.z || 0;
    } else if (type === 'scale') {
      model.transformations.scale[0] *= value.x || 1;
      model.transformations.scale[1] *= value.y || 1;
      model.transformations.scale[2] *= value.z || 1;
    }

    model.updatedAt = new Date();

    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transform model' });
  }
});

// Extrude
app.post('/model/:id/extrude', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const { depth } = req.body;

    if (model.type === 'cube') {
      model.parameters.depth = depth;
    }

    // Recalculate vertices and faces
    model.updatedAt = new Date();

    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extrude' });
  }
});

// Export model
app.post('/model/:id/export', async (req: Request, res: Response) => {
  try {
    const { format } = req.body;
    const model = modelStore.get(req.params.id);

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const validFormats = ['obj', 'stl', 'gltf', 'ply'];
    if (!validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid format. Supported: ${validFormats.join(', ')}`
      });
    }

    const fileName = `${model.id}-${Date.now()}.${format}`;
    const filePath = path.join(EXPORTS_DIR, fileName);

    let exportData = '';

    if (format === 'obj') {
      exportData = generateOBJ(model);
    } else if (format === 'stl') {
      exportData = generateSTL(model);
    } else if (format === 'gltf') {
      exportData = generateGLTF(model);
    }

    await fs.writeFile(filePath, exportData);

    logger.info(`Model exported: ${fileName}`);

    res.json({
      success: true,
      data: {
        format: format.toLowerCase(),
        fileName,
        path: filePath,
        size: exportData.length
      }
    });
  } catch (error) {
    logger.error('Error exporting model:', error);
    res.status(500).json({ error: 'Failed to export model' });
  }
});

// Get measurements
app.get('/model/:id/measurements', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const measurements = calculateMeasurements(model);

    res.json({
      success: true,
      data: measurements
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate measurements' });
  }
});

// Get views (orthographic/perspective)
app.get('/model/:id/views', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const views = {
      perspective: {
        position: [5, 5, 5],
        target: [0, 0, 0],
        fov: 75
      },
      orthographic: {
        position: [0, 0, 10],
        target: [0, 0, 0],
        zoom: 1
      },
      front: {
        position: [0, 0, 10],
        target: [0, 0, 0]
      },
      back: {
        position: [0, 0, -10],
        target: [0, 0, 0]
      },
      left: {
        position: [-10, 0, 0],
        target: [0, 0, 0]
      },
      right: {
        position: [10, 0, 0],
        target: [0, 0, 0]
      },
      top: {
        position: [0, 10, 0],
        target: [0, 0, 0]
      },
      bottom: {
        position: [0, -10, 0],
        target: [0, 0, 0]
      }
    };

    res.json({
      success: true,
      data: views
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get views' });
  }
});

// Mesh editing
app.post('/model/:id/mesh/edit', async (req: Request, res: Response) => {
  try {
    const model = modelStore.get(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const { operation, vertexIndex, value } = req.body;

    if (operation === 'move' && vertexIndex !== undefined && value) {
      const vertexIdx = vertexIndex * 3;
      if (vertexIdx < model.vertices.length) {
        model.vertices[vertexIdx] += value.x || 0;
        model.vertices[vertexIdx + 1] += value.y || 0;
        model.vertices[vertexIdx + 2] += value.z || 0;
      }
    } else if (operation === 'delete' && vertexIndex !== undefined) {
      const vertexIdx = vertexIndex * 3;
      if (vertexIdx < model.vertices.length) {
        model.vertices.splice(vertexIdx, 3);
        model.faces = model.faces.filter(face =>
          !face.includes(vertexIndex)
        );
      }
    }

    model.updatedAt = new Date();

    res.json({
      success: true,
      data: model
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit mesh' });
  }
});

// Helper functions
function generateModelFromDescription(description: string, type: string, parameters: any): Model3D {
  const lowerDesc = description.toLowerCase();

  let modelType = type;
  if (!modelType) {
    if (lowerDesc.includes('cube') || lowerDesc.includes('box')) modelType = 'cube';
    else if (lowerDesc.includes('sphere') || lowerDesc.includes('ball')) modelType = 'sphere';
    else if (lowerDesc.includes('cylinder')) modelType = 'cylinder';
    else if (lowerDesc.includes('torus') || lowerDesc.includes('donut')) modelType = 'torus';
    else modelType = 'cube';
  }

  return createPrimitive(modelType, parameters || {});
}

function createPrimitive(type: string, params: any): Model3D {
  const baseModel: Model3D = {
    id: '',
    name: `${type} model`,
    type: type as any,
    parameters: {
      width: params.width || 1,
      height: params.height || 1,
      depth: params.depth || 1,
      radius: params.radius || 0.5,
      segments: params.segments || 32
    },
    vertices: [],
    faces: [],
    material: {
      color: params.color || '#ffffff',
      metalness: params.metalness || 0,
      roughness: params.roughness || 0.5
    },
    transformations: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Generate vertices and faces based on type
  if (type === 'cube') {
    baseModel.vertices = [
      -0.5, -0.5, 0.5,
       0.5, -0.5, 0.5,
       0.5,  0.5, 0.5,
      -0.5,  0.5, 0.5,
      -0.5, -0.5, -0.5,
       0.5, -0.5, -0.5,
       0.5,  0.5, -0.5,
      -0.5,  0.5, -0.5
    ];
    baseModel.faces = [
      [0, 1, 2, 3], [4, 7, 6, 5],
      [0, 4, 5, 1], [3, 2, 6, 7],
      [0, 3, 7, 4], [1, 5, 6, 2]
    ];
  } else if (type === 'sphere') {
    // Simplified sphere generation
    const segments = baseModel.parameters.segments!;
    const vertices = [];
    for (let i = 0; i <= segments; i++) {
      const lat = Math.PI * (-0.5 + (i / segments));
      const sin = Math.sin(lat);
      const cos = Math.cos(lat);

      for (let j = 0; j <= segments; j++) {
        const lon = 2 * Math.PI * (j / segments);
        const sinLon = Math.sin(lon);
        const cosLon = Math.cos(lon);

        vertices.push(
          cos * sinLon,
          sin,
          cos * cosLon
        );
      }
    }
    baseModel.vertices = vertices;
  }

  // Apply scale
  if (params.width || params.height || params.depth) {
    const scaleX = params.width || 1;
    const scaleY = params.height || 1;
    const scaleZ = params.depth || 1;

    for (let i = 0; i < baseModel.vertices.length; i += 3) {
      baseModel.vertices[i] *= scaleX;
      baseModel.vertices[i + 1] *= scaleY;
      baseModel.vertices[i + 2] *= scaleZ;
    }
  }

  return baseModel;
}

function generateOBJ(model: Model3D): string {
  let obj = `# ${model.name}\n\n`;

  // Vertices
  for (let i = 0; i < model.vertices.length; i += 3) {
    obj += `v ${model.vertices[i]} ${model.vertices[i + 1]} ${model.vertices[i + 2]}\n`;
  }

  obj += '\n';

  // Faces
  for (const face of model.faces) {
    const indices = face.map(idx => idx + 1).join(' ');
    obj += `f ${indices}\n`;
  }

  return obj;
}

function generateSTL(model: Model3D): string {
  let stl = `solid ${model.name}\n`;

  for (const face of model.faces) {
    if (face.length >= 3) {
      const v0 = model.vertices[face[0] * 3];
      const v1 = model.vertices[face[0] * 3 + 1];
      const v2 = model.vertices[face[0] * 3 + 2];

      stl += `  facet normal 0 0 0\n    outer loop\n`;
      stl += `      vertex ${v0} ${v1} ${v2}\n`;
      stl += `    endloop\n  endfacet\n`;
    }
  }

  stl += `endsolid ${model.name}`;
  return stl;
}

function generateGLTF(model: Model3D): string {
  return JSON.stringify({
    asset: {
      version: "2.0",
      generator: "AIO CAD Service"
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: {
          POSITION: 0
        }
      }]
    }],
    buffers: [],
    bufferViews: [],
    accessors: []
  }, null, 2);
}

function calculateMeasurements(model: Model3D): Measurement[] {
  const measurements: Measurement[] = [];

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < model.vertices.length; i += 3) {
    minX = Math.min(minX, model.vertices[i]);
    minY = Math.min(minY, model.vertices[i + 1]);
    minZ = Math.min(minZ, model.vertices[i + 2]);
    maxX = Math.max(maxX, model.vertices[i]);
    maxY = Math.max(maxY, model.vertices[i + 1]);
    maxZ = Math.max(maxZ, model.vertices[i + 2]);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const depth = maxZ - minZ;

  measurements.push(
    { type: 'distance', value: width, unit: 'm', from: [minX, 0, 0], to: [maxX, 0, 0] },
    { type: 'distance', value: height, unit: 'm', from: [0, minY, 0], to: [0, maxY, 0] },
    { type: 'distance', value: depth, unit: 'm', from: [0, 0, minZ], to: [0, 0, maxZ] }
  );

  // Calculate volume (simplified)
  const volume = width * height * depth;
  measurements.push({ type: 'volume', value: volume, unit: 'm³' });

  return measurements;
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
    logger.info(`🎲 CAD Service running on port ${PORT}`);
  });
};

start().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});

export default app;
