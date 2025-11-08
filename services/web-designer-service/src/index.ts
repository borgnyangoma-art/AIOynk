import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import puppeteer from 'puppeteer';

import { componentLibrary } from './componentLibrary';
import { checkAccessibility } from './wcag';
import { wrapWithResponsivePreview } from './responsive';

const app: Application = express();
const PORT = process.env.PORT || 3002;

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
    new winston.transports.File({ filename: 'logs/web-designer.log' })
  ]
});

// Storage
const PROJECTS_DIR = path.join(__dirname, '../../storage/web-projects');
const PREVIEWS_DIR = path.join(__dirname, '../../storage/previews');
const COMPONENTS_DIR = path.join(__dirname, '../shared/components');

type Framework = 'react' | 'vue' | 'vanilla'

type WebProject = {
  id: string;
  name: string;
  html: string;
  css: string;
  framework?: Framework;
  responsive: boolean;
  components: string[];
  createdAt: Date;
  updatedAt: Date;
};

const projectStore = new Map<string, WebProject>();

// Ensure directories
const ensureDirs = async () => {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(PREVIEWS_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'web-designer-service',
    timestamp: new Date().toISOString()
  });
});

const convertToReact = (html: string) => {
  return html
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/style="([^"]+)"/g, (_, styles) => {
      const styleObj = styles
        .split(';')
        .filter(Boolean)
        .map((rule: string) => rule.trim())
        .map((rule: string) => {
          const [prop, value] = rule.split(':')
          if (!prop || !value) return ''
          const camelProp = prop
            .trim()
            .replace(/-([a-z])/g, (_, char) => char.toUpperCase())
          return `${camelProp}: '${value.trim()}'`
        })
        .filter(Boolean)
        .join(', ')
      return `style={{ ${styleObj} }}`
    })
}

const convertToVue = (html: string) => {
  return html
    .replace(/class=/g, ':class=')
    .replace(/style="([^"]+)"/g, (_, styles) => {
      return `:style="'${styles}'"`
    })
}

const appendComponents = (project: WebProject, componentIds: string[]) => {
  let htmlSnippet = ''
  let cssSnippet = ''

  componentIds.forEach((id) => {
    const component = componentLibrary.find((item) => item.id === id)
    if (!component) return
    htmlSnippet += `\n${component.html.trim()}`
    if (component.css) {
      cssSnippet += `\n${component.css.trim()}`
    }
    if (!project.components.includes(id)) {
      project.components.push(id)
    }
  })

  if (htmlSnippet) {
    project.html = project.html.replace('</body>', `${htmlSnippet}\n</body>`)
  }

  if (cssSnippet) {
    project.css = `${project.css}\n${cssSnippet}`
  }
}

const getProjectOr404 = (req: Request, res: Response) => {
  const project = projectStore.get(req.params.id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }
  return project
}

