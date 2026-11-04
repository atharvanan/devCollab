import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Specification (PDF Page 35, PERF-001)
// Target: High Concurrency Kanban Board & SLA Metrics
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 virtual users
    { duration: '1m', target: 50 },   // Sustained peak at 50 virtual users
    { duration: '20s', target: 0 },   // Graceful ramp-down
  ],
  thresholds: {
    // 95% of requests must complete within 200ms
    http_req_duration: ['p(95)<200'],
    // Error rate must remain below 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5000/api/v1';
const PROJECT_ID = __ENV.PROJECT_ID || '672000000000000000000001';

export function setup() {
  // Pre-authenticate a benchmark user
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'lucas.devops@devcollab.com',
    password: 'DevCollab123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const authData = loginRes.json();
  return { token: authData.data?.accessToken || '' };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  };

  // 1. Fetch Board Summary & SLA Compliance
  const boardRes = http.get(`${BASE_URL}/board/${PROJECT_ID}`, params);
  check(boardRes, {
    'board status is 200': (r) => r.status === 200,
    'response has tasks payload': (r) => r.json('data.tasks') !== undefined,
  });

  sleep(0.5);
}

