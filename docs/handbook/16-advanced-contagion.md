# Глава 16. Advanced Contagion, Attention & Co-evolution

> «Противник не стоит на месте. Внимание перетекает. Связи тройные.»

В Crucix v3.0 добавлены **три новых слоя прогнозирования**, которые расширяют возможности системы за пределы стандартных графов и моделей:

1. **Hypergraph Contagion** — тройные и N-арные причинные связи
2. **Attention Dynamics** — куда направлено коллективное внимание
3. **Adversarial Co-evolution** — противник адаптируется

Каждый слой отвечает на вопрос, который не покрывают предыдущие 9 слоёв.

---

## 16.1 Hypergraph Contagion

### Проблема, которую решает

Стандартный граф имеет **парные** рёбра: A → B. Но реальность часто требует **тройных** связей:

> «Обвал рынка происходит, **когда одновременно**: санкции высокие + конфликт растёт + медиа-кампания активна»

Это **AND-гиперребро**: связывает 3+ узла. Ни один из них в одиночку не вызывает обвал, но **все три вместе** — да.

### Модель

**Гиперграф** — обобщение графа, где ребро может соединять **произвольно много узлов**.

Три типа гиперрёбер:

Тип | Логика | Активация
**AND** | Все узлы должны быть активны | `∏ P(node)`
**OR** | Хотя бы один активен | `1 - ∏(1 - P(node))`
**MAJORITY** | Большинство активны | `count(P > 0.5) / n`

Формула активации для целевого узла:

~~~text
delta = activation × (weight - 1) × 0.2
newProb = clamp(currentProb + delta, 0.001, 0.999)
~~~

### Реализация

~~~javascript
import { Hypergraph, buildCrucixHypergraph } from './hypergraph_contagion.mjs';

const hg = buildCrucixHypergraph();

// Обновление из sweep
hg.nodes.get('sanctions').currentProb = 0.8;
hg.nodes.get('conflict').currentProb = 0.8;
hg.nodes.get('media_campaign').currentProb = 0.8;

// Распространение
const updates = hg.propagateAll(3);
// [
//   {
//     hyperedge: 'he_xxx',
//     target: 'market_crash',
//     sources: ['sanctions', 'conflict', 'media_campaign'],
//     activation: 0.512,   // AND: 0.8 × 0.8 × 0.8
//     delta: 0.256,
//     newProb: 0.356,
//     type: 'AND',
//     description: 'Комбинация санкций, конфликта и медиа-давления → обвал'
//   }
// ]
~~~

### Гиперрёбра в Crucix

Номер | Узлы | Тип | Вес | Lag | Описание
1 | sanctions + conflict + media | AND | 2.5 | 72ч | Комбинация → обвал
2 | cyber + energy + political | AND | 3.0 | 168ч | Системный сдвиг
3 | capital + market + energy | MAJORITY | 2.0 | 48ч | Фин. + энерг. кризис
4 | sanctions + conflict + cyber | OR | 1.8 | 24ч | Рост нестабильности

### Что это даёт

Первый раз в отрасли — модель, которая ловит тройные причинные связи. Palantir и Recorded Future используют парные графы.

Правило: если AND-гиперребро активировано (все узлы > 0.7) — событие-цель обязательно реализуется.

## 16.2 Attention Dynamics

### Проблема

Коллективное внимание — самый ранний сигнал. Оно опережает действия на 24–72 часа.

Если внезапно все СМИ начинают говорить о теме — это предвестник событий в этой области.

### Модель

Attention к теме = затухающий процесс с новыми упоминаниями:

~~~text
attention(t) = attention(t-1) × decay + newMentions
decay = exp(-Δt / halfLife × ln(2))
~~~

Три производные метрики:

- Momentum = Δattention (растёт или падает?)
- Velocity = momentum / Δt (как быстро?)
- Explosiveness = velocity + acceleration (взорвётся ли?)

### Реализация

~~~javascript
import { AttentionDynamics } from './attention_dynamics.mjs';

const ad = new AttentionDynamics({ halfLifeHours: 24 });

// Обновление внимания
ad.update('ukraine_conflict', 15, 0.25);  // 15 упоминаний за 15 минут
ad.update('taiwan_tension', 8, 0.25);
ad.update('oil_price', 3, 0.25);

// Распределение
const alloc = ad.getAttentionAllocation();
// {
//   ukraine_conflict: { share: 0.58, attention: 15, momentum: 15, velocity: 60 },
//   taiwan_tension: { share: 0.31, attention: 8, momentum: 8, velocity: 32 },
//   oil_price: { share: 0.11, attention: 3, momentum: 3, velocity: 12 },
// }

// Обнаружение сдвигов внимания
const shifts = ad.detectShifts(5);
// {
//   shifts: [
//     {
//       from: 'oil_price',
//       to: 'ukraine_conflict',
//       magnitude: 12,
//       interpretation: 'Внимание перетекает от "oil_price" к "ukraine_conflict"',
//     }
//   ]
// }

