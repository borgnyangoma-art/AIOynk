import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Docker from 'dockerode';
import esprima from 'esprima';

const app: Application = express();
const PORT = process.env.PORT || 3003;
const docker = new Docker();

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
    new winston.transports.File({ filename: 'logs/ide.log' })
  ]
});

// Storage
const PROJECTS_DIR = path.join(__dirname, '../../storage/ide-projects');
const EXECUTIONS_DIR = path.join(__dirname, '../../storage/executions');

type CodeProject = {
  id: string;
  name: string;
  language: 'python' | 'javascript' | 'java' | 'cpp' | 'typescript';
  code: string;
  files: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

type ExecutionResult = {
  id: string;
  projectId: string;
  status: 'running' | 'success' | 'error' | 'timeout';
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
};

const projectStore = new Map<string, CodeProject>();
const executionStore = new Map<string, ExecutionResult>();

// Ensure directories
const ensureDirs = async () => {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(EXECUTIONS_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ide-service',
    timestamp: new Date().toISOString(),
    docker: !!docker
  });
});

// Create project
app.post('/project', async (req: Request, res: Response) => {
  try {
    const { name, language, code } = req.body;

    if (!['python', 'javascript', 'java', 'cpp', 'typescript'].includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    const projectId = uuidv4();
    const project: CodeProject = {
      id: projectId,
      name: name || 'Untitled Project',
      language,
      code: code || getDefaultCode(language),
      files: { 'main': code || getDefaultCode(language) },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    projectStore.set(projectId, project);

    logger.info(`IDE project created: ${projectId} (${language})`);

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

// Update project
app.put('/project/:id', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { name, code, fileName, fileContent } = req.body;

    if (name !== undefined) project.name = name;
    if (code !== undefined) {
      project.code = code;
      if (fileName) {
        project.files[fileName] = code;
      }
    }
    project.updatedAt = new Date();

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Run code
app.post('/project/:id/run', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    const execution: ExecutionResult = {
      id: executionId,
      projectId: project.id,
      status: 'running',
      output: '',
      executionTime: 0
    };

    executionStore.set(executionId, execution);

    res.status(202).json({
      success: true,
      data: {
        executionId,
        message: 'Execution started',
        status: 'running'
      }
    });

    // Execute in background
    executeCode(project, executionId, startTime);

  } catch (error) {
    logger.error('Error starting execution:', error);
    res.status(500).json({ error: 'Failed to run code' });
  }
});

// Get execution status
app.get('/execution/:id', async (req: Request, res: Response) => {
  try {
    const execution = executionStore.get(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json({ success: true, data: execution });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

// Get execution output (stream)
app.get('/execution/:id/output', async (req: Request, res: Response) => {
  try {
    const execution = executionStore.get(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.write(`data: ${JSON.stringify(execution)}\n\n`);

    if (execution.status === 'success' || execution.status === 'error' || execution.status === 'timeout') {
      res.end();
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get output' });
  }
});

// Get syntax errors
app.post('/project/:id/syntax', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const errors: Array<{ line: number; message: string; severity: string }> = [];

    try {
      if (project.language === 'javascript' || project.language === 'typescript') {
        esprima.parseScript(project.code, { loc: true, tolerant: true });
      }
      // For other languages, add parsers as needed
    } catch (err: any) {
      errors.push({
        line: err.lineNumber || 0,
        message: err.description || err.message,
        severity: 'error'
      });
    }

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
        lineCount: project.code.split('\n').length,
        charCount: project.code.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check syntax' });
  }
});

// List projects
app.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = Array.from(projectStore.values()).map(p => ({
      id: p.id,
      name: p.name,
      language: p.language,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Security scan
app.post('/project/:id/security', async (req: Request, res: Response) => {
  try {
    const project = projectStore.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const vulnerabilities: string[] = [];

    // Check for dangerous patterns
    if (project.code.includes('eval(')) {
      vulnerabilities.push('Use of eval() - can lead to code injection');
    }
    if (project.code.includes('exec(')) {
      vulnerabilities.push('Use of exec() - can execute arbitrary code');
    }
    if (project.code.includes('subprocess.call') && project.language === 'python') {
      vulnerabilities.push('subprocess.call without proper sanitization');
    }
    if (project.code.includes('shell=True')) {
      vulnerabilities.push('shell=True can lead to command injection');
    }
    if (project.code.match(/process\.exit\(/)) {
      vulnerabilities.push('process.exit() can terminate the application unexpectedly');
    }

    const recommendations = [
      'Avoid using eval() and exec()',
      'Sanitize all user inputs',
      'Use parameterized queries for database access',
      'Implement proper error handling',
      'Validate file paths to prevent directory traversal',
      'Use least-privilege principle for file system access',
      'Enable CORS properly',
      'Implement rate limiting'
    ];

    res.json({
      success: true,
      data: {
        vulnerabilities: vulnerabilities.length,
        vulnerable: vulnerabilities.length > 0,
        issues: vulnerabilities,
        recommendations
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan for security issues' });
  }
});

// Helper functions
function getDefaultCode(language: string): string {
  switch (language) {
    case 'python':
      return `print("Hello, World!")`;
    case 'javascript':
      return `console.log("Hello, World!");`;
    case 'java':
      return `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`;
    case 'cpp':
      return `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`;
    case 'typescript':
      return `console.log("Hello, World!");`;
    default:
      return '';
  }
}

async function executeCode(project: CodeProject, executionId: string, startTime: number) {
  const execution = executionStore.get(executionId);
  if (!execution) return;

  try {
    // Simulate code execution
    await new Promise(resolve => setTimeout(resolve, 1000));

    let output = '';
    let exitCode = 0;

    // Simulated execution based on language
    if (project.language === 'python') {
      output = 'Hello, World!\n';
    } else if (project.language === 'javascript') {
      output = 'Hello, World!\n';
    } else if (project.language === 'java') {
      output = 'Hello, World!\n';
    } else if (project.language === 'cpp') {
      output = 'Hello, World!\n';
    } else {
      output = 'Code executed\n';
    }

    const executionTime = Date.now() - startTime;

    execution.status = exitCode === 0 ? 'success' : 'error';
    execution.output = output;
    execution.executionTime = executionTime;
    execution.exitCode = exitCode;

    logger.info(`Code executed: ${executionId} in ${executionTime}ms`);

  } catch (error: any) {
    execution.status = 'error';
    execution.error = error.message;
    execution.executionTime = Date.now() - startTime;

    logger.error(`Execution failed: ${executionId}`, error);
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
    logger.info(`💻 IDE Service running on port ${PORT}`);
  });
};

start().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});

export default app;
