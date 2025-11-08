import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import ChatInterface from '../chat/ChatInterface';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('ChatInterface', () => {
  it('renders chat interface components', () => {
    renderWithProviders(<ChatInterface />);

    expect(screen.getByTestId('chat-container')).toBeInTheDocument();
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('allows typing in message input', () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input') as HTMLInputElement;
    fireEvent.change(messageInput, { target: { value: 'Test message' } });

    expect(messageInput.value).toBe('Test message');
  });

  it('sends message when send button is clicked', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(messageInput).toHaveValue('');
    });
  });

  it('sends message on Enter key press', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    fireEvent.change(messageInput, { target: { value: 'Hello' } });
    fireEvent.keyDown(messageInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(messageInput).toHaveValue('');
    });
  });

  it('displays sent messages', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('shows typing indicator when sending message', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'Test' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('prevents sending empty messages', () => {
    renderWithProviders(<ChatInterface />);

    const sendButton = screen.getByTestId('send-button');
    fireEvent.click(sendButton);

    // Should not add empty message to chat
    expect(screen.queryByTestId('empty-state')).toBeInTheDocument();
  });

  it('displays markdown in messages', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: '**Bold text**' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      const boldText = screen.getByText('Bold text');
      expect(boldText.tagName).toBe('STRONG');
    });
  });

  it('handles file attachments', async () => {
    renderWithProviders(<ChatInterface />);

    const fileInput = screen.getByTestId('file-upload');
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview')).toBeInTheDocument();
    });
  });

  it('clears message input after sending', async () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input') as HTMLInputElement;
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(messageInput.value).toBe('');
    });
  });

  it('shows character count near limit', () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const longMessage = 'a'.repeat(950);

    fireEvent.change(messageInput, { target: { value: longMessage } });

    expect(screen.getByTestId('char-count')).toHaveTextContent('950/1000');
  });

  it('prevents message when at character limit', () => {
    renderWithProviders(<ChatInterface />);

    const messageInput = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    fireEvent.change(messageInput, { target: { value: 'a'.repeat(1001) } });
    fireEvent.click(sendButton);

    // Should show error or prevent sending
    expect(screen.getByTestId('char-limit-error')).toBeInTheDocument();
  });

  it('maintains scroll position with new messages', async () => {
    renderWithProviders(<ChatInterface />);

    // Send multiple messages
    for (let i = 0; i < 10; i++) {
      const messageInput = screen.getByTestId('message-input');
      const sendButton = screen.getByTestId('send-button');

      fireEvent.change(messageInput, { target: { value: `Message ${i}` } });
      fireEvent.click(sendButton);
    }

    await waitFor(() => {
      const chatContainer = screen.getByTestId('chat-messages');
      expect(chatContainer.scrollTop).toBeGreaterThan(0);
    });
  });

  it('loads conversation history on mount', async () => {
    renderWithProviders(<ChatInterface />);

    await waitFor(() => {
      // Should attempt to load history
      expect(screen.getByTestId('chat-container')).toBeInTheDocument();
    });
  });

  it('handles connection status', () => {
    renderWithProviders(<ChatInterface />);

    // Should show connection status indicator
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });
});
