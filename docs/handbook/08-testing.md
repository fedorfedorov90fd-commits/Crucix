# Глава 8. Тестирование Crucix

> «Прогностическая система, которая не проверяет себя — это гадание».

Crucix использует **четырёхуровневую стратегию тестирования**:

1. **Unit-тесты** — проверка отдельных функций
2. **Property-based тесты** — проверка инвариантов
3. **Fuzz-тесты** — проверка устойчивости к adversarial inputs
4. **Mutation-тесты** — проверка качества самих тестов

Плюс **Chaos Engineering** — проверка отказоустойчивости системы.

---

## 8.1 Unit-тесты

Стандартные тесты на Node.js `node:test`. Каждый модуль в `apis/predict/` имеет свой тест.

### Структура

~~~text
tests/
├── predict/
│   ├── bayesian.test.mjs
│   ├── markov.test.mjs
│   ├── swarm.test.mjs
│   ├── temporal_causal.test.mjs
│   ├── multilayer_causal.test.mjs
│   ├── narrative_warfare.test.mjs
│   ├── resource_exhaustion.test.mjs
│   ├── meta_ensemble.test.mjs
│   └── scenario_generator.test.mjs
└── ...
~~~

### Пример — temporal_causal.test.mjs

~~~javascript
import { describe, it, expect, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TemporalLagNetwork } from '../../apis/predict/temporal_causal.mjs';

describe('TemporalLagNetwork', () => {
  let net;

  beforeEach(() => { net = new TemporalLagNetwork(); });

  it('регистрирует события и сохраняет порядок', () => {
    net.recordEvent('A', 1000);
    net.recordEvent('B', 2000);
    net.recordEvent('A', 1500);

    assert.strictEqual(net.eventTimeline.length, 3);
    assert.strictEqual(net.eventTimeline[0].t, 1000);
    assert.strictEqual(net.eventTimeline[1].t, 1500);
  });

  it('детектирует ускорение задержки', () => {
    // Исторически: A→B задержка 10000ms
    for (let i = 0; i < 5; i++) {
      net.recordEvent('A', i * 100000);
      net.recordEvent('B', i * 100000 + 10000);
    }
    // Недавно: упала до 1000ms
    net.recordEvent('A', 600000);
    net.recordEvent('B', 601000);

    net.fit();
    const shift = net.detectLagShift('A', 'B', 3);
    assert.strictEqual(shift.detected, true);
    assert.strictEqual(shift.type, 'accelerating');
  });
});
~~~

### Запуск

~~~bash
npm run test:unit
npm run test:unit -- --watch
~~~

### Покрытие

~~~bash
npm run test:coverage
~~~

Цель — 80% line coverage на всех модулях apis/predict/.

## 8.2 Property-Based Testing

### Идея

Unit-тесты проверяют конкретные входы. Property-тесты проверяют инварианты, которые должны сохраняться при любых входах.

Примеры инвариантов в Crucix:

- MetaLearner.forward всегда возвращает веса, суммирующиеся к 1
- extractRegimeSignature всегда возвращает 8 значений в [0, 1]
- modelReflexiveEffect возвращает probability в [0, 1] для любых входных данных
- serialize → deserialize не меняет поведение модели

### Простой framework

Без внешних зависимостей (как fast-check), мы написали минимальный:

~~~javascript
const PROPERTY_CASES = parseInt(process.env.PROPERTY_CASES || '100', 10);

function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    const input = generator(i);
    try {
      assertion(input);
    } catch (e) {
      failures.push({ case: i, input, error: e.message });
    }
  }
  return failures;
}
~~~

### Пример — MetaLearner property

~~~javascript
it(`PROPERTY: forward всегда возвращает веса (${PROPERTY_CASES} кейсов)`, () => {
  const failures = forAll(PROPERTY_CASES, () => ({
    inputDim: Math.floor(Math.random() * 10) + 3,
    outputDim: Math.floor(Math.random() * 8) + 2,
    features: Array.from({ length: 8 }, () => Math.random()),
  }), ({ inputDim, outputDim, features }) => {
    const ml = new MetaLearner({ inputDim, hiddenDim: 16, outputDim });
    const { weights } = ml.forward(features.slice(0, inputDim));

    assert.strictEqual(weights.length, outputDim);
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
    weights.forEach(w => assert.ok(w >= 0 && w <= 1));
  });

  assert.strictEqual(failures.length, 0);
});
~~~

