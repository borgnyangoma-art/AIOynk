import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const requestTime = Trend('request_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Start with low load
    { duration: '1m', target: 100 }, // Ramp up
    { duration: '1m', target: 100 }, // Maintain to trigger rate limit
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Get token once and reuse
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

  // Make rapid requests to test rate limiting (100 requests/minute)
  const requests = Array(20).fill(null).map(() => ({
    method: 'GET',
    url: `${BASE_URL}/api/chat/messages`,
    params: { headers },
  }));

  const responses = http.batch(requests);

  responses.forEach((res) => {
    requestTime.add(res.timings.duration);

    const success = check(res, {
      'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'status 200: response time < 500ms': (r) => r.status === 200 ? r.timings.duration < 500 : true,
      'status 429: rate limit hit': (r) => r.status === 429 ? r.json('error')?.includes('rate') : false,
    });

    errorRate.add(!success);
  });

  // Small delay between batches
  sleep(0.1);
}
