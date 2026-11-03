Файл: collect-rsshub.md


# Главный RSS-сборщик: collect-rsshub.mjs

## Простое объяснение (для новичков)

Этот файл — «главный насос» системы. Он забирает новости из RSS-лент и складывает их в «корзину» (`data/basket/rsshub.json`). Именно из этой корзины потом берут данные все дашборды, виджеты и API-модули.

**Что он делает:**

1. **Читает список фидов** из `config/feeds.json` — 6 источников (ТАСС, РИА, Интерфакс, Guardian, NPR, France24).
2. **Скачивает RSS-ленты** — по каждой ссылке, с таймаутом, повторами и реалистичным User-Agent.
3. **Парсит XML** — через `rss-parser`.
4. **Нормализует** — приводит даты к ISO 8601, URL к каноническому виду, вычисляет `contentHash`.
5. **Дедуплицирует** — внутри фида по `guid → normalized_link → content_hash → titleSimilarity`.
6. **Сохраняет в корзину** — `data/basket/rsshub.json` в формате `crucix.basket.v1`.

**Зачем это нужно:**

Без этого файла нет новостей. Все остальные модули — анализаторы, API, виджеты — работают с пустотой. Это точка входа всей RSS-системы.

**Аналогия:**

Это как водозаборная станция в системе водоснабжения. Она забирает воду из реки, очищает её и подаёт в трубы. Если станция сломалась — весь город без воды. Так и здесь: если `collect-rsshub.mjs` не работает — вся система без данных.

---

## Научная база (для специалистов)

Модуль реализует **конкретный RSS-сборщик** на основе `BaseCollector` (паттерн Template Method).

**Архитектура:**

- **Наследует** `BaseCollector` из `lib/rss-collector.mjs`.
- **Переопределяет** `getFeeds()` — возвращает список фидов из `config/feeds.json`.
- **Использует** стандартные методы базового класса: `fetch()`, `parse()`, `normalize()`, `save()`.
- **Дополнительно** — логирует результат по каждому фиду и обрабатывает ошибки.

**Поток данных:**

config/feeds.json → getFeeds() → fetch() → parse() → normalize() → dedup → save() → data/basket/rsshub.json
text


**Ключевые решения:**

1. **Fallback-цепочка фидов.** Если один фид упал — остальные продолжают. Ошибка записывается в `errors[]`, но не останавливает сбор.

2. **Нормализация URL.** Убираются `utm_*`, `#fragment`, trailing slash, `http` заменяется на `https`. Без этого дедупликация не работает: `https://x.com/a?utm_source=rss` и `http://x.com/a/` — разные строки.

3. **Нормализация дат.** 7 форматов через `parseFlexibleDate()`. Критично: `DD.MM.YYYY` проверяется **до** нативного `Date.parse()`, иначе V8 интерпретирует как `MM.DD.YYYY`.

4. **Дедупликация по цепочке.** Сначала `guid` (самый надёжный), потом `normalized_link`, потом `content_hash`, потом `titleSimilarity` с порогом 0.9.

5. **Формат корзины.** `crucix.basket.v1` — единый стандарт. Читается всеми API-модулями: `articles-api.mjs`, `sources-api.mjs`, `rss-stats-api.mjs`.

**Структура корзины:**

