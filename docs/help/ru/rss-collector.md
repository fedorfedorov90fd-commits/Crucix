Файл: rss-collector.md

rss-collector.mjs (базовый класс всех RSS-сборщиков).


## Простое объяснение
Этот файл — «фундамент» для всех RSS-сборщиков системы. Он не собирает новости сам, но даёт готовый «каркас», который используют другие сборщики: `collect-rsshub.mjs`, `collect-rss-universal.mjs`, `collect-rss-extra.mjs` и все остальные.

**Что он делает:**
1. **Задаёт стандартную структуру сборщика** — что должен уметь каждый RSS-сборщик: скачивать, парсить, нормализовать, сохранять.
2. **Реализует общие методы** — fetch с таймаутом и retry, парсинг XML через `rss-parser`, нормализация URL и дат.
3. **Обрабатывает ошибки** — если фид упал, сборщик не падает целиком, а записывает ошибку и продолжает.
4. **Пишет в «корзину»** — стандартный формат `data/basket/<name>.json` с `schema: "crucix.basket.v1"`.

**Зачем это нужно:**
Без базового класса каждый сборщик был бы написан с нуля — с разными подходами к таймаутам, разными форматами данных, разной обработкой ошибок. Это привело бы к хаосу. Базовый класс задаёт единый стандарт: все сборщики работают одинаково, и их легко добавлять, заменять и отлаживать.

**Аналогия:**
Это как шаблон документа в Word. Вы не создаёте каждый раз новую структуру — вы открываете шаблон, где уже есть заголовки, поля, стили, и заполняете его своими данными. `rss-collector.mjs` — такой шаблон для RSS-сборщиков.

---

## Научная база
Модуль реализует **абстрактный базовый класс** (Abstract Base Class) для RSS-сборщиков, следующий паттерну **Template Method**.

**Архитектура:**

- **`BaseCollector`** — базовый класс с общими методами:
  - `constructor(name, options)` — инициализация с именем и настройками.
  - `fetch(url, options)` — HTTP-запрос с таймаутом, retry, User-Agent.
  - `parse(xml)` — парсинг XML через `rss-parser`.
  - `normalize(item)` — нормализация item (URL, дата, хеш).
  - `save(items)` — запись в `data/basket/<name>.json`.
  - `run()` — главный метод: fetch → parse → normalize → save.

- **Наследники** переопределяют только то, что им нужно:
  - `getFeeds()` — список фидов (URL и метаданные).
  - `getName()` — имя сборщика (используется в `basket/<name>.json`).
  - Опционально — `transform(item)` — дополнительная обработка item.

**Паттерн Template Method:**

`run()` — это «карказ» алгоритма. Он вызывает методы, которые наследники могут переопределить:

