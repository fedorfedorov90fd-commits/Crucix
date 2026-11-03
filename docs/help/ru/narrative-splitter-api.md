Файл: narrative-splitter-api.md
markdown

# Сравнительный анализ нарративов: narrative-splitter-api.mjs

## Простое объяснение (для новичков)

Этот файл — «сравнитель нарративов». Он берёт две группы источников и математически показывает, насколько по-разному они описывают одни и те же события.

**Что он делает:**

1. **Сравнивает тональность.** Если у одной группы по теме «экономика» тональность +0.8 (позитив), а у другой −0.8 (негатив) — это `HIGH_POLARIZATION`. Разница (`contrast_score`) показывает глубину семантической пропасти.
2. **Ищет синхронные «залпы».** Если 5 источников публикуют новость об одной теме в течение 5 минут — это `Coordinated Burst`. Признак координации редакций или работы бот-сети.
3. **Вычисляет задержку реакции.** Если одна группа опубликовала событие на 6+ часов раньше другой — это `reaction_gap`. Одна сторона «спит», другая — активна.

**Зачем это нужно:**

Позволяет увидеть, является ли новость естественным событием или результатом медийной кампании. Если 5 источников «вспыхнули» одновременно — это уже не случайность. Если одна сторона молчит, а другая пишет — это сигнал.

**Аналогия:**

Представьте, что вы сравниваете два блюда. Одно — сладкое, другое — солёное. Разница (`contrast_score`) показывает, насколько они непохожи. Если разница большая — это два разных блюда. Если маленькая — почти одинаковые.

---

## Научная база (для специалистов)

Модуль реализует **анализ тональности** (sentiment analysis) и **детекцию синхронности** (burst detection) для сравнительного анализа нарративов.

**Формально:**

**1. Тональность (polarity):**

Для каждой группы (`russian`, `western`) вычисляется средняя тональность заголовков по теме:

**polarity(group, topic) = (1/N) · Σ sentiment(title_i)**

где `sentiment(title)` — тональность заголовка (от −1 до +1), `N` — число заголовков.

**2. Поляризация:**

**polarity_delta = |polarity_russian - polarity_western|**

Если `polarity_delta > 0.3` — `framing_gap`. Если `> 0.5` — `high severity`.

**3. Синхронность (burst):**

События сортируются по времени. Если `sources_count >= 3` и `spread <= 300000 мс` (5 минут) — `Coordinated Burst`.

**4. Задержка (latency):**

Для каждого события, которое есть и у `russian`, и у `western`:

**latency = first_published(russian) - first_published(western)**

Медиана латентностей — `latency_hours`. Если `|latency| > 6` — `reaction_gap`.

**Словарь тональности:**

~200 слов, вручную подобранных для новостных заголовков. Позитив: «рост», «успех», «победа». Негатив: «кризис», «удар», «санкции». Учитываются отрицания: «не рост» → негатив.

**Почему Set для источников:**

`Set` гарантирует, что один спамящий бот не будет посчитан как 10 разных источников. Это важно для детекции координации: если 10 постов от одного бота — это не «10 источников», это «1 источник».

**Ограничения:**

- Словарь тональности — грубый. Контекст «санкции против врага» = позитив, но словарь ставит негатив. ML-подход (`nlp_semantic_core.py`) даст больше.
- `reaction_gap` требует событий, которые есть и у `russian`, и у `western`. На текущих данных таких мало.
- Порог 5 минут и 3 источника — эмпирический. Для Telegram — 5 минут, для RSS — 60 минут.

---

## Как работает (пошагово)

1. `calculateNarrativeContrast(groupA, groupB, topic)` принимает две группы новостей по одной теме.
2. Вычисляет `polarity` каждой группы через словарь.
3. Вычисляет `contrast_score = |polarity_A - polarity_B|`.
4. Классифицирует: `HIGH_POLARIZATION` (> 0.7) или `ALIGNED_NARRATIVE` (≤ 0.7).
5. `detectCoordinatedBurst(items, timeWindowMs)` сортирует новости по времени.
6. Для каждого события: если `sources_count >= 3` и `spread <= timeWindowMs` — `Coordinated Burst`.
7. Возвращает массив burst'ов с деталями: `topic`, `sources`, `spread`, `count`.
8. `calculateNarrativeContrast` возвращает `{ topic, contrast_score, interpretation, source_a_tone, source_b_tone }`.
9. `detectCoordinatedBurst` возвращает массив `{ topic, sources, start, count }`.

**Формат ответа для контраста:**

```json
{
  "topic": "economy",
  "contrast_score": "0.82",
  "interpretation": "HIGH_POLARIZATION",
  "source_a_tone": "Positive",
  "source_b_tone": "Negative"
}

Формат ответа для burst:
json

[
  {
    "topic": "military",
    "sources": ["ТАСС", "РИА", "Интерфакс", "RT", "Sputnik"],
    "start": 1730458800000,
    "count": 5,
    "spread_minutes": 3.2
  }
]

Пример использования
javascript

import { calculateNarrativeContrast, detectCoordinatedBurst } from './scripts/analyzers/contrast-engine.mjs';

// Сравнение тональностей
const contrast = calculateNarrativeContrast(groupA, groupB, 'economy');
console.log(contrast);
// { topic: 'economy', contrast_score: '0.82', interpretation: 'HIGH_POLARIZATION', ... }

// Поиск синхронных залпов
const bursts = detectCoordinatedBurst(allNews, 5 * 60 * 1000);
console.log(bursts);
// [{ topic: 'military', sources: [...], start: ..., count: 5 }, ...]

Что происходит:

    calculateNarrativeContrast сравнивает тональности двух групп по теме «экономика».

    Если у одной группы +0.8, у другой −0.8 — contrast_score = 1.6, HIGH_POLARIZATION.

    detectCoordinatedBurst ищет события, где 5 источников опубликовали новость в течение 5 минут.

    Если найдено — возвращает массив с деталями.

Практические рекомендации

    Словарь тональности — ~200 слов. Для русского и английского. Если нужна точность — используйте nlp_semantic_core.py (эмбеддинги).

    Порог 5 минут и 3 источника — для RSS. Для Telegram — 5 минут, для Twitter — 30 секунд.

    Set для источников — обязателен. Без него один бот будет посчитан как 10 источников.

    reaction_gap требует событий с обеими группами. На текущих данных (мало западных фидов) таких мало. После расширения — будет больше.

    calculateNarrativeContrast — не для всех тем. Если у группы нет событий по теме — polarity = 0, NO_DATA.

    detectCoordinatedBurst — не для всех событий. Если событие есть только у одного источника — не считается.

    ALIGNED_NARRATIVE — встречается редко. Означает, что обе стороны говорят одно и то же (например, о стихийном бедствии).

    HIGH_POLARIZATION — не всегда «плохо». Это может быть естественное расхождение (разные мнения) или скоординированная кампания. Контекст важен.

    Для больших корпусов — вычисляйте батчами. Не за один проход.

    config/contrast.json — пороги hours и min_events_per_topic. Калибруйте под свой поток.

Связанные модули

    apis/sources/narrative-framing-api.mjs — API для данных.

    apis/sources/narrative-splitter-api.mjs — этот файл.

    dashboard/public/widgets/narrative-scatter.js — виджет scatter.

    dashboard/public/dashboard-narrative.html — страница с scatter.

    config/contrast.json — конфиг с порогами.

    db/migrations/011_framing_gaps.sql — таблица framing_gaps.

    services/nlp_semantic_core.py — эмбеддинги (для точности).
