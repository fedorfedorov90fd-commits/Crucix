файл ядра — collect-rss-universal.mjs


# Универсальный RSS-сборщик: collect-rss-universal.mjs

## Простое объяснение (для новичков)

Этот файл — «универсальный насос» системы. Он работает как `collect-rsshub.mjs`, но с одним важным отличием: он собирает новости не только из фидов, прописанных в конфиге, но и из **любых** RSS-источников, которые ему передали в аргументах или в отдельном списке.

**Что он делает:**

1. **Принимает список URL** — либо из аргументов командной строки, либо из файла, либо из отдельного конфига.
2. **Скачивает RSS-ленты** — по каждой ссылке, с таймаутом, повторами и User-Agent.
3. **Парсит XML** — через `rss-parser`.
4. **Нормализует** — даты, URL, хеши.
5. **Дедуплицирует** — внутри потока.
6. **Сохраняет в корзину** — `data/basket/rss-universal.json` в формате `crucix.basket.v1`.

**Зачем это нужно:**

`collect-rsshub.mjs` работает с фиксированным списком из `config/feeds.json`. Это удобно для регулярного сбора. Но иногда нужно быстро собрать данные с новых источников — без правки конфига. Для этого и нужен `collect-rss-universal.mjs`: передал ему URL — и он собрал.

**Аналогия:**

Это как пылесос с набором насадок. Стандартная насадка (`collect-rsshub`) — для обычной уборки. Универсальная (`collect-rss-universal`) — для любых поверхностей, включая те, что не входят в стандартный набор.

---

## Научная база (для специалистов)

Модуль реализует **параметризованный RSS-сборщик** на основе `BaseCollector`. В отличие от `collect-rsshub.mjs`, который берёт фиды из фиксированного конфига, этот сборщик принимает список URL динамически.

**Архитектура:**

- **Наследует** `BaseCollector` из `lib/rss-collector.mjs`.
- **Переопределяет** `getFeeds()` — возвращает фиды из:
  - аргументов командной строки (`process.argv`),
  - файла `config/feeds-universal.json` (если есть),
  - дефолтного списка (если ничего не передано).
- **Использует** стандартные методы базового класса: `fetch()`, `parse()`, `normalize()`, `save()`.
- **Пишет** в `data/basket/rss-universal.json`.

**Поток данных:**

argv / config/feeds-universal.json → getFeeds() → fetch() → parse() → normalize() → dedup → save() → data/basket/rss-universal.json
text


**Приоритет источников фидов:**

1. **Аргументы командной строки** — `node collect-rss-universal.mjs --feed https://example.com/rss --feed https://example.org/rss`.
2. **Файл `config/feeds-universal.json`** — если аргументов нет.
3. **Дефолтный список** — если нет ни аргументов, ни файла.

**Отличия от `collect-rsshub.mjs`:**

| Параметр | collect-rsshub.mjs | collect-rss-universal.mjs |
|---|---|---|
| Источник фидов | `config/feeds.json` | argv / `config/feeds-universal.json` / дефолт |
| Выходной файл | `data/basket/rsshub.json` | `data/basket/rss-universal.json` |
| Назначение | Регулярный сбор | Разовый сбор / эксперименты |
| Стабильность | Высокая (фиксированный список) | Зависит от переданных URL |

**Ключевые решения:**

1. **Гибкость.** Можно передать любой URL — не нужно править конфиг.
2. **Fallback.** Если URL не передан — используется дефолтный список (например, те же 6 фидов).
3. **Изоляция.** Результаты пишутся в отдельный файл (`rss-universal.json`), чтобы не смешиваться с `rsshub.json`.
4. **Совместимость.** Формат `crucix.basket.v1` — тот же, что у `collect-rsshub.mjs`. API-модули могут читать его без изменений.

**Ограничения:**

- Не кеширует — каждый запуск тянет фиды заново.
- Не поддерживает расписание — только ручной запуск или через cron.
- Не дедуплицирует между фидами — только внутри потока.

---

## Как работает (пошагово)

1. При запуске (`node collect-rss-universal.mjs`) создаётся экземпляр `RssUniversalCollector`.
2. Конструктор вызывает `super('rss-universal', { source: 'collect-rss-universal.mjs' })`.
3. `run()` (из базового класса) вызывает `getFeeds()`.
4. `getFeeds()`:
   - Проверяет `process.argv` на наличие `--feed <url>`.
   - Если есть — использует их.
   - Если нет — читает `config/feeds-universal.json`.
   - Если нет — использует дефолтный список.
