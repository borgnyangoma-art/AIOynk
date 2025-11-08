import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import ToolSwitcher from '../layout/ToolSwitcher';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('ToolSwitcher', () => {
  it('renders all tools', () => {
    renderWithRouter(<ToolSwitcher />);

    const tools = ['Graphics Editor', 'Web Designer', 'Code IDE', 'CAD', 'Video Editor'];
    tools.forEach((tool) => {
      expect(screen.getByText(tool)).toBeInTheDocument();
    });
  });

  it('displays tool icons', () => {
    renderWithRouter(<ToolSwitcher />);

    const toolButtons = screen.getAllByRole('button');
    expect(toolButtons.length).toBeGreaterThan(0);
  });

  it('navigates when tool is clicked', () => {
    renderWithRouter(<ToolSwitcher />);

    const graphicsButton = screen.getByText('Graphics Editor');
    fireEvent.click(graphicsButton);

    expect(window.location.pathname).toBe('/graphics');
  });

  it('applies active state to current tool', () => {
    window.history.pushState({}, 'Test', '/graphics');
    renderWithRouter(<ToolSwitcher />);

    const graphicsButton = screen.getByText('Graphics Editor');
    expect(graphicsButton.closest('button')).toHaveClass('bg-blue-600');
  });

  it('shows context indicator when tool has saved state', () => {
    localStorage.setItem('graphics-canvas', 'test-data');
    renderWithRouter(<ToolSwitcher />);

    const webButton = screen.getByText('Web Designer');
    fireEvent.click(webButton);

    const graphicsButton = screen.getByText('Graphics Editor');
    expect(graphicsButton.closest('div')).toContainElement(
      document.querySelector('.bg-orange-500')
    );
  });
});
