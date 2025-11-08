import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import GraphicsEditor from '../tools/GraphicsEditor';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('GraphicsEditor', () => {
  it('renders graphics editor interface', () => {
    renderWithProviders(<GraphicsEditor />);

    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
  });

  it('creates new canvas', async () => {
    renderWithProviders(<GraphicsEditor />);

    fireEvent.click(screen.getByText('New Canvas'));
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '600' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });
  });

  it('adds rectangle shape', async () => {
    renderWithProviders(<GraphicsEditor />);

    // Wait for canvas to load
    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toContainHTML('rect');
    });
  });

  it('adds circle shape', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('circle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 200, y: 200 } });

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toContainHTML('circle');
    });
  });

  it('selects object when clicked', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add a shape first
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Select the shape
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    await waitFor(() => {
      expect(screen.getByTestId('selection-box')).toBeInTheDocument();
    });
  });

  it('changes fill color of selected object', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add and select a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Change color
    fireEvent.change(screen.getByTestId('fill-color'), { target: { value: '#ff0000' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toContainHTML('#ff0000');
    });
  });

  it('undoes last action', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Undo
    fireEvent.click(screen.getByTestId('undo-button'));

    await waitFor(() => {
      // Shape should be removed
      const shapes = screen.queryAllByTestId('canvas-object');
      expect(shapes.length).toBe(0);
    });
  });

  it('redoes undone action', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add shape and undo
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });
    fireEvent.click(screen.getByTestId('undo-button'));

    // Redo
    fireEvent.click(screen.getByTestId('redo-button'));

    await waitFor(() => {
      expect(screen.getByTestId('canvas-object')).toBeInTheDocument();
    });
  });

  it('exports canvas as PNG', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Export
    fireEvent.click(screen.getByText('Export'));
    fireEvent.change(screen.getByTestId('export-format'), { target: { value: 'png' } });
    fireEvent.click(screen.getByText('Download'));

    // File download should be triggered
    await waitFor(() => {
      expect(screen.getByTestId('download-complete')).toBeInTheDocument();
    });
  });

  it('saves canvas state', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Save
    fireEvent.click(screen.getByText('Save'));
    fireEvent.change(screen.getByTestId('canvas-name'), { target: { value: 'My Canvas' } });
    fireEvent.click(screen.getByText('Save Canvas'));

    await waitFor(() => {
      expect(screen.getByText('Canvas saved')).toBeInTheDocument();
    });
  });

  it('loads saved canvas', async () => {
    renderWithProviders(<GraphicsEditor />);

    fireEvent.click(screen.getByText('Load'));
    fireEvent.click(screen.getByText('My Canvas'));

    await waitFor(() => {
      expect(screen.getByTestId('canvas-object')).toBeInTheDocument();
    });
  });

  it('deletes selected object', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add and select a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Delete
    fireEvent.keyDown(screen.getByTestId('canvas'), { key: 'Delete' });

    await waitFor(() => {
      expect(screen.queryByTestId('canvas-object')).not.toBeInTheDocument();
    });
  });

  it('shows object count in statistics', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add two shapes
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });
    fireEvent.click(screen.getByTestId('circle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 200, y: 200 } });

    fireEvent.click(screen.getByText('Statistics'));

    await waitFor(() => {
      expect(screen.getByTestId('object-count')).toHaveTextContent('2');
    });
  });

  it('zooms canvas in and out', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('zoom-in'));
    expect(screen.getByTestId('canvas')).toHaveStyle({ transform: 'scale(1.1)' });

    fireEvent.click(screen.getByTestId('zoom-out'));
    expect(screen.getByTestId('canvas')).toHaveStyle({ transform: 'scale(1)' });
  });

  it('applies filter to canvas', async () => {
    renderWithProviders(<GraphicsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    // Add a shape
    fireEvent.click(screen.getByTestId('rectangle-tool'));
    fireEvent.click(screen.getByTestId('canvas'), { position: { x: 100, y: 100 } });

    // Apply filter
    fireEvent.click(screen.getByText('Filters'));
    fireEvent.click(screen.getByText('Blur'));
    fireEvent.change(screen.getByTestId('filter-intensity'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toHaveStyle({ filter: 'blur(5px)' });
    });
  });
});
