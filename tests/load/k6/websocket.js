// tests/load/k6/websocket.js
// k6 нагрузочный тест для WebSocket API Crucix
//
// Запуск:
//   k6 run tests/load/k6/websocket.js
//   k6 run --vus 100 --duration 5m tests/load/k6/websocket.js
//   k6 run --out json=results.json tests/load/k6/websocket.js

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const wsConnections = new Counter('ws_connections_total');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessageLatency = new Trend('ws_message_latency_ms');
const wsConnectionErrors = new Rate('ws_connection_errors');

const WS_URL = __ENV.WS_URL || 'ws://localhost:3118';
const MESSAGES_PER_CONNECTION = parseInt(__ENV.MESSAGES || '10');

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      tags: { test: 'ramp-up' },
    },

    steady_state: {
      executor: 'constant-vus',
      vus: 200,
      duration: '5m',
      startTime: '7m',
      tags: { test: 'steady-state' },
    },

    spike: {
      executor: 'ramping-vus',
      startTime: '13m',
      stages: [
        { duration: '10s', target: 1000 },
        { duration: '1m', target: 1000 },
        { duration: '10s', target: 0 },
      ],
      tags: { test: 'spike' },
    },
  },

  thresholds: {
    'ws_message_latency_ms': ['p(95)<500', 'p(99)<1000'],
    'ws_connection_errors': ['rate<0.01'],
    'ws_connections_total': ['count>0'],
  },
};

export default function () {
  const url = `${WS_URL}`;

  const res = ws.connect(url, {
    tags: { name: 'ws-connection' },
    headers: {
      'User-Agent': 'k6-loadtest/1.0',
      'X-Crucix-Test': 'true',
    },
  }, function (socket) {
    wsConnections.add(1);
    const connectTime = Date.now();

    socket.on('open', () => {
      const openLatency = Date.now() - connectTime;
      wsMessageLatency.add(openLatency);
      console.log(`Connected in ${openLatency}ms`);

      socket.send(JSON.stringify({
        action: 'subscribe',
        filters: {},
      }));

      socket.setInterval(() => {
        socket.send(JSON.stringify({ action: 'ping' }));
      }, 5000);

      socket.setInterval(() => {
        socket.send(JSON.stringify({ action: 'stats' }));
      }, 60000);
    });

    socket.on('message', (msg) => {
      wsMessagesReceived.add(1);

      try {
        const data = JSON.parse(msg);

        if (data.type === 'pong') {
          const latency = Date.now() - data.timestamp;
          wsMessageLatency.add(latency);
        }

        if (data.type === 'stats') {
          console.log(`Server stats: ${JSON.stringify(data.data)}`);
        }
      } catch (e) {
        console.error(`Failed to parse message: ${e.message}`);
      }
    });

    socket.on('close', () => {
      console.log('Disconnected');
    });

    socket.on('error', (e) => {
      wsConnectionErrors.add(1);
      console.error(`WebSocket error: ${e.error()}`);
    });

    const holdTime = MESSAGES_PER_CONNECTION * 1000;
    socket.setTimeout(() => {
      socket.close();
    }, holdTime);
  });

  check(res, {
    'status is 101': (r) => r && r.status === 101,
  });

  sleep(1);
}

export function setup() {
  console.log(`Starting WebSocket load test against ${WS_URL}`);
  console.log(`Messages per connection: ${MESSAGES_PER_CONNECTION}`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration}s`);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      ws_connections: data.metrics.ws_connections_total?.values.count || 0,
      messages_received: data.metrics.ws_messages_received?.values.count || 0,
      message_latency_p50: data.metrics.ws_message_latency_ms?.values['p(50)'] || 0,
      message_latency_p95: data.metrics.ws_message_latency_ms?.values['p(95)'] || 0,
      message_latency_p99: data.metrics.ws_message_latency_ms?.values['p(99)'] || 0,
      error_rate: data.metrics.ws_connection_errors?.values.rate || 0,
    },
  };

  return {
    'stdout': `\n${JSON.stringify(summary, null, 2)}\n`,
    'tests/load/k6/results/websocket-summary.json': JSON.stringify(summary, null, 2),
  };
}
