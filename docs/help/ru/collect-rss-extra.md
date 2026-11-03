файл ядра — collect-rss-extra.mjs


# Дополнительный RSS-сборщик: collect-rss-extra.mjs

## Простое объяснение

Этот файл — «запасной насос» системы. Он собирает новости с источников, которые не вошли в основной список (`config/feeds.json`), но которые полезно иметь под рукой: региональные СМИ, отраслевые издания, нишевые блоги.

**Что он делает:**
1. **Читает свой список фидов** — `config/feeds-extra.json` (отдельный от основного).
2. **Скачивает RSS-ленты** — с таймаутом, повторами, реалистичным User-Agent.
3. **Парсит XML** — через `rss-parser`.
4. **Нормализует** — даты, URL, хеши.
5. **Дедуплицирует** — внутри потока.
6. **Сохраняет в корзину** — `data/basket/rss-extra.json` в формате `crucix.basket.v1`.

**Зачем это нужно:**
Основной сборщик (`collect-rsshub.mjs`) работает с 6 крупными фидами. Но иногда нужны дополнительные источники: региональные, отраслевые, специализированные. Добавлять их в основной конфиг — значит менять поведение всей системы. А `collect-rss-extra.mjs` — это отдельный слой: он собирает дополнительное, не трогая основное.

**Аналогия:**
Это как дополнительная корзина в супермаркете. Основная — для продуктов. Дополнительная — для того, что вы увидели по пути: специи, деликатесы, что-то необычное. Основная не меняется — просто рядом появляется ещё одна.

---

## Научная база
Модуль реализует **изолированный RSS-сборщик** для дополнительных источников, не пересекающийся с основным потоком.

**Архитектура:**
- **Наследует** `BaseCollector` из `lib/rss-collector.mjs`.
- **Переопределяет** `getFeeds()` — читает `config/feeds-extra.json`.
- **Использует** стандартные методы базового класса: `fetch()`, `parse()`, `normalize()`, `save()`.
- **Пишет** в `data/basket/rss-extra.json`.

**Изоляция от основного потока:**
| Параметр | collect-rsshub.mjs | collect-rss-extra.mjs |
|---|---|---|
| Конфиг | `config/feeds.json` | `config/feeds-extra.json` |
| Выходной файл | `data/basket/rsshub.json` | `data/basket/rss-extra.json` |
| Назначение | Основные источники | Дополнительные источники |
| Обновление | Частое (раз в 15–30 мин) | Реже (раз в час) |

**Зачем изоляция:**
1. **Не ломает основной поток.** Если дополнительный фид упал или отдал мусор — основной сбор не страдает.
2. **Разные расписания.** Основные фиды обновляются часто, дополнительные — реже.
3. **Разные форматы.** Дополнительные источники могут быть нестандартными (региональные, нишевые) — их не хочется смешивать с основными.

**Поток данных:**

config/feeds-extra.json → getFeeds() → fetch() → parse() → normalize() → dedup → save() → data/basket/rss-extra.json
text


**Ключевые решения:**
1. **Отдельный конфиг.** `config/feeds-extra.json` — свой список, не пересекается с `feeds.json`.
2. **Отдельный выход.** `data/basket/rss-extra.json` — не смешивается с `rsshub.json`.
3. **Fallback-цепочка чтения.** API-модули (`articles-api.mjs`) читают `rsshub.json → rss-latest.json → rss-universal.json → rss.json`. `rss-extra.json` — не входит в цепочку, читается отдельно.
4. **Совместимость формата.** `crucix.basket.v1` — тот же стандарт.

**Ограничения:**
- Не кеширует — каждый запуск тянет фиды заново.
- Не дедуплицирует между фидами — только внутри потока.
- API-модули по умолчанию не читают `rss-extra.json`. Нужно явно указать, если хотите использовать.

---

## Как работает (пошагово)
1. При запуске (`node collect-rss-extra.mjs`) создаётся экземпляр `RssExtraCollector`.
2. Конструктор вызывает `super('rss-extra', { source: 'collect-rss-extra.mjs' })`.
3. `run()` (из базового класса) вызывает `getFeeds()`.
4. `getFeeds()` читает `config/feeds-extra.json`, фильтрует по `enabled !== false`, возвращает массив.
5. Для каждого фида:
   - `fetch(url)` — HTTP-запрос с таймаутом 15с, до 2 повторов, User-Agent Chrome.
   - `parse(xml)` — парсинг через `rss-parser`.
   - `normalize(item)` — нормализация URL, даты, хеша.