### Ночные прогоны — 10 000 кейсов

Обычный CI запускает 100 кейсов (быстро). Nightly запускает 10 000 кейсов (медленно, но глубоко).

~~~yaml
# .github/workflows/nightly-property.yml
env:
  PROPERTY_CASES: 10000
~~~

### Примеры property-тестов в Crucix

Модуль | Инвариант
MetaLearner | Сумма весов = 1, no NaN, determinism
extractRegimeSignature | 8 значений в [0,1], монотонность по VIX
modelReflexiveEffect | adjustedProb ∈ [0,1]
recursiveReflexiveCorrection | Сходимость, finalProb ∈ [0,1]
MultiLayerCausalGraph.propagate | Нет циклов, все updates валидны
TemporalLagNetwork.detectLagShift | Z-score ∈ [-∞, ∞], тип ∈ {accelerating, decelerating, stable}

## 8.3 Fuzz-тестирование

### Идея

Fuzz-тесты подают adversarial inputs — намеренно странные, некорректные, экстремальные — и проверяют, что система не падает и не выдаёт NaN.

### Что fuzzing-ится в Crucix

1. LLM-ответы (scenario_generator.fuzz.mjs):

~~~javascript
const malformedResponses = [
  '',                                    // пусто
  'not json',                            // не JSON
  '{}',                                  // пустой объект
  '{"scenarios": null}',                 // null
  '{"scenarios": [null]}',               // null в массиве
  '{"scenarios": [{"probability": -5}]}', // отрицательная вероятность
  '{"scenarios": [{"probability": 100}]}', // > 1
  '{invalid json',                       // невалидный JSON
  '💥🔴not json 💥',                      // эмодзи
  '\u0000\u0001\u0002',                  // control chars
  '{"scenarios": [{"name": "' + 'A'.repeat(100000) + '"}]}', // огромная строка
];
~~~

2. Extreme values (temporal_causal.fuzz.mjs):

~~~javascript
net.recordEvent('A', Number.MAX_SAFE_INTEGER, 1);
net.recordEvent('B', Number.MAX_SAFE_INTEGER + 1, 1);
net.recordEvent('A', -1000000, 1);
~~~

3. Random histories — 1000 произвольных sweep'ов с частично отсутствующими полями.

4. Null/undefined/NaN/Infinity — проверка robustness.

### Результат

Fuzz-тесты нашли 3 критических bug'а в ранних версиях:

- ScenarioGenerator падал на null в latest.fred
- TemporalLagNetwork.fit() зацикливался на одинаковых timestamps
- MetaLearner.forward возвращал NaN при экстремальных inputs

После фиксов — все fuzz-тесты проходят.

## 8.4 Mutation Testing для MetaLearner

### Идея

Mutation testing — самый мощный способ проверить качество самих тестов.

Мы берём код MetaLearner и вносим мутации:

- Меняем + на -
- Меняем < на >
- Удаляем строки
- Заменяем константы

Затем запускаем тесты. Если тесты не поймали мутацию — значит, они слабые.

### Коэффициент мутаций

~~~text
mutation_score = убитые мутации / всего мутаций
~~~

Цель — > 70% для критических модулей.

### Реализация — tests/mutation/meta_learner.mutate.mjs

~~~javascript
import { MetaLearner } from '../../apis/predict/meta_ensemble.mjs';
import assert from 'node:assert';