// Create project
app.post('/project', async (req: Request, res: Response) => {
  try {
    const { name, framework } = req.body;

    const projectId = uuidv4();
    const project: WebProject = {
      id: projectId,
      name: name || 'Untitled Project',
      html: '<!DOCTYPE html>\n<html>\n<head>\n  <title></title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>',
      css: 'body { font-family: Arial, sans-serif; background: #f8fafc; }',
      framework: framework || 'vanilla',
      responsive: true,
      components: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    projectStore.set(projectId, project);

    logger.info(`Web project created: ${projectId}`);

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
    const project = getProjectOr404(req, res)
    if (!project) return
    res.json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project' })
  }
});

// Update project
app.put('/project/:id', async (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res);
    if (!project) return;

    const { name, html, css, framework, responsive, components } = req.body;

    if (name !== undefined) project.name = name;
    if (html !== undefined) project.html = html;
    if (css !== undefined) project.css = css;
    if (framework !== undefined) project.framework = framework;
    if (responsive !== undefined) project.responsive = responsive;
    if (components !== undefined) project.components = components;
    project.updatedAt = new Date();

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Generate from natural language
app.post('/generate', async (req: Request, res: Response) => {
  try {
    const { description, framework } = req.body;

    // Simple generation based on keywords
    let html = '';
    let css = '';

    if (description.toLowerCase().includes('landing page')) {
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Landing Page</title>
          <link rel="stylesheet" href="styles.css">
        </head>
        <body>
          <header>
            <nav>
              <div class="logo">Logo</div>
              <ul>
                <li><a href="#">Home</a></li>
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <section class="hero">
              <h1>Welcome to Our Service</h1>
              <p>The best solution for your needs</p>
              <button>Get Started</button>
            </section>
            <section class="features">
              <h2>Features</h2>
              <div class="feature-grid">
                <div class="feature">Feature 1</div>
                <div class="feature">Feature 2</div>
                <div class="feature">Feature 3</div>
              </div>
            </section>
          </main>
          <footer>
            <p>&copy; 2024 All rights reserved</p>
          </footer>
        </body>
        </html>
      `;
      css = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        header { background: #333; color: white; padding: 1rem 0; }
        nav { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        nav ul { display: flex; list-style: none; gap: 2rem; }
        nav a { color: white; text-decoration: none; }
        .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; padding: 5rem 2rem; text-align: center; }
        .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
        .hero button { background: #fff; color: #667eea; padding: 1rem 2rem;
                       border: none; border-radius: 5px; cursor: pointer; font-size: 1rem; }
        .features { padding: 4rem 2rem; max-width: 1200px; margin: 0 auto; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 2rem; }
        .feature { background: #f4f4f4; padding: 2rem; border-radius: 8px; text-align: center; }
        footer { background: #333; color: white; text-align: center; padding: 2rem; }
      `;
    } else {
      html = `<h1>${description}</h1>`;
      css = 'h1 { text-align: center; padding: 2rem; }';
    }

    if (framework === 'react') {
      html = html
        .replace(/<!DOCTYPE html>/gi, '')
        .replace(/<html>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head>[\s\S]*?<\/head>/gi, '')
        .replace(/<body>/gi, '')
        .replace(/<\/body>/gi, '')
      html = convertToReact(html)
    } else if (framework === 'vue') {
      html = html
        .replace(/<!DOCTYPE html>/gi, '')
        .replace(/<html>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head>[\s\S]*?<\/head>/gi, '')
        .replace(/<body>/gi, '')
        .replace(/<\/body>/gi, '')
      html = convertToVue(html)
    }

    res.json({
      success: true,
      data: {
        html,
        css,
        framework: framework || 'vanilla',
        message: 'Generated successfully'
      }
    });
  } catch (error) {
    logger.error('Error generating:', error);
    res.status(500).json({ error: 'Failed to generate' });
  }
});

// Generate preview
app.post('/project/:id/preview', async (req: Request, res: Response) => {
  try {
    const project = getProjectOr404(req, res);
    if (!project) return;

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${project.name}</title>
        <style>${project.css}</style>
      </head>
      <body>
        ${project.html}
      </body>
      </html>
    `;

    await page.setContent(fullHtml);
    await page.setViewport({ width: 1920, height: 1080 });

    const screenshot = await page.screenshot({ fullPage: true });
    await browser.close();

    const fileName = `preview-${project.id}-${Date.now()}.png`;
    const filePath = path.join(PREVIEWS_DIR, fileName);

    await fs.writeFile(filePath, screenshot);

    res.json({
      success: true,
      data: {
        fileName,
        path: filePath,
        url: `/previews/${fileName}`
      }
    });
  } catch (error) {
    logger.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// Component library
app.get('/components', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: componentLibrary,
  })
})

// Append components to project
app.post('/project/:id/components', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const { componentIds } = req.body as { componentIds: string[] }
  if (!Array.isArray(componentIds) || componentIds.length === 0) {
    return res.status(400).json({ error: 'componentIds must be a non-empty array' })
  }

  appendComponents(project, componentIds)
  project.updatedAt = new Date()

  res.json({ success: true, data: project })
})

// Responsive preview metadata
app.get('/project/:id/responsive-preview', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const previews = wrapWithResponsivePreview(project.html, project.css)
  res.json({ success: true, data: previews })
})

// Accessibility check
app.get('/project/:id/accessibility', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const issues = checkAccessibility(project.html, project.css)
  res.json({
    success: true,
    data: {
      issues,
      summary: issues.length === 0 ? 'No accessibility issues detected' : `${issues.length} issues found`,
    },
  })
})

// Framework-specific export
app.post('/project/:id/framework', (req: Request, res: Response) => {
  const project = getProjectOr404(req, res)
  if (!project) return

  const { framework } = req.body as { framework: Framework }
  if (!framework) {
    return res.status(400).json({ error: 'framework is required' })
  }

  let exported = project.html
  if (framework === 'react') {
    exported = convertToReact(exported)
  } else if (framework === 'vue') {
    exported = convertToVue(exported)
  }

  res.json({
    success: true,
    data: {
      framework,
      html: exported,
      css: project.css,
    },
  })
})


// Error handlers
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
export const start = async () => {
  await ensureDirs()
  return app.listen(PORT, () => {
    logger.info(`🌐 Web Designer Service running on port ${PORT}`)
  })
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.error('Failed to start:', error)
    process.exit(1)
  })
}

export default app
