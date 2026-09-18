# План встраивания Human Feedback в engine.mjs

**Статус: план. Патч пока не применён.**

Этот документ — инструкция для того момента, когда будет решено подключить `human_feedback.mjs` к основному конвейеру Crucix.

---

## Куда встраивать

Рекомендованное место — **после фазы F (калибровка), перед фазой G (активное обучение)**.

Причина. Фаза F обновляет Brier Score и Platt-калибровку. Если подключить human_feedback раньше — калибровка срежет его эффект. Если позже — обновлённые веса не попадут в текущий прогноз. Оптимальная точка: сразу после калибровки, до активного обучения.

Схема конвейера с новой фазой:

~~~
sweep (15 мин)
  │
  ├─ Фаза A: источники
  ├─ Фаза B: базовые модели
  ├─ Фаза C: продвинутые модели
  ├─ Фаза D: ансамблирование
  ├─ Фаза E: рефлексивная коррекция
  ├─ Фаза F: калибровка
  ├─ Фаза F': human feedback ← НОВОЕ
  ├─ Фаза G: активное обучение
  ├─ Фаза H: объяснимость
  ├─ Фаза I: граф знаний
  │
  └─ latest_forecast.json → дашборд
~~~

---

## Патч engine.mjs — минимальный

В `apis/predict/engine.mjs` после блока фазы F (примерно после строки с `phaseF_Calibration`) добавить импорт:

~~~javascript
import { crucixHumanFeedback } from '../features/human-feedback/human_feedback.mjs';
~~~

**Внимание:** путь `../features/...` — из `apis/predict/` в `features/human-feedback/`. Проверить корректность после переноса в рабочий проект.

Затем в главной функции `runForecastPipeline`, сразу после вызова `phaseF_Calibration`:

~~~javascript
// ─── Фаза F': Human Feedback ───
const humanFeedback = options.skipHumanFeedback
  ? null
  : crucixHumanFeedback(latest, calibratedForecasts, {
      save: true,
      applyNewWeights: false,  // пока веса не используются потребителем
    });
~~~

И в финальный объект `forecast` добавить поле:

~~~javascript
forecast: {
  // ... существующие поля ...
  humanFeedback,
  // ...
}
~~~

Плюс новая опция в `options`:

~~~javascript
const {
  skipSources = false,
  skipAdvanced = false,
  skipExplainability = false,
  skipActiveLearning = false,
  skipKnowledgeGraph = false,
  skipHumanFeedback = false,  // ← новая опция
} = options;
~~~

---

## Патч engine.mjs — расширенный (с применением весов)

Этот вариант нужен, когда появится потребитель весов — модуль, который читает обновлённые веса и использует их в ансамблировании.

В `phaseD_Ensemble` перед расчётом финальной вероятности:

~~~javascript
import { HumanFeedbackLearner } from '../features/human-feedback/human_feedback.mjs';

// Загружаем обученные веса признаков
const humanLearner = HumanFeedbackLearner.load();
const featureWeights = humanLearner.getCurrentWeights();

// Применяем в ансамблировании
const estimate = {
  source: 'bayesian',
  probability: bayesF.posterior,
  weight: 1.0 * (featureWeights.vix || 1.0),
};
~~~

Это сложнее, потому что требует определить, какие именно признаки и как влияют на вес источника. На первом этапе — не делать, начать с минимального патча.

---

## Применение накопленных меток из очереди оператора

Дашборд `human_feedback.dashboard.html` экспортирует файл `human_feedback_pending_<timestamp>.json` — массив меток, накопленных оператором в localStorage.

Чтобы применить эти метки к состоянию обучения, нужно:

### Шаг 1. Сохранить скачанный файл

Оператор скачивает файл из браузера. Его надо переместить в удобное место:

~~~bash
mkdir -p /home/ta8/Документы/features/human-feedback/pending
mv ~/Downloads/human_feedback_pending_*.json /home/ta8/Документы/features/human-feedback/pending/
~~~

### Шаг 2. Применить через скрипт

Готовый скрипт для применения:

~~~bash
cd "/home/ta8/Документы" && node --input-type=module -e "
import { HumanFeedbackLearner } from './features/human-feedback/human_feedback.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const learner = HumanFeedbackLearner.load();
const pendingDir = './features/human-feedback/pending';

const files = readdirSync(pendingDir).filter(f => f.startsWith('human_feedback_pending_'));
let applied = 0;

for (const file of files) {
  const entries = JSON.parse(readFileSync(join(pendingDir, file), 'utf-8'));
  for (const entry of entries) {
    const result = learner.recordFeedback(entry);
    if (result.accepted) applied++;
  }
}

learner.save();
console.log('Применено меток:', applied);
console.log('Всего обратной связи:', learner.totalFeedback);
console.log('Good:', learner.goodCount);
console.log('Bad:', learner.badCount);
console.log('Uncertain:', learner.uncertainCount);
"
~~~

### Шаг 3. Проверить состояние

~~~bash
cd "/home/ta8/Документы" && ls -la runs/predictions/human_feedback.json && node --input-type=module -e "
import { HumanFeedbackLearner } from './features/human-feedback/human_feedback.mjs';
const l = HumanFeedbackLearner.load();
console.log(JSON.stringify(l.getMetrics(), null, 2));
"
~~~

### Шаг 4. (опционально) Удалить применённые файлы

~~~bash
cd "/home/ta8/Документы" && ls -la features/human-feedback/pending/ 
~~~

