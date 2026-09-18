// observability/otel.mjs
// OpenTelemetry-совместимый трейсинг и метрики (pure JS, без зависимостей)
//
// Реализует:
//   - Distributed tracing (spans, context propagation)
//   - Metrics (counters, gauges, histograms)
//   - Structured logs
//   - OTLP HTTP export

import { performance } from 'node:perf_hooks';

class Span {
  constructor(name, { parentSpan, attributes = {}, kind = 'internal' }) {
    this.name = name;
    this.traceId = parentSpan?.traceId || generateId(32);
    this.spanId = generateId(16);
    this.parentSpanId = parentSpan?.spanId || null;
    this.kind = kind;
    this.startTime = performance.now();
    this.endTime = null;
    this.attributes = { ...attributes };
    this.events = [];
    this.status = 'unset';
    this.error = null;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attrs) {
    Object.assign(this.attributes, attrs);
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
    return this;
  }

  recordException(error) {
    this.status = 'error';
    this.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
    this.setAttribute('error', true);
    this.setAttribute('error.message', error.message);
    return this;
  }

  end() {
    this.endTime = performance.now();
    this.durationMs = this.endTime - this.startTime;
    if (this.status === 'unset') this.status = 'ok';
    return this;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.durationMs,
      attributes: this.attributes,
      events: this.events,
      status: this.status,
      error: this.error,
    };
  }
}

class Tracer {
  constructor(name, version = '3.0.0') {
    this.name = name;
    this.version = version;
    this.spans = [];
    this.exporters = [];
    this.sampler = null;
  }

  startSpan(name, options = {}) {
    if (this.sampler && !this.sampler(options)) return null;

    const span = new Span(name, options);
    this.spans.push(span);
    return span;
  }

  async trace(name, fn, attributes = {}) {
    const span = this.startSpan(name, { attributes });
    if (!span) return fn();

    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (e) {
      span.recordException(e);
      span.end();
      throw e;
    }
  }

  traceSync(name, fn, attributes = {}) {
    const span = this.startSpan(name, { attributes });
    if (!span) return fn();

    try {
      const result = fn(span);
      span.end();
      return result;
    } catch (e) {
      span.recordException(e);
      span.end();
      throw e;
    }
  }

  addExporter(exporter) {
    this.exporters.push(exporter);
  }

  async flush() {
    if (this.spans.length === 0) return;

    const spans = this.spans.splice(0);
    for (const exporter of this.exporters) {
      try {
        await exporter.export(spans.map(s => s.toJSON()));
      } catch (e) {
        console.error(`[otel] Export failed: ${e.message}`);
      }
    }
  }
}

class Meter {
  constructor(name) {
    this.name = name;
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.exporters = [];
    this.startTime = Date.now();
  }

  counter(name, { description = '', unit = '' } = {}) {
    if (!this.counters.has(name)) {
      this.counters.set(name, {
        name, description, unit,
        value: 0,
        type: 'counter',
      });
    }
    const c = this.counters.get(name);
    return {
      add: (value = 1, attributes = {}) => {
        c.value += value;
      },
    };
  }

  gauge(name, { description = '', unit = '' } = {}) {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { name, description, unit, value: 0, type: 'gauge' });
    }
    const g = this.gauges.get(name);
    return {
      record: (value, attributes = {}) => {
        g.value = value;
      },
    };
  }

  histogram(name, { description = '', unit = '', buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000] } = {}) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        name, description, unit, buckets,
        counts: new Array(buckets.length + 1).fill(0),
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        type: 'histogram',
      });
    }
    const h = this.histograms.get(name);
    return {
      record: (value) => {
        h.sum += value;
        h.count++;
        h.min = Math.min(h.min, value);
        h.max = Math.max(h.max, value);
        for (let i = 0; i < buckets.length; i++) {
          if (value <= buckets[i]) {
            h.counts[i]++;
            return;
          }
        }
        h.counts[buckets.length]++;
      },
    };
  }

  snapshot() {
    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: (Date.now() - this.startTime) / 1000,
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([k, v]) => [k, v.value])
      ),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([k, v]) => [k, v.value])
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [k, {
          count: v.count,
          sum: v.sum,
          min: v.min === Infinity ? 0 : v.min,
          max: v.max === -Infinity ? 0 : v.max,
          avg: v.count > 0 ? v.sum / v.count : 0,
          counts: v.counts,
          buckets: v.buckets,
        }])
      ),
    };
  }

  toPrometheus() {
    const lines = [];

    for (const [name, c] of this.counters) {
      lines.push(`# TYPE ${sanitize(name)} counter`);
      lines.push(`${sanitize(name)} ${c.value}`);
    }

    for (const [name, g] of this.gauges) {
      lines.push(`# TYPE ${sanitize(name)} gauge`);
      lines.push(`${sanitize(name)} ${g.value}`);
    }

    for (const [name, h] of this.histograms) {
      lines.push(`# TYPE ${sanitize(name)} histogram`);
      for (let i = 0; i < h.buckets.length; i++) {
        lines.push(`${sanitize(name)}_bucket{le="${h.buckets[i]}"} ${h.counts.slice(0, i + 1).reduce((a, b) => a + b, 0)}`);
      }
      lines.push(`${sanitize(name)}_bucket{le="+Inf"} ${h.count}`);
      lines.push(`${sanitize(name)}_sum ${h.sum}`);
      lines.push(`${sanitize(name)}_count ${h.count}`);
    }

    return lines.join('\n');
  }
}

