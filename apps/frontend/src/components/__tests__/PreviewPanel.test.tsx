import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import PreviewPanel from '../preview/PreviewPanel';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('PreviewPanel', () => {
  it('renders nothing when closed', () => {
    renderWithProvider(
      <PreviewPanel isOpen={false} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    renderWithProvider(
      <PreviewPanel isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText(/Preview/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderWithProvider(
      <PreviewPanel isOpen={true} onClose={onClose} />
    );

    const closeButton = screen.getByTitle('Close');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders tool-specific preview content', () => {
    store.dispatch({ type: 'tool/setCurrentTool', payload: { id: 'graphics', name: 'Graphics', icon: '🎨' } });

    renderWithProvider(
      <PreviewPanel isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText('Graphics Editor')).toBeInTheDocument();
    expect(screen.getByText(/Canvas:/)).toBeInTheDocument();
  });

  it('toggles auto-refresh', () => {
    renderWithProvider(
      <PreviewPanel isOpen={true} onClose={vi.fn()} />
    );

    const autoRefreshButton = screen.getByTitle('Auto-refresh ON');
    fireEvent.click(autoRefreshButton);

    expect(autoRefreshButton).toHaveClass('text-gray-400');
  });

  it('shows fullscreen on mobile', () => {
    renderWithProvider(
      <PreviewPanel isOpen={true} onClose={vi.fn()} isMobile={true} />
    );

    const closeButton = screen.getByTitle('Close');
    expect(closeButton).toBeInTheDocument();

    const maximizeButton = screen.queryByTitle(/Maximize/);
    expect(maximizeButton).not.toBeInTheDocument();
  });
});
