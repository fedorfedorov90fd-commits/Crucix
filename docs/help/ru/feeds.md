Файл: feeds.md
markdown

# Конфигурация фидов: feeds.json

## Простое объяснение (для новичков)

Этот файл — «список источников» для RSS-сборщика. Он говорит системе: «Вот сюда ходи, вот это скачивай, вот эти новости собирай».

**Что внутри:**

```json
{
  "feeds": [
    {
      "id": "tass-world",
      "name": "ТАСС",
      "url": "https://tass.ru/rss/v2.xml",
      "group": "russian",
      "enabled": true
    },
    {
      "id": "guardian-world",
      "name": "The Guardian World",
      "url": "https://www.theguardian.com/world/rss",
      "group": "western",
      "enabled": true
    }
  ],
  "settings": {
    "max_items_per_feed": 100,
    "request_timeout_ms": 15000,
    "retry_attempts": 2,
    "retry_backoff_ms": 2000,
    "user_agent": "CrucixRSS/0.1 (+https://example.local/crucix)"
  }
}

Что означает каждое поле:

    id — уникальный идентификатор фида. Стабильный: не меняется при смене URL или имени.

    name — человекочитаемое имя (например, «ТАСС»).

    url — адрес RSS-ленты.

    group — группа источника: russian, western, neutral. Используется для сравнения нарративов.

    enabled — включён ли фид. false — фид пропускается при сборе.

    settings — глобальные настройки для всех фидов (таймауты, повторы, User-Agent, лимит).

Зачем это нужно:

Без этого файла сборщик не знает, откуда брать новости. Это «меню» для системы: какие источники включены, какие выключены, сколько статей с каждого брать.

Как менять:

Откройте файл в любом текстовом редакторе, добавьте новый фид в массив feeds, сохраните. Перезапуск не нужен — сборщик перечитывает конфиг при каждом запуске.
Научная база (для специалистов)

Конфигурационный файл задаёт параметры сбора данных для RSS-сборщика (collect-rss-unified.mjs). Это declarative configuration — данные описаны в JSON, а не в коде. Это позволяет менять состав источников без правки программы.

Структура:

feeds — массив объектов. Каждый объект — один фид. Поля:

    id (string) — стабильный идентификатор. Используется в БД (sources.feed_id), в API (/api/layers/sources), в дедупликации. Не меняйте без необходимости: на него ссылаются другие модули.

    name (string) — человекочитаемое имя. Используется в UI.

    url (string) — адрес RSS-ленты. Должен быть валидным URL. Поддерживаются http:// и https://.

    group (string) — группа источника: russian, western, neutral. Используется в contrast-engine.mjs для сравнения нарративов и в source-coordination-api.mjs для пар.

    enabled (boolean) — включён ли фид. Если false — фид пропускается при сборе, но остаётся в конфиге. Удобно для временного отключения.

settings — глобальные настройки:

    max_items_per_feed (number) — максимум items с одного фида. Защита от «залива» БД при первом запуске (когда фид отдаёт 5000 архивных записей). Рекомендуется 100.

    request_timeout_ms (number) — таймаут запроса в миллисекундах. 15000 = 15 секунд. Если фид не отвечает за это время — пропускается.

    retry_attempts (number) — число повторов при ошибке. 2 = до 3 попыток (первая + 2 повтора).

    retry_backoff_ms (number) — задержка между повторами. 2000 = 2 секунды. Экспоненциальная: 2с, 4с, 8с.

    user_agent (string) — User-Agent для запросов. Многие CDN (Cloudflare, Akamai) отдают 403 на «ботский» UA. Используйте реалистичный Chrome-UA.

Почему group — три значения:

    russian — российские источники (РИА, ТАСС, Интерфакс).

    western — западные источники (Guardian, NPR, France24).

    neutral — нейтральные (France24, Interfax).

Это разделение используется для сравнения нарративов: contrast-engine.mjs сравнивает russian vs western. Если группа не указана — источник попадает в neutral.

Ограничения:

    id должен быть уникальным. Дубликаты вызовут ошибку при загрузке.

    url должен быть валидным RSS. Если фид отдаёт JSON вместо XML — сборщик пропустит его с ошибкой.

    enabled: false — фид не собирается, но остаётся в конфиге. Это лучше, чем удалять: можно быстро включить обратно.

Как работает (пошагово)

    collect-rss-unified.mjs читает config/feeds.json.

    Парсит JSON, извлекает feeds и settings.

    Фильтрует фиды: только те, у которых enabled !== false.

    Для каждого фида вызывает fetchWithRetry() с настройками из settings.

    Если фид отдаёт ошибку — записывает в errors, продолжает со следующим.

    Собирает items, применяет дедупликацию, возвращает результат.

Что происходит при добавлении нового фида:

    Добавьте объект в массив feeds.

    Укажите id, name, url, group, enabled.

    Сохраните файл.

    При следующем запуске сборщик подхватит новый фид.

Что происходит при отключении фида:

    Установите enabled: false.

    Сохраните файл.

    При следующем запуске сборщик пропустит этот фид.

    Старые статьи останутся в БД (они не удаляются).

Пример использования

Текущий конфиг (6 фидов):
json

{
  "feeds": [
    {
      "id": "guardian-world",
      "name": "The Guardian World",
      "url": "https://www.theguardian.com/world/rss",
      "group": "western",
      "enabled": true
    },
    {
      "id": "npr-news",
      "name": "NPR News",
      "url": "https://feeds.npr.org/1001/rss.xml",
      "group": "western",
      "enabled": true
    },
    {
      "id": "france24-en",
      "name": "France 24 English",
      "url": "https://www.france24.com/en/rss",
      "group": "neutral",
      "enabled": true
    },
    {
      "id": "ria-world",
      "name": "РИА Новости",
      "url": "https://ria.ru/export/rss2/archive/index.xml",
      "group": "russian",
      "enabled": true
    },
    {
      "id": "tass-world",
      "name": "ТАСС",
      "url": "https://tass.ru/rss/v2.xml",
      "group": "russian",
      "enabled": true
    },
    {
      "id": "interfax-world",
      "name": "Интерфакс",
      "url": "https://www.interfax.ru/rss.asp",
      "group": "neutral",
      "enabled": true
    }
  ],
  "settings": {
    "max_items_per_feed": 100,
    "request_timeout_ms": 15000,
    "retry_attempts": 2,
    "retry_backoff_ms": 2000,
    "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CrucixRSS/0.1"
  }
}

Как добавить новый фид:
json

{
  "id": "aljazeera-all",
  "name": "Al Jazeera English",
  "url": "https://www.aljazeera.com/xml/rss/all.xml",
  "group": "neutral",
  "enabled": true
}

Как отключить фид:
json

{
  "id": "aljazeera-all",
  "enabled": false
}

Практические рекомендации

    id — стабильный. Не меняйте без необходимости: на него ссылаются sources.feed_id, API, дедупликация. Если фид переехал на новый URL — меняйте url, но id оставьте.

    group — три значения. russian, western, neutral. Если не уверены — neutral. Это влияет на сравнение нарративов.

    enabled: false — временное отключение. Не удаляйте фид из конфига: старые статьи останутся в БД, а фид можно быстро включить обратно.

    max_items_per_feed: 100 — защита от «залива» БД. При первом запуске фид может отдать 5000 архивных записей. Лимит обрезает до 100.

    request_timeout_ms: 15000 — 15 секунд. Если фид не отвечает — пропускается. Не ставьте больше 30 секунд: зависший фид вешает весь цикл.

    retry_attempts: 2 — до 3 попыток (первая + 2 повтора). Больше — лишняя нагрузка на источник.

    retry_backoff_ms: 2000 — 2 секунды. Экспоненциальная: 2с, 4с, 8с. Не ставьте меньше 1000: источник может забанить за частые запросы.

    user_agent — реалистичный Chrome-UA. Многие CDN (Cloudflare, Akamai) отдают 403 на «ботский» UA.

    Не используйте http:// — только https://. Некоторые источники перенаправляют, но лучше сразу указывать правильный протокол.

    Проверяйте URL перед добавлением. Откройте в браузере: если видите XML — это RSS. Если JSON — это не RSS, сборщик пропустит.

    Российские фиды часто в cp1251. Сборщик перекодирует в UTF-8. Если видите «кракозябры» — проверьте кодировку.

    Западные фиды могут быть заблокированы из РФ. Guardian, NPR, France24 — работают. BBC, DW, Reuters — могут не работать (DNS-блокировка). Проверяйте через curl перед добавлением.

    settings — глобальные. Нельзя задать разные настройки для разных фидов. Если нужны разные таймауты — придётся дублировать конфиг.

Связанные модули

    scripts/collectors/collect-rss-unified.mjs — читает конфиг, собирает данные.

    scripts/collectors/rss-to-db.mjs — записывает в БД, использует feed_id.

    apis/sources/sources-api.mjs — отдаёт список источников.

    apis/sources/articles-api.mjs — отдаёт статьи с feed_id.

    config/clustering.json — порог кластеризации (рядом).

    config/taxonomy.json — словарь понятий (рядом).

    db/migrations/004_seed_sources.sql — начальные источники в БД.

    db/migrations/007_sources_feed_id.sql — feed_id в таблице sources.


