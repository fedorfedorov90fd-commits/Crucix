// tests/fuzz/temporal_causal.fuzz.mjs
// Fuzz-тесты для TemporalLagNetwork

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TemporalLagNetwork, crucixTemporalCausalAnalysis } from '../../apis/predict/temporal_causal.mjs';

describe('TemporalLagNetwork — Fuzz Tests', () => {
  it('FUZZ: не падает на произвольные времена', () => {
    for (let trial = 0; trial < 100; trial++) {
      const net = new TemporalLagNetwork();
      const numEvents = Math.floor(Math.random() * 50);

      for (let i = 0; i < numEvents; i++) {
        const t = Math.random() * 1e12;
        const id = `event_${Math.floor(Math.random() * 5)}`;
        net.recordEvent(id, t, Math.random());
      }

      try {
        net.fit();
        // Пробуем детекцию
        for (const [from, targets] of net.lagDistributions) {
          for (const [to] of targets) {
            net.detectLagShift(from, to);
            net.predictNextB(from, to);
          }
        }
      } catch (e) {
        assert.fail(`Crash on trial ${trial} with ${numEvents} events: ${e.message}`);
      }
    }
  });

  it('FUZZ: одинаковые timestamp не ломают логику', () => {
    const net = new TemporalLagNetwork();
    const t = 1000000;
    for (let i = 0; i < 100; i++) net.recordEvent('A', t, 1);
    for (let i = 0; i < 100; i++) net.recordEvent('B', t, 1);

    assert.doesNotThrow(() => net.fit());
    assert.doesNotThrow(() => net.detectLagShift('A', 'B'));
  });

  it('FUZZ: отрицательные и огромные timestamp', () => {
    const net = new TemporalLagNetwork();
    net.recordEvent('A', -1000000, 1);
    net.recordEvent('B', 1000000, 1);
    net.recordEvent('A', Number.MAX_SAFE_INTEGER, 1);
    net.recordEvent('B', Number.MAX_SAFE_INTEGER + 1, 1);

    assert.doesNotThrow(() => net.fit());
  });

  it('FUZZ: crucixTemporalCausalAnalysis на произвольной истории', () => {
    for (let trial = 0; trial < 50; trial++) {
      const history = [];
      const n = Math.floor(Math.random() * 50);
      for (let i = 0; i < n; i++) {
        history.push({
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
          fred: Math.random() > 0.3 ? { vix: Math.random() * 100 } : null,
          gdelt: Math.random() > 0.3 ? { conflictEvents: Array.from({ length: Math.floor(Math.random() * 30) }, () => ({})) } : null,
          sanctions: Math.random() > 0.5 ? { count: Math.floor(Math.random() * 20) } : null,
          delta: Math.random() > 0.5 ? { newAlerts: Math.floor(Math.random() * 20), escalatedAlerts: Math.floor(Math.random() * 10) } : null,
        });
      }

      try {
        const result = crucixTemporalCausalAnalysis(history);
        assert.ok(result);
      } catch (e) {
        assert.fail(`Trial ${trial} crash: ${e.message}`);
      }
    }
  });
});
