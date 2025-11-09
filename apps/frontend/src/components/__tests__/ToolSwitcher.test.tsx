import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import ToolSwitcher from '../layout/ToolSwitcher';
import { updateToolContext, clearToolContext } from '../../store/slices/toolSlice';

const renderWithRouter = async (component: React.ReactElement, initialEntries = ['/chat']) => {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>{component}</MemoryRouter>
      </Provider>
    );
  });
  return view!;
};

describe('ToolSwitcher', () => {
  afterEach(() => {
    store.dispatch(clearToolContext('graphics'));
  });

  it('renders all tools', async () => {
    await renderWithRouter(<ToolSwitcher />);

    const tools = ['Graphics Editor', 'Web Designer', 'Code IDE', '3D CAD', 'Video Editor'];
    tools.forEach((tool) => {
      expect(screen.getByText(tool)).toBeInTheDocument();
    });
  });

  it('displays tool icons', async () => {
    await renderWithRouter(<ToolSwitcher />);

    const toolButtons = screen.getAllByRole('button');
    expect(toolButtons.length).toBeGreaterThan(0);
  });

  it('navigates when tool is clicked', async () => {
    await renderWithRouter(<ToolSwitcher />);

    const graphicsButton = screen.getByText('Graphics Editor');
    fireEvent.click(graphicsButton);

    expect(graphicsButton.closest('button')).toHaveClass('bg-blue-600');
  });

  it('applies active state to current tool', async () => {
    await renderWithRouter(<ToolSwitcher />, ['/graphics']);

    const graphicsButton = screen.getByText('Graphics Editor');
    expect(graphicsButton.closest('button')).toHaveClass('bg-blue-600');
  });

  it('shows context indicator when tool has saved state', async () => {
    store.dispatch(
      updateToolContext({
        toolId: 'graphics',
        context: { canvasData: 'mock', timestamp: Date.now() },
      })
    );
    await renderWithRouter(<ToolSwitcher />);

    const webButton = screen.getByText('Web Designer');
    fireEvent.click(webButton);

    const graphicsButton = screen.getByText('Graphics Editor');
    const indicator = graphicsButton
      .closest('div')
      ?.querySelector('.bg-orange-500');
    expect(indicator).not.toBeNull();
  });
});
