import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 1 }, // Warm up
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 400 }, // Stress test - go beyond normal capacity
    { duration: '5m', target: 400 },
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.2'], // Allow higher error rate during stress
    errors: ['rate<0.2'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Generate test data
function getRandomMessage() {
  const messages = [
    'Create a blue circle',
    'Build a landing page for a SaaS product',
    'Write a Python function to calculate fibonacci',
    'Design a 3D model of a house',
    'Edit a video with fade transition',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'TestPassword123!',
  });
  const loginData = JSON.parse(loginRes.body);
  return { authToken: loginData.accessToken };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.authToken}`,
  };

  // Stress test: Send multiple concurrent requests
  const requests = [
    {
      method: 'POST',
      url: `${BASE_URL}/api/chat/message`,
      body: JSON.stringify({
        message: getRandomMessage(),
        sessionId: 'stress-test-session',
      }),
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/graphics/canvases`,
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/ide/projects`,
      params: { headers },
    },
    {
      method: 'GET',
      url: `${BASE_URL}/api/web-designer/projects`,
      params: { headers },
    },
  ];

  const responses = http.batch(requests);

  // Check all responses
  responses.forEach((res, index) => {
    const success = check(res, {
      [`request ${index}: status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
      [`request ${index}: response time < 1000ms`]: (r) => r.timings.duration < 1000,
    });

    errorRate.add(!success);
  });

  // Random short sleep
  sleep(Math.random() * 0.5);
}

export function teardown(data) {
  console.log('Stress test completed');
}
