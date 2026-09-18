// tests/load/k6/api.js
// Нагрузочный тест HTTP API Crucix

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const apiRequests = new Counter('api_requests_total');
const apiLatency = new Trend('api_latency_ms');
const apiErrors = new Counter('api_errors_total');

const BASE_URL = __ENV.API_URL || 'http://localhost:3117';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
    ramping_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 50 },
      ],
      startTime: '4m',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'api_latency_ms': ['p(95)<300'],
  },
};

const endpoints = [
  { path: '/health', method: 'GET', weight: 10 },
  { path: '/stats', method: 'GET', weight: 5 },
  { path: '/api/predictions/latest', method: 'GET', weight: 20 },
  { path: '/api/predictions/latest_slim', method: 'GET', weight: 10 },
  { path: '/api/composite', method: 'GET', weight: 15 },
  { path: '/api/signals', method: 'GET', weight: 15 },
];

export default function () {
  const totalWeight = endpoints.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  let chosen = endpoints[0];

  for (const e of endpoints) {
    r -= e.weight;
    if (r <= 0) { chosen = e; break; }
  }

  group(`API ${chosen.method} ${chosen.path}`, () => {
    const t0 = Date.now();
    const res = http.request(chosen.method, `${BASE_URL}${chosen.path}`, null, {
      headers: {
        'User-Agent': 'k6-loadtest/1.0',
        'Accept': 'application/json',
      },
      tags: { endpoint: chosen.path },
    });
    const latency = Date.now() - t0;

    apiRequests.add(1);
    apiLatency.add(latency);

    const success = check(res, {
      'status is 2xx': (r) => r.status >= 200 && r.status < 300,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });

    if (!success) {
      apiErrors.add(1);
    }
  });

  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  return {
    'stdout': '\n' + JSON.stringify({
      timestamp: new Date().toISOString(),
      total_requests: data.metrics.api_requests_total?.values.count || 0,
      errors: data.metrics.api_errors_total?.values.count || 0,
      latency_p50: data.metrics.api_latency_ms?.values['p(50)'] || 0,
      latency_p95: data.metrics.api_latency_ms?.values['p(95)'] || 0,
      latency_p99: data.metrics.api_latency_ms?.values['p(99)'] || 0,
      rps: data.metrics.http_reqs?.values.rate || 0,
    }, null, 2) + '\n',
    'tests/load/k6/results/api-summary.json': JSON.stringify({
      total_requests: data.metrics.api_requests_total?.values.count || 0,
      errors: data.metrics.api_errors_total?.values.count || 0,
      latency_p95: data.metrics.api_latency_ms?.values['p(95)'] || 0,
    }, null, 2),
  };
}