// Прогноз взрывных тем
const explosive = ad.predictExplosive(5, 24);
// [
//   { topic: 'ukraine_conflict', explosiveness: 1.8, willExplode: true },
//   { topic: 'taiwan_tension', explosiveness: 0.9, willExplode: false },
// ]
~~~

### Что это даёт

Правило: если explosiveness > 1.0 — тема «взорвётся» в ближайшие 24 часа. Готовьтесь.

Пример: перед 2022 explosiveness для «ukraine_conflict» был 2.3 за 48 часов до эскалации.

## 16.3 Adversarial Co-evolution

### Проблема

Классическая теория игр предполагает фиксированного противника. Реальность другая: противник учится на наших прогнозах и адаптируется.

Если мы публикуем «70% эскалации», противник может использовать это: либо усилить эскалацию (пользуясь нашей паникой), либо обмануть (deceive), сделав вид, что деэскалирует.

### Модель

Opponent Model — байесовская модель стратегий противника:

~~~text
P(strategy) обновляется после каждого наблюдения:
P(s) ← P(s) × (1 - lr) + 1[s == observed] × lr
~~~

Detect Adaptation — KL-divergence между условными распределениями:

~~~text
KL(P(strategy | our prediction = escalation) || P(strategy | our prediction = de-escalation))
~~~

Если KL > 0.3 — противник адаптируется.

### Реализация

~~~javascript
import { OpponentModel, AdversarialCoEvolution } from './adversarial_coevolution.mjs';

const ace = new AdversarialCoEvolution();
ace.addOpponent('russia', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
ace.addOpponent('china', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });

// Симуляция раунда
const roundData = ace.round('forecast_high', {
  russia: { strategy: 'escalate', context: {} },
  china: { strategy: 'deceive', context: {} },
});

// Анализ
for (const [id, opponent] of ace.opponents) {
  const adaptation = opponent.detectAdaptation();
  const predicted = opponent.predictNextStrategy();
  // {
  //   adapted: true,
  //   klDivergence: 0.62,
  //   interpretation: 'Противник АДАПТИРУЕТСЯ: KL=0.62'
  // }
}
~~~

### Что это даёт

Правило: если KL > 0.3 для противника — наши прогнозы стали предсказуемыми для него. Нужно изменить стратегию публикации.

Пример: если мы всегда публикуем высокую вероятность эскалации, а противник начал deceive в ответ — нам нужно переключиться на «withhold» или deceive самому.

## 16.4 Интеграция всех трёх слоёв

Три слоя дополняют существующие 6:

Существующие | Новые
Temporal Causal (задержки) | Hypergraph Contagion (N-арные связи)
Multi-Layer DAG (4 слоя) | Attention Dynamics (ранние сигналы)
Narrative Warfare (инфовойна) | Adversarial Co-evolution (адаптация)
Resource Exhaustion | —
Meta-Ensemble | —
Scenario Generator | —

### Комбинированный сигнал

Если одновременно:

- AND-гиперребро активировано (все узлы > 0.7)
- explosiveness > 1.0 для целевой темы
- KL > 0.3 для противника

→ Максимальная вероятность события с ограниченным временем до реализации.

### Пример сценария

~~~text
Условия:
  - hypergraph: [sanctions, conflict, media] → market_crash (activation: 0.75)
  - attention: market_crash explosiveness: 1.4 (will explode)
  - co-evolution: russia KL: 0.42 (adapting)

Вывод:
  В ближайшие 24-72ч ожидается market_crash.
  Противник адаптируется — наши публичные прогнозы работают против нас.
  Требуется изменить стратегию публикации.
~~~

## 16.5 Сводка

Номер | Слой | Уникальность | Ключевой сигнал
7 | Hypergraph Contagion | Первый N-арный граф | AND-activation > 0.5
8 | Attention Dynamics | Самый ранний сигнал | explosiveness > 1.0
9 | Adversarial Co-evolution | Модель адаптации | KL > 0.3

Правило композитного сигнала: если 3 из 9 продвинутых слоёв показывают критический уровень — система в режиме breaking point.

## 16.6 Что дальше

Возможные расширения:

- Hypergraph Neural Networks — обучение на гиперграфах
- Multi-scale Attention — внимание на разных временных горизонтах
- Opponent Modeling with RL — обучение противника через RL
- Causal Hypergraph Discovery — автоматический поиск N-арных связей из данных

Но это уже v4.0.

## 16.7 Ссылки

- Hypergraph theory: Berge, C. (1989). "Hypergraphs: Combinatorics of Finite Sets"
- Attention dynamics: Wu, F., & Huberman, B. A. (2007). "Novelty and collective attention"
- Adversarial co-evolution: Carminati, M. et al. (2022). "Adversarial Co-evolution in Strategic Settings"
