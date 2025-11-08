import { Artifact } from '../types';

export interface ExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf' | 'json' | 'zip';
  quality?: number;
  includeMetadata?: boolean;
}

export const exportAsJSON = (data: any, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
};

export const exportAsText = (content: string, filename: string, mimeType: string = 'text/plain') => {
  downloadFile(content, filename, mimeType);
};

export const exportAsImage = (dataURL: string, filename: string, format: 'png' | 'jpg' = 'png') => {
  const link = document.createElement('a');
  link.download = `${filename}.${format}`;
  link.href = dataURL;
  link.click();
};

export const exportAsSVG = (svgContent: string, filename: string) => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMultipleAsZip = async (files: { name: string; content: string | Blob; type: string }[], filename: string) => {
  const JSZip = await import('jszip').then(m => m.default);
  const zip = new JSZip();

  files.forEach(file => {
    zip.file(file.name, file.content);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  downloadFile(content, `${filename}.zip`, 'application/zip');
};

export const exportAsPDF = async (canvas: HTMLCanvasElement, filename: string) => {
  const { jsPDF } = await import('jspdf');
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
};

export const createProjectArchive = async (projectData: {
  name: string;
  tool: string;
  files: { path: string; content: string; type: string }[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    author?: string;
  };
}) => {
  const JSZip = await import('jszip').then(m => m.default);
  const zip = new JSZip();

  zip.file('project.json', JSON.stringify(projectData.metadata, null, 2));

  projectData.files.forEach(file => {
    const folder = file.path.split('/').slice(0, -1).join('/');
    const fileName = file.path.split('/').pop() || file.path;

    if (folder) {
      const folderPath = folder.split('/');
      let currentFolder = zip;
      folderPath.forEach(part => {
        if (part) {
          currentFolder = currentFolder.folder(part) || currentFolder;
        }
      });
      currentFolder.file(fileName, file.content);
    } else {
      zip.file(fileName, file.content);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  downloadFile(content, `${projectData.name}.aio`, 'application/zip');
};

const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportArtifact = async (artifact: Artifact, options?: ExportOptions) => {
  const { format = 'png', quality = 1, includeMetadata = true } = options || {};

  let data: any = artifact.data;
  let filename = artifact.name || 'export';
  let mimeType = artifact.mimeType || 'application/octet-stream';

  if (includeMetadata) {
    const exportData = {
      artifact: {
        ...artifact,
        exportedAt: new Date().toISOString(),
        exportFormat: format,
      }
    };

    if (format === 'json') {
      exportAsJSON(exportData, filename);
      return;
    }
  }

  switch (format) {
    case 'png':
    case 'jpg':
      if (typeof data === 'string' && data.startsWith('data:')) {
        exportAsImage(data, filename, format);
      } else if (data instanceof HTMLCanvasElement) {
        const dataURL = data.toDataURL(`image/${format}`, quality);
        exportAsImage(dataURL, filename, format);
      }
      break;

    case 'svg':
      if (typeof data === 'string') {
        exportAsSVG(data, filename);
      }
      break;

    case 'pdf':
      if (data instanceof HTMLCanvasElement) {
        await exportAsPDF(data, filename);
      }
      break;

    case 'json':
      exportAsJSON(data, filename);
      break;

    case 'zip':
      if (Array.isArray(data)) {
        const files = data.map((item: any) => ({
          name: item.name || `${artifact.tool}-${Date.now()}`,
          content: typeof item === 'string' ? item : JSON.stringify(item),
          type: 'text/plain'
        }));
        await exportMultipleAsZip(files, filename);
      }
      break;
  }
};

export const exportAllArtifacts = async (artifacts: Artifact[], options?: ExportOptions) => {
  if (artifacts.length === 0) {
    throw new Error('No artifacts to export');
  }

  if (artifacts.length === 1) {
    await exportArtifact(artifacts[0], options);
    return;
  }

  const JSZip = await import('jszip').then(m => m.default);
  const zip = new JSZip();

  for (const artifact of artifacts) {
    const artifactFolder = zip.folder(artifact.tool) || zip;

    let content: string | Blob;
    let extension: string;

    switch (artifact.type) {
      case 'image':
        if (typeof artifact.data === 'string' && artifact.data.startsWith('data:')) {
          const response = await fetch(artifact.data);
          content = await response.blob();
          extension = artifact.data.split(';')[0].split('/')[1] || 'png';
        } else {
          content = JSON.stringify(artifact.data, null, 2);
          extension = 'json';
        }
        break;

      case 'code':
        content = typeof artifact.data === 'string' ? artifact.data : JSON.stringify(artifact.data, null, 2);
        extension = 'txt';
        break;

      case '3d-model':
        content = JSON.stringify(artifact.data, null, 2);
        extension = 'json';
        break;

      case 'video':
        content = JSON.stringify(artifact.data, null, 2);
        extension = 'json';
        break;

      default:
        content = JSON.stringify(artifact.data, null, 2);
        extension = 'json';
    }

    artifactFolder.file(`${artifact.name || 'untitled'}.${extension}`, content);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadFile(content, 'artifacts-export.zip', 'application/zip');
};
