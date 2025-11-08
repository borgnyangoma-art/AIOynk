import { describe, it, expect } from 'vitest';
import { store } from '../../store/store';
import { setCurrentTool, updateToolContext } from '../../store/slices/toolSlice';
import { addMessage } from '../../store/slices/chatSlice';

describe('Store', () => {
  it('should initialize with correct state', () => {
    const state = store.getState();

    expect(state.tool.currentTool).toBeNull();
    expect(state.tool.tools).toHaveLength(5);
    expect(state.chat.messages).toEqual([]);
  });

  it('should handle tool actions', () => {
    const mockTool = { id: 'graphics', name: 'Graphics', icon: '🎨' };

    store.dispatch(setCurrentTool(mockTool));
    let state = store.getState();

    expect(state.tool.currentTool).toEqual(mockTool);

    const context = { canvasData: 'test', timestamp: 123456 };
    store.dispatch(updateToolContext({ toolId: 'graphics', context }));
    state = store.getState();

    expect(state.tool.contexts.graphics).toEqual(context);
  });

  it('should handle chat actions', () => {
    const message = {
      id: '1',
      content: 'Test message',
      sender: 'user',
      timestamp: Date.now(),
      type: 'text' as const,
    };

    store.dispatch(addMessage(message));
    const state = store.getState();

    expect(state.chat.messages).toHaveLength(1);
    expect(state.chat.messages[0]).toEqual(message);
  });

  it('should persist state changes', () => {
    const mockTool = { id: 'web', name: 'Web', icon: '🌐' };
    store.dispatch(setCurrentTool(mockTool));

    const newStore = store;
    expect(newStore.getState().tool.currentTool).toEqual(mockTool);
  });
});
