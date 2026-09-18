// tests/predict/attention_dynamics.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AttentionDynamics, crucixAttentionDynamics, extractTopicsFromSweep } from '../../apis/predict/attention_dynamics.mjs';

describe('AttentionDynamics — базовые операции', () => {
  let ad;
  beforeEach(() => { ad = new AttentionDynamics({ halfLifeHours: 24 }); });

  it('создаёт тему при первом обновлении', () => {
    ad.update('topic_a', 5, 0.25);
    assert.strictEqual(ad.topics.size, 1);
    const topic = ad.topics.get('topic_a');
    assert.ok(topic.attention > 0);
  });

  it('применяет затухание с течением времени', () => {
    ad.update('topic_a', 10, 0.25);
    const afterFirst = ad.topics.get('topic_a').attention;

    // Симулируем 24 часа спустя без новых упоминаний
    ad.update('topic_a', 0, 24);
    const afterDecay = ad.topics.get('topic_a').attention;

    assert.ok(afterDecay < afterFirst * 0.6, 'Attention should decay by half-life');
  });

  it('momentum отражает изменение attention', () => {
    ad.update('topic_a', 5, 0.25);
    ad.update('topic_a', 10, 0.25);
    const momentum = ad.topics.get('topic_a').momentum;
    assert.ok(momentum > 0, 'Momentum should be positive with growing mentions');
  });

  it('velocity нормализована по времени', () => {
    ad.update('topic_a', 10, 1);   // 10 mentions за 1 час
    const t1 = ad.topics.get('topic_a').velocity;

    ad.update('topic_b', 10, 4);   // 10 mentions за 4 часа
    const t2 = ad.topics.get('topic_b').velocity;

    assert.ok(t1 > t2, 'Faster growth = higher velocity');
  });
});

describe('AttentionDynamics — allocation', () => {
  it('распределяет внимание пропорционально', () => {
    const ad = new AttentionDynamics({ halfLifeHours: 1000 }); // медленное затухание
    ad.update('a', 10, 0.01);
    ad.update('b', 20, 0.01);
    ad.update('c', 30, 0.01);

    const alloc = ad.getAttentionAllocation();
    assert.ok(alloc.a.share < alloc.b.share);
    assert.ok(alloc.b.share < alloc.c.share);

    const total = alloc.a.share + alloc.b.share + alloc.c.share;
    assert.ok(Math.abs(total - 1) < 1e-6);
  });

  it('возвращает пустой объект без тем', () => {
    const alloc = ad.getAttentionAllocation();
    assert.deepStrictEqual(alloc, {});
  });
});

describe('AttentionDynamics — detectShifts', () => {
  it('обнаруживает shift когда одна тема растёт, другая падает', () => {
    const ad = new AttentionDynamics({ halfLifeHours: 1000 });
    // Тема A активно растёт
    for (let i = 0; i < 5; i++) ad.update('topic_a', 5, 0.01);
    // Тема B затухает (нет упоминаний)
    for (let i = 0; i < 5; i++) ad.update('topic_b', 0, 0.01);
    // Начальный буст для B
    ad.topics.get('topic_b').attention = 20;
    ad.topics.get('topic_b').history = [{ attention: 20 }, { attention: 15 }, { attention: 10 }, { attention: 5 }, { attention: 1 }];

    const shifts = ad.detectShifts(5);
    assert.ok(Array.isArray(shifts.shifts));
  });

  it('не падает при малой истории', () => {
    ad.update('a', 5, 0.01);
    const shifts = ad.detectShifts(5);
    assert.strictEqual(shifts.totalShifts, 0);
  });
});

describe('AttentionDynamics — predictExplosive', () => {
  it('определяет растущие темы', () => {
    const ad = new AttentionDynamics({ halfLifeHours: 1000 });
    for (let i = 0; i < 5; i++) ad.update('rising', 10, 0.01);
    for (let i = 0; i < 5; i++) ad.update('flat', 1, 0.01);

    const predictions = ad.predictExplosive(5, 24);
    assert.strictEqual(predictions[0].topic, 'rising');
    assert.ok(predictions[0].explosiveness > predictions[1].explosiveness);
  });

  it('пустой список при отсутствии тем', () => {
    const predictions = ad.predictExplosive(5, 24);
    assert.deepStrictEqual(predictions, []);
  });
});

describe('extractTopicsFromSweep', () => {
  it('извлекает темы из GDELT событий', () => {
    const latest = {
      gdelt: {
        conflictEvents: [
          { summary: 'conflict escalation region strategic' },
          { summary: 'military operation strategic region' },
        ],
      },
    };
    const topics = extractTopicsFromSweep(latest);
    assert.ok(topics.size > 0);
    assert.ok(topics.has('strategic'));
  });

  it('возвращает пустой Map при отсутствии событий', () => {
    const topics = extractTopicsFromSweep({});
    assert.strictEqual(topics.size, 0);
  });
});

describe('crucixAttentionDynamics — интеграция', () => {
  it('обрабатывает sweep', () => {
    const latest = {
      gdelt: {
        conflictEvents: [
          { summary: 'conflict strategic region escalation' },
          { summary: 'military operation strategic region' },
        ],
      },
    };
    const result = crucixAttentionDynamics(latest, []);
    assert.strictEqual(result.module, 'attention_dynamics');
    assert.ok(typeof result.totalAttention === 'number');
  });

  it('не падает на пустом входе', () => {
    const result = crucixAttentionDynamics({}, []);
    assert.strictEqual(result.module, 'attention_dynamics');
    assert.strictEqual(result.totalTopics, 0);
  });
});