5. Для каждого фида:
   - `fetch(url)` — HTTP-запрос с таймаутом 15с, до 2 повторов, User-Agent Chrome.
   - `parse(xml)` — парсинг через `rss-parser`.
   - `normalize(item)` — нормализация URL, даты, хеша.
6. Собирает все items в массив.
7. Внутрифидовый дедуп: `guid → normalized_link → content_hash → titleSimilarity (0.9)`.
8. `save(items)` — записывает в `data/basket/rss-universal.json`.
9. Логирует результат: `[rss-universal] feed_id: N raw → M unique`.
10. Возвращает `{ items, errors, feeds_checked }`.

**Логирование:**

[rss-universal] example.com: 50 raw → 48 unique (0 date-fallbacks)
[rss-universal] example.org: 100 raw → 97 unique (0 date-fallbacks)
[rss-universal] total: 150 raw → 145 unique
[rss-universal] written to data/basket/rss-universal.json
text


---

## Пример использования

**Запуск без аргументов (дефолтный список):**

```bash
cd "/home/ta8_/Рабочий стол/Crucix"
node --env-file=.env scripts/collectors/collect-rss-universal.mjs

Запуск с конкретными URL:
bash

node --env-file=.env scripts/collectors/collect-rss-universal.mjs \
  --feed https://tass.ru/rss/v2.xml \
  --feed https://www.theguardian.com/world/rss

Запуск с файлом конфига:
bash

# Сначала создайте config/feeds-universal.json
cat > config/feeds-universal.json <<'EOF'
{
  "feeds": [
    { "id": "custom1", "url": "https://example.com/rss", "group": "neutral" },
    { "id": "custom2", "url": "https://example.org/rss", "group": "western" }
  ]
}
EOF

# Затем запустите
node --env-file=.env scripts/collectors/collect-rss-universal.mjs

Пример результата:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rss-universal",
    "source": "collect-rss-universal.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 145,
    "feeds_checked": 2,
    "errors_count": 0
  },
  "items": [
    {
      "feed_id": "custom1",
      "source": "example.com",
      "group": "neutral",
      "title": "Новость с кастомного фида",
      "link": "https://example.com/article",
      "normalized_link": "https://example.com/article",
      "published_at": "2026-11-02T08:32:49.000Z",
      "content_hash": "a1b2c3d4..."
    }
  ]
}

Практические рекомендации

    Для регулярного сбора используйте collect-rsshub.mjs. Он работает с фиксированным списком из config/feeds.json.

    Для разовых экспериментов используйте collect-rss-universal.mjs. Передайте URL — и он соберёт.

    --feed <url> — можно передать несколько раз для нескольких фидов.

    config/feeds-universal.json — альтернатива аргументам. Удобно, если URL много.

    Дефолтный список — если ничего не передано, используется базовый набор (те же 6 фидов, что и в rsshub). Это защита от пустого запуска.

    Выходной файл — data/basket/rss-universal.json. Не пересекается с rsshub.json.

    Формат crucix.basket.v1 — совместим с API-модулями. articles-api.mjs может читать его как fallback.

    Не запускайте слишком часто — источники могут забанить.

    Проверяйте errors[] — если фид регулярно падает, проверьте URL в браузере.

    Для тестирования — передайте 1–2 URL и проверьте результат.

    Не используйте для продакшена — для стабильного сбора есть collect-rsshub.mjs.

    enabled: false не поддерживается в argv-режиме. Для отключения — не передавайте URL.

    Запускайте вручную или через cron — расписание не встроено.

Связанные модули

    scripts/collectors/lib/rss-collector.mjs — базовый класс.

    scripts/collectors/collect-rsshub.mjs — основной сборщик (фиксированный список).

    config/feeds.json — список фидов для rsshub.

    config/feeds-universal.json — альтернативный список (опционально).

    scripts/utils/date-parser.mjs — нормализация дат.

    scripts/utils/string-similarity.js — дедупликация.

    apis/sources/articles-api.mjs — читает basket/rss-universal.json (fallback).

    apis/sources/rss-stats-api.mjs — читает basket/rss-universal.json (fallback).
