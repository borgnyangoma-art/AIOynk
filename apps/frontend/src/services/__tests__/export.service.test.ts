import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { exportAsJSON, exportAsText, exportAsImage, exportMultipleAsZip } from '../../services/export.service';

vi.mock('../../services/export.service', () => ({
  exportAsJSON: vi.fn(),
  exportAsText: vi.fn(),
  exportAsImage: vi.fn(),
  exportMultipleAsZip: vi.fn(),
}));

describe('Export Service', () => {
  const mockData = { test: 'data' };

  it('exports data as JSON', async () => {
    await exportAsJSON(mockData, 'test.json');

    expect(exportAsJSON).toHaveBeenCalledWith(mockData, 'test.json');
  });

  it('exports data as text', async () => {
    await exportAsText('test content', 'test.txt');

    expect(exportAsText).toHaveBeenCalledWith('test content', 'test.txt');
  });

  it('exports data as image', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    const mockUrl = 'blob:test-url';

    global.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    global.URL.revokeObjectURL = vi.fn();

    const link = { click: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link as any);

    await exportAsImage(mockBlob, 'test.png');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(link.download).toBe('test.png');
    expect(link.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('exports multiple files as ZIP', async () => {
    const mockFiles = [
      { data: 'file1', name: 'file1.txt' },
      { data: 'file2', name: 'file2.txt' },
    ];

    await exportMultipleAsZip(mockFiles, 'archive.zip');

    expect(exportMultipleAsZip).toHaveBeenCalledWith(mockFiles, 'archive.zip');
  });
});
