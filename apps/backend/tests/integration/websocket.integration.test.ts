import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import jwtService from '../../src/services/jwt.service';

describe('WebSocket Integration Tests', () => {
  let io: Server;
  let serverSocket: any;
  let clientSocket: any;
  let httpServer: any;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: '*',
      },
    });

    io.on('connection', (socket) => {
      serverSocket = socket;
    });

    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  describe('Chat message events', () => {
    it('should receive and emit chat messages', (done) => {
      const message = {
        type: 'chat_message',
        data: {
          message: 'Test message',
          sessionId: 'test-session',
        },
      };

      clientSocket.emit('chat_message', message);

      serverSocket.on('chat_message', (receivedMessage: any) => {
        expect(receivedMessage).toEqual(message);
        done();
      });
    });

    it('should handle message with authentication', (done) => {
      const token = jwtService.generateAccessToken({ userId: '123', email: 'test@example.com' });

      clientSocket.emit('authenticate', { token });

      serverSocket.on('authenticated', (data: any) => {
        expect(data.userId).toBe('123');
        done();
      });
    });

    it('should send response to client', (done) => {
      const message = {
        type: 'chat_message',
        data: {
          message: 'Hello',
          sessionId: 'test',
        },
      };

      clientSocket.emit('chat_message', message);

      clientSocket.on('chat_response', (response: any) => {
        expect(response).toHaveProperty('type', 'chat_response');
        expect(response.data).toBeDefined();
        done();
      });
    });
  });

  describe('Tool switching events', () => {
    it('should handle tool switch event', (done) => {
      const toolSwitch = {
        type: 'switch_tool',
        data: {
          tool: 'graphics',
        },
      };

      clientSocket.emit('switch_tool', toolSwitch);

      serverSocket.on('tool_switched', (data: any) => {
        expect(data.tool).toBe('graphics');
        done();
      });
    });

    it('should preserve context when switching tools', (done) => {
      // Send initial message
      clientSocket.emit('chat_message', {
        type: 'chat_message',
        data: { message: 'Create a blue circle', sessionId: 'test' },
      });

      // Switch tool
      clientSocket.emit('switch_tool', {
        type: 'switch_tool',
        data: { tool: 'graphics' },
      });

      // Verify context is preserved
      serverSocket.on('context_preserved', (data: any) => {
        expect(data.previousMessage).toBe('Create a blue circle');
        done();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid message format', (done) => {
      clientSocket.emit('invalid_event', { invalid: 'data' });

      serverSocket.on('error', (error: any) => {
        expect(error.message).toContain('Invalid');
        done();
      });
    });

    it('should handle unauthorized access', (done) => {
      clientSocket.emit('chat_message', {
        type: 'chat_message',
        data: { message: 'Test' },
      });

      serverSocket.on('unauthorized', (error: any) => {
        expect(error.message).toContain('unauthorized');
        done();
      });
    });
  });

  describe('Connection management', () => {
    it('should handle disconnect', (done) => {
      serverSocket.on('disconnect', () => {
        done();
      });

      clientSocket.disconnect();
    });

    it('should handle reconnection', (done) => {
      clientSocket.on('reconnect', () => {
        done();
      });

      clientSocket.connect();
    });
  });
});
