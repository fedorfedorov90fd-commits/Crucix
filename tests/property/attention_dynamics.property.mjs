// tests/property/attention_dynamics.property.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AttentionDynamics } from '../../apis/predict/attention_dynamics.mjs';

const PROPERTY_CASES = parseInt(process.env.PROPERTY_CASES || '100', 10);

function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    try { assertion(generator(i)); }
    catch (e) { failures.push({ case: i, error: e.message }); }
  }
  return failures;
}

describe('AttentionDynamics — Property Tests', () => {
  it('PROPERTY: attention всегда ≥ 0', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const ad = new AttentionDynamics({ halfLifeHours: 1 + Math.random() * 100 });
      const numUpdates = Math.floor(Math.random() * 20);
      const updates = [];
      for (let i = 0; i < numUpdates; i++) {
        updates.push({
          topic: `topic_${Math.floor(Math.random() * 5)}`,
          mentions: Math.floor(Math.random() * 20),
          hours: Math.random() * 5,
        });
      }
      return { ad, updates };
    }, ({ ad, updates }) => {
      for (const u of updates) ad.update(u.topic, u.mentions, u.hours);
      for (const topic of ad.topics.values()) {
        assert.ok(topic.attention >= 0, `attention < 0: ${topic.attention}`);
        assert.ok(!isNaN(topic.attention), 'attention NaN');
      }
    });
    assert.strictEqual(failures.length, 0, JSON.stringify(failures.slice(0, 3)));
  });

  it('PROPERTY: allocation sum = 1 (когда есть темы)', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const ad = new AttentionDynamics({ halfLifeHours: 1000 });
      for (let i = 0; i < 3; i++) ad.update(`t${i}`, Math.random() * 10, 0.01);
      return ad;
    }, (ad) => {
      const alloc = ad.getAttentionAllocation();
      const sum = Object.values(alloc).reduce((s, a) => s + a.share, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Sum != 1: ${sum}`);
    });
    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: predictExplosive возвращает не более topN', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const ad = new AttentionDynamics({ halfLifeHours: 1000 });
      const numTopics = Math.floor(Math.random() * 10);
      for (let i = 0; i < numTopics; i++) {
        for (let j = 0; j < 3; j++) ad.update(`t${i}`, Math.random() * 10, 0.01);
      }
      return ad;
    }, (ad) => {
      const topN = 5;
      const preds = ad.predictExplosive(topN, 24);
      assert.ok(preds.length <= topN, `Got ${preds.length} > ${topN}`);
    });
    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: momentum равен разнице attention', () => {
    const ad = new AttentionDynamics({ halfLifeHours: 1000 });
    const oldAttention = ad.update('test', 5, 0.01).attention;
    const newAttention = ad.update('test', 5, 0.01).attention;
    const momentum = ad.topics.get('test').momentum;

    assert.ok(Math.abs(momentum - (newAttention - oldAttention)) < 1e-9);
  });
});