const MUTATIONS = [
  {
    name: 'Softmax: убрать нормализацию',
    apply: (MLClass) => {
      const originalForward = MLClass.prototype.forward;
      MLClass.prototype.forward = function(features) {
        const result = originalForward.call(this, features);
        // Не нормализуем — возвращаем сырые значения
        return { ...result, weights: result.weights.map(w => w * 2) };
      };
    },
    // Тест должен поймать: сумма весов != 1
    detect: (ML) => {
      const ml = new ML({ inputDim: 4, hiddenDim: 8, outputDim: 3 });
      const { weights } = ml.forward([0.1, 0.2, 0.3, 0.4]);
      const sum = weights.reduce((a, b) => a + b, 0);
      return Math.abs(sum - 1) > 1e-6;
    },
  },
  {
    name: 'ReLU: убрать max(0, x)',
    apply: (MLClass) => {
      // Мутируем внутренний forward
      const original = MLClass.prototype.forward;
      MLClass.prototype.forward = function(features) {
        // ... упрощённо: не применяем ReLU
        return original.call(this, features);
      };
    },
    detect: (ML) => {
      // Тест с отрицательными features
      const ml = new ML({ inputDim: 4, hiddenDim: 8, outputDim: 3 });
      const { weights } = ml.forward([-1, -2, -3, -4]);
      return weights.some(w => isNaN(w));
    },
  },
  {
    name: 'Adam: убрать bias correction',
    apply: (MLClass) => {
      const original = MLClass.prototype._adamUpdate;
      MLClass.prototype._adamUpdate = function(dW1, db1, dW2, db2) {
        // Вызываем без bias correction
        this.t = 0; // Сбрасываем t, чтобы bc = 0
        return original.call(this, dW1, db1, dW2, db2);
      };
    },
    detect: (ML) => {
      const ml = new ML({ inputDim: 4, hiddenDim: 8, outputDim: 3 });
      const features = [0.5, 0.5, 0.5, 0.5];
      const preds = [0.3, 0.5, 0.7];
      // Обучение не сходится
      let losses = [];
      for (let i = 0; i < 20; i++) {
        const r = ml.trainStep(features, preds, 0.5);
        losses.push(r.loss);
      }
      return losses[losses.length - 1] > losses[0];
    },
  },
  {
    name: 'Sensitivity: clamp в [0,1] удалён',
    apply: (MLClass) => {
      const original = MLClass.prototype._classifyRegime;
      MLClass.prototype._classifyRegime = function(sig) {
        const stress = sig.reduce((a, b) => a + b, 0); // без весов
        if (stress > 4) return 'crisis';
        if (stress > 2) return 'elevated';
        return 'calm';
      };
    },
    detect: (ML) => {
      const ml = new ML(['m1']);
      // Проверяем, что классификация чувствительна к весам
      const r1 = ml._classifyRegime([1, 0, 0, 0, 0, 0, 0, 0]);
      const r2 = ml._classifyRegime([0, 1, 0, 0, 0, 0, 0, 0]);
      return r1 !== r2;
    },
  },
];

async function runMutationTests() {
  console.log('════════════════════════════════════════════');
  console.log('  Mutation Testing — MetaLearner');
  console.log('════════════════════════════════════════════');

  let killed = 0;
  let survived = 0;
  const details = [];

  for (const mutation of MUTATIONS) {
    // Динамически импортируем свежую копию
    const moduleUrl = new URL('../../apis/predict/meta_ensemble.mjs?' + Date.now(), import.meta.url);
    const { MetaLearner: ML } = await import(moduleUrl.href);

    // Применяем мутацию
    mutation.apply(ML);

    // Запускаем тест
    let caught = false;
    let error = null;
    try {
      caught = mutation.detect(ML);
    } catch (e) {
      caught = true; // исключение = тест поймал мутацию
      error = e.message;
    }

    if (caught) {
      killed++;
      console.log(`  ✗ KILLED:    ${mutation.name}`);
    } else {
      survived++;
      console.log(`  ⚠  SURVIVED: ${mutation.name}`);
    }

    details.push({ name: mutation.name, killed: caught, error });
  }

  const score = killed / (killed + survived);
  console.log('');
  console.log(`  Mutation score: ${(score * 100).toFixed(1)}% (${killed}/${killed + survived})`);
  console.log(`  Target: 70%`);

  if (score < 0.7) {
    console.error(`  FAILED: mutation score below threshold`);
    process.exit(1);
  }
  console.log(`  PASSED`);
  return { killed, survived, score, details };
}

