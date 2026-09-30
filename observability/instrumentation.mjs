// observability/instrumentation.mjs
// Автоматическая инструментация ключевых модулей Crucix

import { initObservability, getTracer, getMeter, getLogger, registerCrucixMetrics } from './otel.mjs';

let metrics = null;

export function setupObservability(opts = {}) {
  const obs = initObservability(opts);
  metrics = registerCrucixMetrics(obs.meter);
  return { ...obs, metrics };
}

export function getMetrics() {
  return metrics;
}

export function instrumentModule(name, fn) {
  return async function instrumentedFn(...args) {
    const tracer = getTracer();
    const logger = getLogger();

    const span = tracer.startSpan(`module.${name}`, {
      attributes: {
        'module.name': name,
        'module.args_count': args.length,
      },
    });

    try {
      const result = await fn(...args);

      if (result && result.error) {
        span.setAttribute('module.result', 'error');
        span.setAttribute('module.error', result.error);
        logger.warn(`Module ${name} returned error`, { error: result.error });
      } else {
        span.setAttribute('module.result', 'ok');
      }

      if (metrics && result) {
        if (result.probability !== undefined) {
          metrics.signalValue.record(result.probability);
        }
      }

      span.end();
      return result;
    } catch (e) {
      span.recordException(e);
      span.end();

      logger.error(`Module ${name} threw exception`, {
        error: e.message,
        stack: e.stack,
      });

      if (metrics) {
        metrics.cycleErrors.add(1, { module: name });
      }

      throw e;
    }
  };
}

export async function tracePredictionCycle(fn) {
  const tracer = getTracer();
  const logger = getLogger();
  const meter = getMeter();
  const m = metrics || registerCrucixMetrics(meter);

  const span = tracer.startSpan('prediction.cycle', {
    kind: 'server',
    attributes: { 'cycle.version': '3.0.0' },
  });

  const startTime = Date.now();

  try {
    const result = await fn(span);

    const duration = (Date.now() - startTime) / 1000;
    m.cycleDuration.record(duration);
    m.predictionCycles.add(1);

    if (result?.compositeRisk) {
      m.compositeRisk.record(result.compositeRisk.composite);
      const levelNum = { low: 0, moderate: 1, elevated: 2, high: 3, critical: 4 }[result.compositeRisk.level] || 0;
      m.compositeLevel.record(levelNum);

      span.setAttribute('composite.risk', result.compositeRisk.composite);
      span.setAttribute('composite.level', result.compositeRisk.level);
      span.setAttribute('composite.signals', result.compositeRisk.signals?.length || 0);

      if (result.compositeRisk.signals) {
        for (const sig of result.compositeRisk.signals) {
          span.addEvent('signal', {
            name: sig.key,
            value: sig.value,
            weight: sig.weight,
          });

          if (sig.value > 0.7) {
            m.signalsHigh.add(1, { signal: sig.key });
          }
        }
      }
    }

    if (result?.trackerStats) {
      m.predictionsMade.add(result.trackerStats.total || 0);
      m.predictionsResolved.add(result.trackerStats.resolved || 0);
      if (result.trackerStats.overallBrier !== null) {
        m.brierScore.record(result.trackerStats.overallBrier);
      }
    }

    span.setAttribute('cycle.duration_seconds', duration);
    span.end();

    logger.info('Prediction cycle completed', {
      durationSeconds: duration,
      compositeRisk: result?.compositeRisk?.composite,
      compositeLevel: result?.compositeRisk?.level,
    });

    return result;
  } catch (e) {
    span.recordException(e);
    span.end();
    m.cycleErrors.add(1);
    logger.error('Prediction cycle failed', { error: e.message });
    throw e;
  }
}

export function httpMiddleware() {
  return async (req, res, next) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`http.${req.method} ${req.path}`, {
      kind: 'server',
      attributes: {
        'http.method': req.method,
        'http.path': req.path,
        'http.user_agent': req.headers?.['user-agent'] || '',
      },
    });

    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      span.end();
    });

    next();
  };
}

export function instrumentWebSocket(ws, clientId) {
  const tracer = getTracer();
  const logger = getLogger();
  const meter = getMeter();

  const span = tracer.startSpan('ws.connection', {
    kind: 'server',
    attributes: { 'ws.client_id': clientId },
  });

  ws.on('close', () => {
    span.setAttribute('ws.duration_seconds', span.durationMs / 1000);
    span.end();
    logger.info('WS connection closed', { clientId });
  });

  return {
    onMessage: (msg) => span.addEvent('message', { type: msg?.type }),
    onError: (err) => {
      span.recordException(err);
      meter.counter('crucix_ws_errors_total').add(1);
    },
  };
}

export function getPrometheusMetrics() {
  const meter = getMeter();
  return meter.toPrometheus();
}

export function getMetricsSnapshot() {
  const meter = getMeter();
  return meter.snapshot();
}