Только после визуальной проверки, что все метки применились — можно удалять вручную. Автоматического удаления нет, потому что удаление без явного подтверждения запрещено правилами проекта.

---

## Что требует доработки

Пять мест, которые сейчас работают неоптимально.

### 1. Нет серверного эндпоинта для метки

Дашборд не может писать метку напрямую в файл. Оператор скачивает JSON и применяет командой в терминале. Это работает, но неудобно.

**Решение:** добавить эндпоинт `POST /api/human_feedback/record` в основной сервер Crucix. Тогда дашборд сможет отправлять метки напрямую.

Это отдельная задача для основной серверной части (`server/router.mjs`, `apis/sources/human_feedback-api.mjs`), не для этой папки.

### 2. Потребитель весов отсутствует

Обновлённые веса сохраняются в `human_feedback.json`, но никто их не читает. Нужен патч в `phaseD_Ensemble` — либо в ансамблировании, либо в отдельном шаге после human_feedback, который применяет веса к текущим прогнозам.

**Решение:** патч в `apis/predict/engine.mjs` (см. расширенный вариант выше).

### 3. Текстовые комментарии не обрабатываются

Сейчас комментарии сохраняются в истории, но не влияют на обучение. Их можно:
- Оставить как есть (для контекста аналитика при следующем просмотре).
- Отправлять в LLM для извлечения дополнительных признаков.
- Использовать для дообучения LLM-слоя.

**Решение для первого этапа:** оставить как есть. Обработка через LLM — отдельная задача.

### 4. Калибровка весов между срезами времени

Пока нет механизма затухания: если оператор дал метку 3 месяца назад, она весит столько же, сколько метка сегодня. Нужно ввести временной распад (например, экспоненциальный с half-life 30 дней).

**Решение:** параметр `recencyDecay` в `HumanFeedbackLearner` (не реализован).

### 5. Нет тестов

Модуль `human_feedback.mjs` не покрыт тестами. Нужны:
- Unit-тесты для `recordFeedback`, `updateWeights`, `whatIf`.
- Property-based тест: сумма весов не уходит в бесконечность при большом количестве меток.
- Fuzz-тест: корректная обработка невалидных входных данных.

**Решение:** файл `tests/predict/human_feedback.test.mjs` (не создан).

---

## Рекомендации по порядку внедрения

Если бы это делалось с нуля, порядок был бы такой.

### Этап 1. Только сохранить модуль, не подключать

Сейчас модуль лежит в `features/human-feedback/` как заготовка. Ничего не вызывает. Это безопасное состояние.

### Этап 2. Подключить минимальный патч

Добавить в `engine.mjs`:
- Импорт `crucixHumanFeedback`.
- Опцию `skipHumanFeedback`.
- Вызов после фазы F (без применения весов).

Эффект: в `latest_forecast.json` появится поле `humanFeedback` с метриками (но не с весами, применёнными к прогнозу). Наблюдаем.

### Этап 3. Включить применение весов

Доработать `phaseD_Ensemble`, чтобы он читал веса из `human_feedback.json` и применял их.

Эффект: обратная связь оператора начнёт влиять на прогнозы. Это уже реальный обучающий цикл.

### Этап 4. Серверный эндпоинт

Добавить `POST /api/human_feedback/record`, обновить дашборд. Оператор сможет ставить метки прямо в браузере, они сразу будут попадать в файл.

### Этап 5. Тесты и регрессионный мониторинг

Покрыть тестами, добавить в CI, мониторить деградацию весов.

---

## Проверка после применения патча

После каждого этапа — команды проверки.

### После этапа 2 (минимальный патч)

~~~bash
cd "/home/ta8/Документы" && node --check apis/predict/engine.mjs && echo "SYNTAX OK"
node --input-type=module -e "
import { runForecastPipeline } from './apis/predict/engine.mjs';
const testLatest = {
  timestamp: new Date().toISOString(),
  fred: { vix: 22, hySpread: 3.5 },
  gdelt: { conflictEvents: [] },
  sanctions: { count: 1 },
  delta: { newAlerts: 2, escalatedAlerts: 0 },
};
const r = await runForecastPipeline(testLatest, { skipSources: true, skipAdvanced: true });
console.log('humanFeedback field:', typeof r.humanFeedback);
console.log('metrics:', JSON.stringify(r.humanFeedback?.metrics));
"
~~~

Ожидание: поле `humanFeedback` присутствует, метрики показывают 0 сигналов (если дашборд ещё не использовался) или текущее состояние.

### После этапа 3 (применение весов)

~~~bash
cd "/home/ta8/Документы" && node --input-type=module -e "
import { HumanFeedbackLearner } from './features/human-feedback/human_feedback.mjs';
const l = HumanFeedbackLearner.load();
console.log('Признаков с обученными весами:', l.featureWeights.size);
console.log('Топ-5 весов:', JSON.stringify([...l.featureWeights.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)));
"
~~~

Ожидание: веса не равны 1.0 (если оператор давал метки), либо равны 1.0 (если ещё ничего не было).

---

## Заключение

Этот документ описывает план, а не реализацию. Патч не применён. Модуль готов, дашборд готов, но цикл не замкнут.

Чтобы замкнуть цикл, нужно пройти пять этапов. Самый быстрый и безопасный — этапы 2 и 3. Они дают работающий обучающий контур за один-два дня работы.

После этого Crucix станет системой, которая учится у оператора. Ни Palantir, ни Recorded Future, ни Seldon Vault публично этого не делают.

Дата создания документа: 2026-09-16.
