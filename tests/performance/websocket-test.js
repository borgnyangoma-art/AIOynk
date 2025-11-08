import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ws_connecting: ['p(95)<1000'],
    ws_session_duration: ['p(95)<30000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.WS_URL || 'ws://localhost:3000/ws';

export function setup() {
  // Get auth token first
  const loginRes = http.post('http://localhost:3000/api/auth/login', {
    email: 'test@example.com',
    password: 'TestPassword123!',
  });
  const loginData = JSON.parse(loginRes.body);
  return { authToken: loginData.accessToken };
}

export default function (data) {
  const url = `${BASE_URL}?token=${data.authToken}`;

  const params = {
    tags: {
      my_tag: 'websocket_test',
    },
  };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      console.log('WebSocket connected');

      // Send chat message
      socket.send(JSON.stringify({
        type: 'chat_message',
        data: {
          message: 'WebSocket load test message',
          sessionId: 'test-session',
        },
      }));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'message: has type': (m) => m.type !== undefined,
        'message: has data': (m) => m.data !== undefined,
      });
    });

    socket.on('close', () => {
      console.log('WebSocket closed');
    });

    socket.on('error', (e) => {
      console.log('WebSocket error:', e.error());
      errorRate.add(1);
    });

    // Keep connection alive for random duration
    const duration = Math.random() * 10 + 5;
    socket.setTimeout(() => {
      socket.close();
    }, duration * 1000);
  });

  check(res, {
    'WebSocket connection: status is 101': (r) => r && r.status === 101,
  });
}