```json
{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rsshub",
    "source": "collect-rsshub.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 500,
    "feeds_checked": 6,
    "errors_count": 0
  },
  "items": [...],
  "series": [],
  "points": [],
  "documents": []
}

Ограничения:

    Работает с config/feeds.json — если файл изменился, нужно перезапустить сборщик.

    Не кеширует — каждый запуск тянет фиды заново.

    Не дедуплицирует между фидами (только внутри). Межфидовый дедуп — в cluster-events.mjs.

Как работает (пошагово)

    При запуске (node collect-rsshub.mjs) создаётся экземпляр RssHubCollector.

    Конструктор вызывает super('rsshub', { source: 'collect-rsshub.mjs' }).

    run() (из базового класса) вызывает getFeeds().

    getFeeds() читает config/feeds.json, фильтрует по enabled !== false, возвращает массив.

    Для каждого фида:

        fetch(url) — HTTP-запрос с таймаутом 15с, до 2 повторов, User-Agent Chrome.

        parse(xml) — парсинг через rss-parser.

        normalize(item) — нормализация URL, даты, хеша.

    Собирает все items в массив.

    Внутрифидовый дедуп: guid → normalized_link → content_hash → titleSimilarity (0.9).

    save(items) — записывает в data/basket/rsshub.json с schema: "crucix.basket.v1".

    Логирует результат: [rsshub] feed_id: N raw → M unique.

    Возвращает { items, errors, feeds_checked }.

Логирование:
text

[rsshub] tass-world: 100 raw → 98 unique (0 date-fallbacks)
[rsshub] ria-world: 100 raw → 97 unique (0 date-fallbacks)
[rsshub] interfax-world: 100 raw → 95 unique (0 date-fallbacks)
[rsshub] guardian-world: 100 raw → 99 unique (0 date-fallbacks)
[rsshub] npr-news: 100 raw → 98 unique (0 date-fallbacks)
[rsshub] france24-en: 100 raw → 96 unique (0 date-fallbacks)
[rsshub] total: 600 raw → 583 unique after dedup
[rsshub] written to data/basket/rsshub.json

Пример использования

Запуск:
bash

cd "/home/ta8_/Рабочий стол/Crucix"
node --env-file=.env scripts/collectors/collect-rsshub.mjs

Что произойдёт:

    Прочитает config/feeds.json.

    Скачает 6 фидов (если все доступны).

    Нормализует и дедуплицирует items.

    Запишет data/basket/rsshub.json.

    Выведет лог: сколько items с каждого фида.

Пример результата:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rsshub",
    "source": "collect-rsshub.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 583,
    "feeds_checked": 6,
    "errors_count": 0
  },
  "items": [
    {
      "feed_id": "tass-world",
      "source": "ТАСС",
      "group": "russian",
      "title": "Силы ПВО уничтожили три БПЛА",
      "link": "https://tass.ru/...",
      "normalized_link": "https://tass.ru/...",
      "guid": "https://tass.ru/...",
      "published_at": "2026-11-02T08:32:49.000Z",
      "date_missing": false,
      "date_format_fallback": false,
      "category": "general",
      "content": "...",
      "content_hash": "a1b2c3d4..."
    }
  ]
}

Практические рекомендации

    config/feeds.json — единственное место, где меняется список фидов. Не редактируйте сборщик для добавления нового источника.

    enabled: false — временное отключение фида. Не удаляйте фид из конфига: старые статьи останутся в корзине.

    Fallback-цепочка — если один фид падает, остальные продолжают. Проверяйте errors[] в логе.

    Таймаут 15 секунд — если фид не отвечает, он пропускается. Не увеличивайте: зависший фид вешает весь цикл.

    User-Agent — реалистичный Chrome-UA. Многие CDN отдают 403 на «ботский» UA.

    normalizeUrl() — обязательна. Без неё дедупликация по URL не работает.

    parseFlexibleDate() — обязательна. DD.MM.YYYY проверяется до нативного парсера.

    contentHash() — обязателен. Без него межсайтовые дубли не ловятся.

    DELETE FROM information_gaps перед пересборкой — метрика пересчитываемая.

    max_items_per_feed: 100 — защита от «залива» при первом запуске. Фид может отдать 5000 архивных записей — лимит обрезает.

    Логи — [rsshub] feed_id: N raw → M unique. Помогают понять, сколько items собрано с каждого фида.

    Ошибки — если фид регулярно падает, проверьте URL в браузере. Может быть блокировка (DNS, Cloudflare) или фид умер.

    Запускайте по расписанию (cron, раз в 15–30 минут). Не чаще: источники могут забанить.

    Проверяйте data/basket/rsshub.json после запуска. Если count: 0 — что-то сломалось.

Связанные модули

    scripts/collectors/lib/rss-collector.mjs — базовый класс.

    config/feeds.json — список фидов.

    scripts/utils/date-parser.mjs — нормализация дат.

    scripts/utils/string-similarity.js — дедупликация.

    apis/sources/articles-api.mjs — читает basket/rsshub.json.

    apis/sources/sources-api.mjs — читает basket/rsshub.json.

    apis/sources/rss-stats-api.mjs — читает basket/rsshub.json.

    scripts/analyzers/cluster-events.mjs — кластеризация после сбора.

    dashboard/public/dashboard-signals.html — отображает данные.