class Logger {
  constructor(serviceName, { level = 'info' } = {}) {
    this.serviceName = serviceName;
    this.level = level;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  _log(level, message, attributes = {}) {
    if (this.levels[level] < this.levels[this.level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...attributes,
    };

    console.log(JSON.stringify(entry));
    return entry;
  }

  debug(msg, attrs) { return this._log('debug', msg, attrs); }
  info(msg, attrs) { return this._log('info', msg, attrs); }
  warn(msg, attrs) { return this._log('warn', msg, attrs); }
  error(msg, attrs) { return this._log('error', msg, attrs); }
}

class OTLPHttpExporter {
  constructor(endpoint, { headers = {}, timeout = 5000 } = {}) {
    this.endpoint = endpoint;
    this.headers = headers;
    this.timeout = timeout;
  }

  async export(spans) {
    if (spans.length === 0) return;

    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'crucix-monitor' } },
            { key: 'service.version', value: { stringValue: '3.0.0' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'crucix-predict', version: '3.0.0' },
          spans: spans.map(s => this._toOTLP(s)),
        }],
      }],
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      console.error(`[otel] OTLP export failed: ${e.message}`);
    }
  }

  _toOTLP(span) {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: span.kind === 'server' ? 2 : span.kind === 'client' ? 3 : 1,
      startTimeUnixNano: String(Math.floor(span.startTime * 1e6)),
      endTimeUnixNano: String(Math.floor(span.endTime * 1e6)),
      attributes: Object.entries(span.attributes).map(([k, v]) => ({
        key: k,
        value: typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) },
      })),
      status: {
        code: span.status === 'error' ? 2 : 1,
        message: span.error?.message || '',
      },
    };
  }
}

class ConsoleExporter {
  async export(spans) {
    for (const span of spans) {
      console.log(`[span] ${span.name} (${span.durationMs.toFixed(2)}ms) ${span.status}`);
    }
  }
}

class PrometheusExporter {
  constructor(meter) {
    this.meter = meter;
  }

  render() {
    return this.meter.toPrometheus();
  }
}

let globalTracer = null;
let globalMeter = null;
let globalLogger = null;

export function initObservability({
  serviceName = 'crucix-monitor',
  serviceVersion = '3.0.0',
  otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null,
  logLevel = process.env.LOG_LEVEL || 'info',
  samplingRate = 1.0,
} = {}) {
  globalTracer = new Tracer(serviceName, serviceVersion);
  globalMeter = new Meter(serviceName);
  globalLogger = new Logger(serviceName, { level: logLevel });

  if (samplingRate < 1.0) {
    globalTracer.sampler = () => Math.random() < samplingRate;
  }

  if (otlpEndpoint) {
    globalTracer.addExporter(new OTLPHttpExporter(otlpEndpoint));
    globalLogger.info('OTLP exporter enabled', { endpoint: otlpEndpoint });
  } else {
    globalTracer.addExporter(new ConsoleExporter());
  }

  const flushInterval = setInterval(() => {
    globalTracer.flush().catch(() => {});
  }, 10000);
  flushInterval.unref();

  globalLogger.info('Observability initialized', {
    serviceName, serviceVersion, samplingRate,
  });

  return { tracer: globalTracer, meter: globalMeter, logger: globalLogger };
}

export function getTracer() {
  if (!globalTracer) throw new Error('Observability not initialized');
  return globalTracer;
}

export function getMeter() {
  if (!globalMeter) throw new Error('Observability not initialized');
  return globalMeter;
}

export function getLogger() {
  if (!globalLogger) throw new Error('Observability not initialized');
  return globalLogger;
}

function generateId(length) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_');
}

export function registerCrucixMetrics(meter) {
  return {
    predictionCycles: meter.counter('crucix_prediction_cycles_total', {
      description: 'Total prediction cycles',
    }),
    cycleDuration: meter.histogram('crucix_cycle_duration_seconds', {
      description: 'Duration of prediction cycle',
      unit: 's',
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    }),
    cycleErrors: meter.counter('crucix_cycle_errors_total', {
      description: 'Errors during cycles',
    }),
    compositeRisk: meter.gauge('crucix_composite_risk', {
      description: 'Current composite risk (0-1)',
    }),
    compositeLevel: meter.gauge('crucix_composite_level', {
      description: 'Composite risk level (0-4)',
    }),
    signalValue: meter.gauge('crucix_signal_value', {
      description: 'Value of a specific signal',
    }),
    signalsHigh: meter.counter('crucix_signals_high_total', {
      description: 'Signals above threshold',
    }),
    wsConnections: meter.gauge('crucix_ws_connections', {
      description: 'Active WS connections',
    }),
    wsMessages: meter.counter('crucix_ws_messages_total', {
      description: 'WS messages sent',
    }),
    wsErrors: meter.counter('crucix_ws_errors_total', {
      description: 'WS errors',
    }),
    predictionsMade: meter.counter('crucix_predictions_total', {
      description: 'Predictions registered',
    }),
    predictionsResolved: meter.counter('crucix_predictions_resolved_total', {
      description: 'Predictions resolved with outcome',
    }),
    brierScore: meter.gauge('crucix_brier_score', {
      description: 'Current Brier score',
    }),
    notificationsSent: meter.counter('crucix_notifications_sent_total', {
      description: 'Notifications sent',
    }),
    flRounds: meter.counter('crucix_fl_rounds_total', {
      description: 'Federated learning rounds',
    }),
    flClients: meter.gauge('crucix_fl_clients', {
      description: 'Active FL clients',
    }),
  };
}

export { Tracer, Meter, Logger, Span, OTLPHttpExporter, PrometheusExporter };