```javascript
async run() {
  const feeds = this.getFeeds();
  const allItems = [];
  const errors = [];

  for (const feed of feeds) {
    try {
      const xml = await this.fetch(feed.url);
      const parsed = await this.parse(xml);
      const items = parsed.items.map(i => this.normalize(i));
      allItems.push(...items);
    } catch (err) {
      errors.push({ feed: feed.id, error: err.message });
    }
  }

  await this.save(allItems);
  return { items: allItems, errors };
}

Это классический Template Method: структура алгоритма фиксирована, а конкретные шаги (список фидов, имя) — определяются наследниками.

Стандарт формата «корзины»:
Все сборщики пишут в единый формат crucix.basket.v1:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rsshub",
    "source": "collect-rsshub.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 500,
    "collector": "collect-rsshub.mjs"
  },
  "items": [...],
  "series": [],
  "points": [],
  "documents": []
}


Этот формат читают все API-модули (articles-api.mjs, sources-api.mjs, rss-stats-api.mjs). Единый стандарт = единый код чтения.

Обработка ошибок:
    На уровне фида: если один фид упал — остальные продолжают. Ошибка записывается в errors[].
    На уровне item: если item битый — пропускается, остальные идут.
    На уровне файла: если запись в корзину упала — сборщик возвращает ошибку, но не падает.

Ограничения:
    Не содержит бизнес-логики — только «скелет».
    Не кеширует — каждый запуск тянет фиды заново.
    Не дедуплицирует между фидами — это задача cluster-events.mjs.

Как работает (пошагово)
    Наследник (например, collect-rsshub.mjs) вызывает super('rsshub', options) в конструкторе.
    Наследник переопределяет getFeeds() — возвращает список фидов.
    Наследник вызывает this.run().

    run() проходит по фидам:

        this.fetch(feed.url) — HTTP-запрос с таймаутом, retry, UA.
        this.parse(xml) — парсинг через rss-parser.
        this.normalize(item) — нормализация (URL, дата, хеш).

    Собирает все items в массив.

    this.save(items) — запись в data/basket/rsshub.json с schema: "crucix.basket.v1".

    Возвращает { items, errors }.

Стандартные методы:
javascript

async fetch(url, options = {}) {
  const { timeout = 15000, retries = 2, backoff = 2000, userAgent = DEFAULT_UA } = options;
  // ... логика retry и timeout ...
}

async parse(xml) {
  const parser = new Parser({ timeout: 15000 });
  return await parser.parseString(xml);
}

normalize(item) {
  return {
    title: item.title || 'Без заголовка',
    link: item.link,
    normalized_link: normalizeUrl(item.link),
    published_at: parseFlexibleDate(item.pubDate).iso,
    source: item.source || 'Unknown',
    content: item.contentSnippet || '',
    content_hash: contentHash(item.title, item.contentSnippet),
  };
}

async save(items) {
  const payload = {
    schema: 'crucix.basket.v1',
    meta: {
      id: this.name,
      source: this.source,
      collected_at: new Date().toISOString(),
      count: items.length,
      collector: this.collector,
    },
    items,
    series: [],
    points: [],
    documents: [],
  };
  await mkdir(BASKET_DIR, { recursive: true });
  await writeFile(path.join(BASKET_DIR, `${this.name}.json`), JSON.stringify(payload, null, 2));
}

Пример использования

Наследник — простой RSS-сборщик:
javascript

import { BaseCollector } from './lib/rss-collector.mjs';

class RssHubCollector extends BaseCollector {
  constructor() {
    super('rsshub', { source: 'collect-rsshub.mjs' });
  }

  getFeeds() {
    return [
      { id: 'tass', url: 'https://tass.ru/rss/v2.xml', group: 'russian' },
      { id: 'guardian', url: 'https://www.theguardian.com/world/rss', group: 'western' }
    ];
  }
}

const collector = new RssHubCollector();
const { items, errors } = await collector.run();
console.log(`Собрано: ${items.length} items, ошибок: ${errors.length}`);

Что происходит:

    RssHubCollector наследует BaseCollector.

    Переопределяет getFeeds() — список из 2 фидов.

    Вызывает run() — базовый класс делает всё остальное.

    Результат: массив items + массив ошибок.

Формат data/basket/rsshub.json:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "rsshub",
    "source": "collect-rsshub.mjs",
    "collected_at": "2026-11-02T08:35:00.000Z",
    "count": 500
  },
  "items": [
    {
      "title": "Силы ПВО уничтожили три БПЛА",
      "link": "https://tass.ru/...",
      "normalized_link": "https://tass.ru/...",
      "published_at": "2026-11-02T08:32:49.000Z",
      "source": "ТАСС",
      "content": "...",
      "content_hash": "a1b2c3d4..."
    }
  ]
}

Практические рекомендации

    Не переопределяйте run() без необходимости. Если нужно изменить порядок шагов — используйте хуки (beforeFetch, afterParse), а не переписывайте run().

    getFeeds() — единственное, что обязательно переопределять. Возвращайте массив с полями id, url, group.

    normalize() — можно переопределить, если нужна дополнительная обработка. Но не удаляйте стандартные поля: на них ссылаются API-модули.

    save() — можно переопределить, если нужен другой формат. Но придерживайтесь crucix.basket.v1: его читают все API.

    fetch() — таймаут 15 секунд, до 2 повторов. Не увеличивайте без необходимости: зависший фид вешает весь цикл.

    User-Agent — реалистичный Chrome-UA. Многие CDN (Cloudflare, Akamai) отдают 403 на «ботский» UA.

    errors[] — не игнорируйте. Если фид падает регулярно — это сигнал: либо фид умер, либо блокировка.

    schema: "crucix.basket.v1" — обязательное поле. Без него API-модули не смогут прочитать файл.

    meta.id — имя сборщика. Используется в API (feed_id).

    meta.collected_at — время сбора. Используется для мониторинга «свежести».

    Не пишите в корзину напрямую из наследников. Используйте save(): это гарантирует правильный формат.

    parseFlexibleDate() — обязательная нормализация. Без неё даты будут в разных форматах.

    normalizeUrl() — обязательная нормализация. Без неё дедупликация по URL не работает.

    contentHash() — обязательный хеш. Без него межсайтовые дубли не ловятся.

    Для тестирования — создайте наследника с фиктивными фидами. Проверьте, что run() возвращает корректный результат.

Связанные модули

    scripts/collectors/lib/base-collector.mjs — родительский класс (если используется).

    scripts/collectors/lib/collector-helper.mjs — хелперы (если используются).

    scripts/collectors/collect-rsshub.mjs — наследник (главный сборщик).

    scripts/collectors/collect-rss-universal.mjs — наследник (универсальный сборщик).

    scripts/collectors/collect-rss-extra.mjs — наследник (дополнительные фиды).

    scripts/utils/date-parser.mjs — нормализация дат.

    scripts/utils/string-similarity.js — Jaccard, шинглы.

    apis/sources/articles-api.mjs — читает basket/rsshub.json.

    apis/sources/sources-api.mjs — читает basket/rsshub.json.

    apis/sources/rss-stats-api.mjs — читает basket/rsshub.json.
