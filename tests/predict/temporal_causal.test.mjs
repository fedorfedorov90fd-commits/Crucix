// tests/predict/temporal_causal.test.mjs
import { describe, it, expect, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TemporalLagNetwork, VulnerabilityWindowModel, crucixTemporalCausalAnalysis } from '../../apis/predict/temporal_causal.mjs';

describe('TemporalLagNetwork', () => {
  let net;

  beforeEach(() => {
    net = new TemporalLagNetwork();
  });

  it('регистрирует события и сохраняет порядок', () => {
    net.recordEvent('A', 1000);
    net.recordEvent('B', 2000);
    net.recordEvent('A', 1500);

    assert.strictEqual(net.eventTimeline.length, 3);
    assert.strictEqual(net.eventTimeline[0].t, 1000);
    assert.strictEqual(net.eventTimeline[1].t, 1500);
    assert.strictEqual(net.eventTimeline[2].t, 2000);
  });

  it('извлекает пары с задержками', () => {
    const now = Date.now();
    net.recordEvent('A', now);
    net.recordEvent('B', now + 1000);
    net.recordEvent('A', now + 2000);
    net.recordEvent('B', now + 3000);

    const pairs = net.extractLags();
    assert.ok(pairs.has('A→B'));
    const aToB = pairs.get('A→B');
    assert.ok(aToB.length >= 2);
  });

  it('обучает распределение задержек', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      net.recordEvent('A', now + i * 10000);
      net.recordEvent('B', now + i * 10000 + 1000);
    }

    net.fit();
    const dist = net.lagDistributions.get('A')?.get('B');
    assert.ok(dist);
    assert.ok(dist.mean > 0);
    assert.ok(dist.count >= 3);
  });

  it('детектирует ускорение задержки', () => {
    const now = Date.now();
    // Исторически: A→B задержка 10000ms
    for (let i = 0; i < 5; i++) {
      net.recordEvent('A', now + i * 100000);
      net.recordEvent('B', now + i * 100000 + 10000);
    }
    // Недавно: задержка упала до 1000ms
    net.recordEvent('A', now + 600000);
    net.recordEvent('B', now + 600000 + 1000);
    net.recordEvent('A', now + 700000);
    net.recordEvent('B', now + 700000 + 1000);
    net.recordEvent('A', now + 800000);
    net.recordEvent('B', now + 800000 + 1000);

    net.fit();
    const shift = net.detectLagShift('A', 'B', 3);
    assert.strictEqual(shift.detected, true);
    assert.strictEqual(shift.type, 'accelerating');
  });

  it('сериализуется и десериализуется', () => {
    net.recordEvent('A', 1000);
    net.recordEvent('B', 2000);
    const json = net.serialize();
    const net2 = TemporalLagNetwork.deserialize(json);
    assert.strictEqual(net2.eventTimeline.length, 2);
  });
});

describe('VulnerabilityWindowModel', () => {
  it('обучается на истории и оценивает уязвимость', () => {
    const model = new VulnerabilityWindowModel();
    const history = [];
    const now = new Date();
    for (let i = 0; i < 100; i++) {
      const t = new Date(now.getTime() - i * 3600000);
      history.push({
        timestamp: t.toISOString(),
        fred: { vix: 15 + Math.random() * 30 },
        gdelt: { conflictEvents: Array.from({ length: Math.floor(Math.random() * 20) }, () => ({})) },
        delta: { newAlerts: Math.floor(Math.random() * 10) },
      });
    }

    model.fit(history);
    const assessment = model.assess(new Date());
    assert.ok(assessment.vulnerability >= 0 && assessment.vulnerability <= 1);
    assert.ok(['low', 'medium', 'high', 'critical'].includes(assessment.level));
  });
});

describe('crucixTemporalCausalAnalysis', () => {
  it('возвращает unavailable при малой истории', () => {
    const result = crucixTemporalCausalAnalysis([]);
    assert.strictEqual(result.available, false);
  });

  it('обрабатывает достаточную историю', () => {
    const now = Date.now();
    const history = [];
    for (let i = 0; i < 30; i++) {
      history.push({
        timestamp: new Date(now - i * 3600000).toISOString(),
        fred: { vix: 20 + Math.random() * 15 },
        gdelt: { conflictEvents: Array.from({ length: Math.floor(Math.random() * 15) }, () => ({})) },
        sanctions: { count: Math.floor(Math.random() * 8) },
        delta: { newAlerts: Math.floor(Math.random() * 8), escalatedAlerts: Math.floor(Math.random() * 5) },
      });
    }
    const result = crucixTemporalCausalAnalysis(history);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.module, 'temporal_causal');
    assert.ok(Array.isArray(result.shiftDetections));
  });
});
