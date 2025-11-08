import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1000ms
    http_req_failed: ['rate<0.1'], // Error rate < 10%
    errors: ['rate<0.1'], // Custom error rate < 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  // Setup - login and get tokens
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'TestPassword123!',
  });

  const loginData = JSON.parse(loginRes.body);
  return {
    authToken: loginData.accessToken,
    userId: loginData.user?.id,
  };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.authToken}`,
  };

  // Test 1: Chat message endpoint
  const chatRes = http.post(
    `${BASE_URL}/api/chat/message`,
    JSON.stringify({
      message: 'Test message for load testing',
      sessionId: 'test-session',
    }),
    { headers }
  );

  const chatSuccess = check(chatRes, {
    'chat: status is 200': (r) => r.status === 200,
    'chat: response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!chatSuccess);

  // Test 2: Health check (no auth required)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health: status is 200': (r) => r.status === 200,
  });

  // Test 3: Get user profile
  const profileRes = http.get(`${BASE_URL}/api/auth/profile`, { headers });
  check(profileRes, {
    'profile: status is 200': (r) => r.status === 200,
  });

  // Test 4: Get canvas from graphics service
  const canvasRes = http.get(`${BASE_URL}/api/graphics/canvases`, { headers });
  check(canvasRes, {
    'canvas: status is 200': (r) => r.status === 200,
  });

  // Test 5: Get projects from IDE service
  const projectsRes = http.get(`${BASE_URL}/api/ide/projects`, { headers });
  check(projectsRes, {
    'projects: status is 200': (r) => r.status === 200,
  });

  // Random sleep between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  // Cleanup if needed
}
