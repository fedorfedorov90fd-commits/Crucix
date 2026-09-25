// apis/sources/smartscroll.mjs
// External adapter for SmartScroll API.
// Implements SmartScrollInterface.
// Includes: rate limiter (token bucket), circuit breaker, retries with backoff.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SmartScrollInterface } from './smartscroll-interface.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = process.env.SMARTSCROLL_CONFIG ||
  join(__dirname, '../../config/smartscroll.json');
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

const EXT = config.external || {};
const BASE_URL = EXT.base_url || 'https://api.smartscroll.example.com';
const API_KEY = EXT.api_key || process.env.SMARTSCROLL_API_KEY || '';
const TIMEOUT_MS = EXT.timeout_ms || 10000;
const RETRIES = EXT.retries || 3;
const RETRY_DELAY = EXT.retry_delay_ms || 2000;
const RATE_LIMIT_RPS = EXT.rate_limit_rps || 5;
const CB_FAILURE_THRESHOLD = EXT.circuit_failure_threshold || 5;
const CB_RESET_MS = EXT.circuit_reset_ms || 30000;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Rate limiter (token bucket) ---

class RateLimiter {
  constructor(rps) {
    this.capacity = Math.max(1, rps);
    this.tokens = this.capacity;
    this.refillRate = rps; // tokens per second
    this.lastRefill = Date.now();
  }

  async acquire() {
    while (true) {
      this._refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
      await sleep(Math.max(10, waitMs));
    }
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// --- Circuit breaker ---

class CircuitBreaker {
  constructor(failureThreshold, resetMs) {
    this.failureThreshold = failureThreshold;
    this.resetMs = resetMs;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.openedAt = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.resetMs) {
        throw new Error(`Circuit breaker is OPEN, retry in ${Math.ceil((this.resetMs - elapsed) / 1000)}s`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  _onFailure() {
    this.failures++;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
    };
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT_RPS);
const circuitBreaker = new CircuitBreaker(CB_FAILURE_THRESHOLD, CB_RESET_MS);

async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, opts = {}, retries = RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimiter.acquire();
    try {
      const res = await fetchWithTimeout(url, {
        method: opts.method || 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          ...opts.headers,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      }, TIMEOUT_MS);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
      }
      if (!res.ok) {
        throw new Error(`SmartScroll API ${res.status}: ${await res.text()}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(RETRY_DELAY * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

function mapStory(item) {
  return {
    id: item.story_id || item.id,
    title: item.title || '',
    summary: item.summary || item.description || '',
    status: item.status || 'active',
    start_time: item.start_time || item.published_at || new Date().toISOString(),
    end_time: item.end_time || null,
    entities: item.entities || [],
    events: (item.events || []).map(mapEvent),
    related_stories: item.related_stories || [],
  };
}

function mapEvent(ev) {
  return {
    id: ev.event_id || ev.id || `${ev.story_id}_${ev.published_at}`,
    source: 'smartscroll',
    published_at: ev.published_at || new Date().toISOString(),
    title: ev.title || '',
    body: ev.body || ev.summary || '',
    entities: ev.entities || [],
    story_id: ev.story_id || ev.id,
    related_stories: ev.related_stories || [],
    raw: ev,
  };
}

export class SmartScrollAdapter extends SmartScrollInterface {
  constructor() {
    super();
    this.mode = 'external';
  }

  async fetchStories(opts = {}) {
    return circuitBreaker.execute(async () => {
      const params = new URLSearchParams();
      if (opts.since) params.set('since', new Date(opts.since).toISOString());
      if (opts.limit) params.set('limit', String(opts.limit));
      if (opts.topics?.length) params.set('topics', opts.topics.join(','));

      const data = await fetchWithRetry(`${BASE_URL}/api/v1/stories?${params}`);
      return (data.items || data.stories || []).map(mapStory);
    });
  }

  async fetchStoryDetail(storyId) {
    return circuitBreaker.execute(async () => {
      const data = await fetchWithRetry(`${BASE_URL}/api/v1/stories/${storyId}`);
      return mapStory(data);
    });
  }

  async fetchTimeline(storyId) {
    return circuitBreaker.execute(async () => {
      const data = await fetchWithRetry(`${BASE_URL}/api/v1/stories/${storyId}/timeline`);
      return (data.timeline || data.events || []).map(e => ({
        time: e.time || e.published_at,
        title: e.title || '',
        body: e.body || '',
        source: e.source || 'smartscroll',
      }));
    });
  }

  async healthCheck() {
    const cbStatus = circuitBreaker.getStatus();
    if (cbStatus.state === 'OPEN') {
      return {
        ok: false,
        mode: this.mode,
        details: {
          reason: 'circuit-breaker-open',
          circuit: cbStatus,
        },
      };
    }
    try {
      const data = await circuitBreaker.execute(async () => {
        return await fetchWithRetry(`${BASE_URL}/api/v1/health`, { method: 'GET' }, 1);
      });
      return {
        ok: true,
        mode: this.mode,
        details: {
          status: data.status || 'healthy',
          circuit: circuitBreaker.getStatus(),
        },
      };
    } catch (err) {
      return {
        ok: false,
        mode: this.mode,
        details: {
          error: err.message,
          circuit: circuitBreaker.getStatus(),
        },
      };
    }
  }

  getCircuitStatus() {
    return circuitBreaker.getStatus();
  }
}