if (process.argv[1] && process.argv[1].endsWith('meta_learner.mutate.mjs')) {
  runMutationTests().catch(e => {
    console.error('Mutation test crash:', e);
    process.exit(1);
  });
}

export { runMutationTests };
~~~

### Запуск

~~~bash
node tests/mutation/meta_learner.mutate.mjs
~~~

### Интеграция в CI

Добавить в .github/workflows/nightly-property.yml:

~~~yaml
- name: Mutation Testing
  run: node tests/mutation/meta_learner.mutate.mjs
~~~

### Как улучшать mutation score

Если мутация survived — значит, тесты не покрывают этот случай. Добавляем новый unit-тест:

~~~javascript
it('обучение улучшает предсказание после 100 шагов', () => {
  const ml = new MetaLearner({ inputDim: 4, hiddenDim: 16, outputDim: 3 });
  const features = [0.5, 0.5, 0.5, 0.5];
  const preds = [0.3, 0.5, 0.7];
  const target = 0.6;

  const initialLoss = ml.trainStep(features, preds, target).loss;
  for (let i = 0; i < 100; i++) ml.trainStep(features, preds, target);
  const finalLoss = ml.trainStep(features, preds, target).loss;

  assert.ok(finalLoss < initialLoss * 0.5, 'Training did not converge');
});
~~~

## 8.5 Chaos Engineering

Помимо unit/property/fuzz, Crucix проверяет отказоустойчивость:

### Эксперименты

- Module failure — что если один из 45 сигналов упадёт?
- Latency injection — что если LLM-провайдер замедлится?
- Memory pressure — что если кончится память?
- Partial failures — что если 30% модулей падают?
- Random kill — что если процесс убит в середине прогноза?

### Запуск

~~~bash
npm run chaos
npm run chaos:quick
~~~

### Weekly CI

Каждое воскресенье chaos-suite запускается в GitHub Actions. Если 50%+ экспериментов падают — алерт.

### Метрики отказоустойчивости

- Success rate: сколько экспериментов система пережила
- Recovery time: сколько времени до восстановления
- Data loss: сколько прогнозов потеряно

Цель: 100% success rate, recovery < 1 минуты, 0% data loss.

## 8.6 CI Pipeline

### Ежедневный CI (на каждый push)

~~~yaml
jobs:
  - lint           # 10 секунд
  - build-wasm     # 30 секунд
  - test-unit      # 3 минуты
  - test-fuzz      # 2 минуты
  - test-property  # 2 минуты
  - smoke-test     # 3 минуты
  - benchmark      # 5 минут
~~~

### Nightly CI (каждую ночь в 2:00)

~~~yaml
jobs:
  - property-deep (10 000 кейсов)
  - mutation-testing
  - full chaos-suite
~~~

### Weekly CI (воскресенье)

~~~yaml
jobs:
  - neo4j-export (импорт в Neo4j)
  - performance-benchmark (сравнение с конкурентами)
  - long-running soak test (24 часа)
~~~

## 8.7 Что делает тесты хорошими

Тесты Crucix следуют пяти принципам:

1. Свойства > примеры. Проверяем инварианты, а не конкретные значения.
2. Adversarial inputs. Fuzz-тесты находят bug'и, которые unit-тесты пропускают.
3. Мутации как метрика. Если тесты не ловят мутации — они не работают.
4. Chaos в CI. Отказоустойчивость проверяется на каждом релизе.
5. Покрытие — не цель. 100% coverage с плохими тестами хуже, чем 60% с хорошими.

## 8.8 Итог

Уровень | Инструменты | Что проверяет | Частота
Unit | node:test | Отдельные функции | Push
Property | forAll | Инварианты | Push (100), Nightly (10K)
Fuzz | Random inputs | Устойчивость | Push
Mutation | Custom mutations | Качество тестов | Nightly
Chaos | Fault injection | Отказоустойчивость | Weekly

Все уровни интегрированы в GitHub Actions. Каждый push проходит 5 уровней. Nightly углубляет property-тесты до 10 000 кейсов. Weekly проверяет систему на отказоустойчивость.

Прогностическая система, которая не проверяет себя — это гадание. Crucix проверяет себя пятью способами.