6. Собирает все items в массив.
7. Внутрифидовый дедуп: `guid → normalized_link → content_hash → titleSimilarity (0.9)`.
8. `save(items)` — записывает в `data/basket/rss-extra.json`.
9. Логирует результат: `[rss-extra] feed_id: N raw → M unique`.
10. Возвращает `{ items, errors, feeds_checked }`.

**Логирование:**
[rss-extra] regional1: 30 raw → 28 unique (0 date-fallbacks)
[rss-extra] regional2: 25 raw → 24 unique (0 date-fallbacks)
[rss-extra] total: 55 raw → 52 unique
[rss-extra] written to data/basket/rss-extra.json
text


---

## Пример использования

**Создание конфига `config/feeds-extra.json`:**

```json
{
  "feeds": [
    {
      "id": "region-moscow",
      "name": "Московский регион",
      "url": "https://example.com/moscow/rss",
      "group": "russian",
      "enabled": true
    },
    {
      "id": "industry-energy",
      "name": "Энергетика (отраслевое)",
      "url": "https://example.com/energy/rss",
      "group": "neutral",
      "enabled": true
    }
  ],
  "settings": {
    "max_items_per_feed": 50,
    "request_timeout_ms": 15000,
    "retry_attempts": 2,
    "retry_backoff_ms": 2000,
    "user_agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0 Safari/537.36 CrucixRSS/0.1"
  }
}

Запуск:
bash

cd "/home/ta8_/Рабочий стол/Crucix"
node --env-file=.env scripts/collectors/collect-rss-extra.mjs

Пример результата:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rss-extra",
    "source": "collect-rss-extra.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 52,
    "feeds_checked": 2,
    "errors_count": 0
  },
  "items": [
    {
      "feed_id": "region-moscow",
      "source": "Московский регион",
      "group": "russian",
      "title": "Региональная новость",
      "link": "https://example.com/moscow/article",
      "normalized_link": "https://example.com/moscow/article",
      "published_at": "2026-11-02T08:32:49.000Z",
      "content_hash": "a1b2c3d4..."
    }
  ]
}

Практические рекомендации
    config/feeds-extra.json — отдельный конфиг. Не смешивайте с config/feeds.json.
    enabled: false — временное отключение фида. Не удаляйте: старые статьи останутся в корзине.
    max_items_per_feed: 50 — меньше, чем у основного сборщика (100). Дополнительные фиды — не основные.
    Запускайте реже основного — раз в час или раз в 2 часа. Не чаще: источники могут забанить.

    API-модули не читают rss-extra.json по умолчанию. Если нужны данные из него — добавьте вручную в articles-api.mjs или используйте отдельный API-модуль.

    Для тестирования — добавьте 1–2 фида, запустите, проверьте результат.
    Не дублируйте фиды. Если источник уже есть в feeds.json — не добавляйте в feeds-extra.json. Иначе будут дубликаты.
    Проверяйте errors[] — если фид регулярно падает, проверьте URL в браузере.

    Формат crucix.basket.v1 — совместим с API-модулями. Но нужно явно указать rss-extra.json при чтении.

    Для продакшена — не обязательно. Основной сборщик (rsshub) даёт достаточно данных. rss-extra — для экспериментов и нишевых источников.

    Можно использовать для A/B-тестирования — сравнить, как новые источники влияют на общую картину.

    Не используйте как единственный источник. Он не входит в fallback-цепочку articles-api.mjs. Если rsshub.json пуст — rss-extra.json не спасёт.

Связанные модули

    scripts/collectors/lib/rss-collector.mjs — базовый класс.

    scripts/collectors/collect-rsshub.mjs — основной сборщик (фиксированный список).

    scripts/collectors/collect-rss-universal.mjs — универсальный сборщик (динамические URL).

    config/feeds.json — основной список фидов.

    config/feeds-extra.json — дополнительный список (создаётся вручную).

    scripts/utils/date-parser.mjs — нормализация дат.

    scripts/utils/string-similarity.js — дедупликация.

    apis/sources/articles-api.mjs — не читает rss-extra.json по умолчанию.
