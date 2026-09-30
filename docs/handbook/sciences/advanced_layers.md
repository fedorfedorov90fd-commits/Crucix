# Глава 15. Продвинутые слои прогнозирования (v3.0)

В этой главе описаны шесть новых слоёв, добавленных в Crucix v3.0. Они формируют **третий контур** прогностической системы:

- **Первый контур** — базовые статистические модели (Bayesian, Markov, Monte Carlo)
- **Второй контур** — продвинутые ML/науки (HMM, Ising, EVT, Copula)
- **Третий контур** — мета-слои, объединяющие знание о **структуре** и **динамике** систем

---

## 15.1 Temporal Causal Discovery

### Проблема, которую решает

Классический причинный вывод (Pearl's do-calculus) отвечает на вопрос **«есть ли связь между A и B»**. Но не отвечает: **«сколько времени проходит между A и B»**.

В реальных системах задержка — не константа, а **случайная величина**. И именно её изменение — критический сигнал:

- **Сокращение задержки** = ускорение эскалации
- **Рост задержки** = деградация системы, потеря управляемости

### Модель

Для каждой пары событий (A, B) строим эмпирическое распределение:

~~~text
P(lag | A → B) — распределение задержки
~~~

Обучаем на исторических данных. Получаем:

- **mean** — средняя задержка
- **p05, p50, p95** — квантили
- **std** — дисперсия

Детекция сдвига: сравниваем **недавние** наблюдения с **историческими**. Если z-score < -2 — ускорение.

### Реализация

~~~javascript
import { TemporalLagNetwork } from './temporal_causal.mjs';

const net = new TemporalLagNetwork();

// Регистрация событий из истории
for (const sweep of history) {
  if (sweep.fred?.vix > 25) net.recordEvent('vix_spike', t, magnitude);
  if (sweep.gdelt?.conflictEvents?.length > 8) net.recordEvent('conflict_spike', t, magnitude);
}

// Обучение распределений
net.fit();

// Детекция ускорения
const shift = net.detectLagShift('vix_spike', 'conflict_spike');
// {
//   detected: true,
//   type: 'accelerating',
//   shiftPct: -45,  // задержка сократилась на 45%
//   interpretation: 'Было 12ч → стало 6.6ч. Признак ускорения эскалации.'
// }
~~~

### Применение

Правило: если 3+ пар событий показывают ускорение одновременно — система входит в режим каскадной эскалации.

Исторический пример: перед 2022 средняя задержка «санкции → военная эскалация» сократилась с 45 до 12 дней за 6 недель до события.

### Vulnerability Windows

Дополнение к модели — окна уязвимости. Система наиболее уязвима в определённые моменты:

- День недели (когда меньше всего людей на работе)
- Время суток (смена караулов, ночь)
- Месяц (праздники, сезонность)

Модель обучается на исторических данных, оценивая частоту серьёзных событий в каждом временном окне.

~~~javascript
const vuln = new VulnerabilityWindowModel();
vuln.fit(history);
const assessment = vuln.assess(new Date());
// {
//   vulnerability: 0.72,
//   level: 'critical',
//   interpretation: 'Критическое окно: Воскресенье, 3:00. Исторически высокий риск.'
// }
~~~

## 15.2 Multi-Layer Causal DAG

### Проблема

Palantir, Recorded Future и другие конкуренты строят графы в одном слое. Киберграфы — отдельно, финансовые — отдельно, геополитические — отдельно.

Но реальность многослойна: кибератака на энергосеть → отключение электричества → паника на рынке → рост VIX. Это четыре слоя в одной причинной цепочке.

### Модель

Четыре слоя:

Слой | Что внутри
CYBER | Кибератаки, утечки, ransomware, DDoS
INFO | Дезинформация, нарративы, пропаганда, медиаблокировки
FINANCE | VIX, обвал, санкции, кредитное сжатие, отток капитала
PHYSICAL | Спутниковые аномалии, военное наращивание, конфликты, радиация

Каждое ребро имеет:

- strength — множитель байесовского обновления (1.0 = нейтрально, >1 усиливает)
- lagHours — типичная задержка
- crossLayer — пересекает ли слои

### Реализация

~~~javascript
import { MultiLayerCausalGraph } from './multilayer_causal.mjs';

const graph = new MultiLayerCausalGraph();

// Обновляем из текущих данных
graph.observe('cyberAttack', 0.9, 1.0);
graph.observe('conflictEscalation', 0.7, 0.85);

// Распространяем по графу
const updates = graph.propagate(4);
// 15 обновлений, из них 8 cross-layer
// cyberAttack → vixSpike (strength 1.5, lag 2h)
// vixSpike → marketCrash (strength 2.4, lag 4h)
// conflictEscalation → vixSpike (strength 2.8, lag 2h)

// Do-intervention: что если взломают инфраструктуру?
const scenario = graph.doIntervention('infrastructureBreach', 0.9);
// {
//   directUpdates: 8,
//   crossLayerUpdates: 5,
//   totalImpact: 3.2
// }

// Рекурсивный counterfactual: цепочка
const chains = graph.recursiveCounterfactual('militaryBuildUp', 0.85, 4);
// [
//   [militaryBuildUp → conflictEscalation → vixSpike → marketCrash],
//   [militaryBuildUp → sanctionsExpansion → currencyCrisis],
//   ...
// ]
~~~

### Что это даёт

Единственная в отрасли модель, которая связывает кибер, информацию, финансы и физику в одном графе. Позволяет отвечать на вопросы:

- «Что если мы заблокируем кибератаку? Как это повлияет на финансовый прогноз?»
- «Какой путь от военного наращивания до обвала рынка самый быстрый?»
- «Кросс-слойная передача усилилась — это сигнал каскада?»

## 15.3 Narrative Warfare Detection

### Проблема

Стандартный sentiment-анализ отвечает: «что говорят». Не отвечает: «кто говорит и скоординированно ли».

Скоординированная кампания влияния отличается от органического распространения:

- Синхронность — посты выходят в узком временном окне
- Лексическое сходство — одинаковые фразы, хештеги, манипулятивные слова
- Известные источники — домены из списка пропагандистских
- Низкое разнообразие — мало уникальных формулировок

### Модель

Комбинируем пять сигналов в suspicion score:

~~~text
suspicion = 0.25 × temporal_synchrony
          + 0.30 × avg_similarity
          + 0.25 × propaganda_ratio
          + 0.10 × (1 - source_diversity)
          + 0.10 × manipulation_ratio
~~~

Классификация:

Score | Классификация
> 0.7 + propaganda > 0.5 | state_propaganda
> 0.6 + synchrony > 0.7 | coordinated_bot_network
> 0.5 | suspicious_coordination
> 0.35 | possible_campaign
< 0.35 | organic_spread

### Реализация

~~~javascript
import { NarrativeWarfareDetector } from './narrative_warfare.mjs';

const detector = new NarrativeWarfareDetector({
  windowMs: 3600000,           // 1 час
  similarityThreshold: 0.65,
  minSourcesForCampaign: 3,
});

const result = detector.detectCampaigns(posts);
// {
//   campaignsDetected: 2,
//   campaigns: [
//     {
//       suspicionScore: 0.82,
//       classification: 'state_propaganda',
//       postCount: 4,
//       sources: ['rt.com', 'sputniknews.com', 'tass.ru', 'ria.ru'],
//       knownPropagandaSources: ['rt.com', 'sputniknews.com', 'tass.ru', 'ria.ru'],
//       metrics: {
//         temporalSynchrony: 0.95,
//         avgSimilarity: 0.87,
//         propagandaRatio: 1.0,
//         sourceDiversity: 1.0,
//         manipulationRatio: 0.75,
//       },
//       target: { primary: 'ukraine', distribution: {...} },
//       recommendation: 'КРИТИЧНО: скоординированная кампания влияния...',
//     }
//   ]
// }
~~~

### Narrative Confidence Score

Отдельная метрика — насколько нарратив подтверждён независимыми источниками:

~~~javascript
import { computeNarrativeConfidence } from './narrative_warfare.mjs';

const confidence = computeNarrativeConfidence(posts);
// {
//   confidence: 0.28,
//   level: 'low',
//   breakdown: {
//     independenceFactor: 0.2,
//     ratioFactor: 0.4,
//     diversityFactor: 0.3,
//   },
//   independentSources: 1,
//   propagandaSources: 4,
//   interpretation: 'Нарратив НЕ подтверждён независимыми источниками — возможна кампания',
// }
~~~

### Unified Narrative Analysis

Объединяем SIR/SEIR-прогноз распространения с warfare-detection:

~~~javascript
import { crucixUnifiedNarrative } from './narrative_unified.mjs';

const unified = crucixUnifiedNarrative(latest, history);
// {
//   narratives: [
//     {
//       keywords: ['conflict', 'attack', 'region'],
//       sirForecast: { willSpread: true, R0: 1.8, peak: { day: 5, infected: 340 } },
//       originType: 'coordinated_campaign',
//       matchedCampaign: {
//         suspicionScore: 0.82,
//         classification: 'state_propaganda',
//       },
//       confidence: { value: 0.28, level: 'low' },
//       threatLevel: 0.87,
//       recommendation: 'КРИТИЧНО: скоординированная кампания активно распространяется',
//     }
//   ],
//   causalBridge: {
//     infoLayerNodes: [
//       { narrative: 'conflict', threatLevel: 0.87, financialImpact: 0.81 },
//     ],
//     interpretation: 'Высокая информационная угроза. Нарративы распространяются, часть — скоординированно. Возможно влияние на финансовый слой.',
//   },
// }
~~~

### Связь с Multi-Layer Causal Graph

Каждый нарратив — узел в INFO-слое. Если нарратив распространяется (SIR R0 > 1) и это скоординированная кампания — он автоматически усиливает связи INFO → FINANCE в графе.

Это первая в отрасли модель, которая связывает распространение нарратива с кросс-слойной передачей.

## 15.4 Resource Exhaustion Modeling

### Проблема

Palantir Maven отслеживает цели и технику, но не моделирует исчерпание ресурсов как прогностический фактор. А это критично: «сколько ещё продержится сторона? Когда точка перелома?»

### Две модели

A. Military Exhaustion

Ресурсы: техника, боеприпасы, топливо, личный состав, логистика. Каждый — со своим весом.

~~~text
consumptionRate = экспоненциальное сглаживание расхода
daysUntilCritical = (current - critical) / consumptionRate
~~~

B. Economic Exhaustion

Резервы: валюта, фонды, золото. Бюджет: доходы vs расходы. Санкции: 4 типа ограничений.

~~~text
dailyReserveChange = exportRevenue × (1 - exportLoss) - expenses
daysUntilCritical = (totalReserves - critical) / |dailyReserveChange|
~~~

### Реализация

~~~javascript
import { MilitaryExhaustionModel, EconomicExhaustionModel } from './resource_exhaustion.mjs';

const mil = new MilitaryExhaustionModel();
// Обновление из sweep
mil.observe({ ammunition: 10, fuel: 5, equipment: 2 }, 1);

const forecast = mil.predictExhaustion(20);
// {
//   resources: {
//     ammunition: { current: 85, daysUntilCritical: 42, status: 'warning' },
//     fuel: { current: 92, daysUntilCritical: 68, status: 'stable' },
//     ...
//   },
//   aggregateExhaustion: 0.35,
//   aggregateDaysUntil50: 58,
//   overallStatus: 'warning',
//   criticalResource: { resource: 'ammunition', daysUntilCritical: 42 },
// }

// Сценарий: остановка поставок
const scenario = mil.simulateScenario({
  stoppedSupplies: true,
  increasedConsumption: 1.2,
});
// {
//   daysUntilDepletion: 28,
//   limitingResource: 'ammunition',
//   interpretation: 'КРИТИЧНО: при данном сценарии истощение через 28 дней',
// }
~~~

### Combined Strategic Assessment

Объединяем инфовойну + истощение ресурсов:

~~~javascript
if (narrativeWarfare.threatLevel > 0.5 && resourceExhaustion.overallPressure > 0.5) {
  combinedAssessment = {
    type: 'pre_breaking_point',
    severity: 'critical',
    interpretation: 'Высокая интенсивность инфовойны + критическое истощение ресурсов → система приближается к точке невозврата.',
  };
}
~~~

Правило: если одновременно высокие инфо-угрозы и истощение ресурсов — вероятность резкого перехода в новое состояние (breaking point) максимальна.

## 15.5 Meta-Learning Ensemble

### Проблема

Классический ансамбль (взвешенное среднее) использует фиксированные веса. Но разные модели работают лучше в разных режимах:

- В кризисе хороши одни (Ising, SOC, EVT)
- В спокойствии — другие (Copula, OU, GPR)
- В режиме сдвига — третьи (BOCPD, regime_shift)

### Модель

Meta-Learner — нейросеть, которая принимает сигнатуру режима и возвращает веса моделей.

Архитектура:

~~~text
[8 признаков режима] → Dense(32) → ReLU → Dense(N моделей) → Softmax → веса
~~~

Обучается через gradient descent на разрешённых прогнозах: когда исход известен, обновляем веса так, чтобы ансамбль лучше предсказывал.

### Сигнатура режима

8 признаков из текущего sweep:

- VIX уровень (нормированный)
- HY-спред
- Количество конфликтов
- Санкции
- Новые алерты
- Эскалации
- Волатильность VIX за 20 шагов
- Тренд конфликтов

### Реализация

~~~javascript
import { MetaEnsemble, extractRegimeSignature } from './meta_ensemble.mjs';

const me = new MetaEnsemble(['bayesian', 'markov', 'swarm', ...]);

// Получить веса для текущего режима
const weights = me.getWeights(latest, history);
// {
//   weights: {
//     bayesian: 0.15, markov: 0.08, montecarlo: 0.12,
//     swarm: 0.22, game_theory: 0.18, narrative: 0.10,
//     ...
//   },
//   signature: [0.6, 0.5, 0.75, 0.4, 0.5, 0.6, 0.4, 0.3],
//   regime: 'elevated',
// }

// Обучение при известном исходе
me.train(latest, history, modelPredictions, actualOutcome);
~~~

### Что это даёт

Online Model Selection: система автоматически переключает веса при смене режима. Без ручной настройки.

Правило: если рейтинг моделей резко меняется за 5 шагов — это сигнал смены режима.

## 15.6 LLM Scenario Generator

### Проблема

Классические прогнозы дают одну вероятность. Но реальность многовариантна: 5-10 правдоподобных сценариев, каждый со своей вероятностью.

### Модель

LLM генерирует сценарии на основе текущего состояния:

Промпт:

~~~text
На основе текущего состояния системы сгенерируй 7 сценариев развития
на горизонте 168 часов. Включай спектр от позитивного до критического.
~~~

LLM отвечает JSON'ом:

~~~json
{
  "scenarios": [
    {
      "id": "escalation",
      "name": "Эскалация",
      "description": "Продолжение роста напряжённости",
      "probability": 0.35,
      "triggers": ["Новые санкции", "Мобилизация"],
      "consequences": ["VIX > 35", "Рост волатильности"],
      "horizonHours": 72,
      "severity": "high"
    }
  ]
}
~~~

### Cascading Scenario Tree

Для топ-3 сценариев генерируем под-сценарии — дерево развития.

~~~javascript
const tree = await generator.generateCascadingTree(latest, context, depth=2);
// {
//   root: [...7 сценариев],
//   branches: {
//     escalation: [...3 под-сценария],
//     deescalation: [...3 под-сценария],
//     crisis: [...3 под-сценария],
//   }
// }
~~~

### Fallback без LLM

Если LLM недоступен — генерируем сценарии на основе порогов метрик:

- VIX > 25 или конфликты > 10 → сценарии «escalation / deescalation / crisis / stable»
- Иначе → «stable / gradual_worsening / sudden_crisis / improvement»

### Что это даёт

Distribution over scenarios вместо одной вероятности. Дашборд показывает дерево.

Правило: если самый вероятный сценарий имеет вероятность < 0.3 — система в состоянии высокой неопределённости. Прогнозы ненадёжны.

## 15.7 Сводка

Номер | Слой | Уникальность | Ключевой сигнал
1 | Temporal Causal | Никто не моделирует задержки | Ускорение задержки
2 | Multi-Layer DAG | Единственная 4-слойная причинность | Cross-layer ratio > 0.3
3 | Narrative Warfare | Первая модель координации | suspicion > 0.7
4 | Resource Exhaustion | Единственная физическая модель | aggregate > 0.7
5 | Meta-Ensemble | Online model selection | Резкая смена рейтинга
6 | Scenario Generator | Distribution over scenarios | Top scenario < 0.3

Все 6 слоёв интегрированы в engine v3.0 через фазы J, K, L.

Правило композитного сигнала: если 3+ слоя одновременно показывают критический уровень — вероятность breaking point максимальна.

## 15.8 Что дальше

Возможные расширения:

- Bayesian Networks для кросс-слойных связей — вместо фиксированных strength, выученные из данных
- Counterfactual на Resource Exhaustion — «что если мы сократим расход на 20%»
- Narrative Attribution — «кто запустил нарратив» через графовую инверсию
- Temporal Meta-Learner — учится не только «какие модели лучше в режиме», но и «какие модели лучше предсказывают режимные сдвиги»

Но это уже v4.0.
