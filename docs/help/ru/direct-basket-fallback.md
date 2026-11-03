Файл: direct-basket-fallback.md
markdown

# Прямой читатель корзины: direct-basket-fallback.mjs

## Простое объяснение (для новичков)

Этот файл — «аварийный выход» для данных, которые по какой-то причине не попали в основной реестр API. Некоторые модули в системе исключены из карт (потому что они не геоданные), но при этом нужны на дашбордах. Этот файл читает их напрямую из «корзины» и отдаёт, обходя основной реестр.

**Что он делает:**

1. Принимает запрос вида `/api/layers/direct-basket/pmi`.
2. Идёт в папку `data/basket/`.
3. Находит файл `pmi.json`.
4. Читает его и отдаёт в формате JSON.

**Зачем это нужно:**

Некоторые API-модули (PMI, рецессия, крипто-страх, VXX, OVX, HY Spread, S&P/VIX, yield-curve) исключены из карт — они не геоданные. Но дашборды (`dashboard-5in1.html`) их вызывают. Без этого файла они получали бы `404`.

**Аналогия:**

Представьте, что в библиотеке есть основной каталог, но некоторые книги в него не внесены — потому что они не художественная литература. Чтобы их всё равно можно было взять, есть отдельный «прямой» доступ: вы идёте не в каталог, а прямо к полке. Этот файл — такой «прямой доступ».

---

## Научная база (для специалистов)

Модуль реализует паттерн **fallback-роутинг**: обход основного реестра (`registry.generated.json`) для модулей, которые исключены из слоёв через `LAYER_EXCLUDE_SET` в `build-registry.mjs`.

**Архитектура:**

- **`LAYER_EXCLUDE_SET`** — список модулей, которые не должны быть на картах (не геоданные). Включает: `pmi-api`, `recession-api`, `crypto-fear-api`, `hy-spread-api`, `ovx-api`, `sp500-vix-api`, `vxx-api`, `yield-curve-api`.
- **`direct-basket-fallback.mjs`** — не входит в `LAYER_EXCLUDE_SET` (это новый файл), поэтому регистрируется в реестре.
- **Поддержка двух форматов URL:**
  - `/api/layers/direct-basket/pmi` — прямой вызов.
  - `/api/pmi/` — через `LEGACY_ALIASES` в `router.mjs`.

**Маппинг:**

```javascript
const BASKET_MAP = {
  'pmi': 'pmi.json',
  'recession': 'recession.json',
  'crypto-fear': 'crypto-fear.json',
  'hy-spread': 'hy-spread.json',
  'ovx': 'ovx.json',
  'sp500-vix': 'sp500-vix.json',
  'vxx': 'vxx.json',
  'yield-curve': 'yield-curve.json',
};

Кеширование:

    _cache — Map с данными.

    CACHE_TTL = 60 * 1000 — 60 секунд.

    При повторном запросе в течение 60 секунд данные берутся из кеша.

Обработка путей:

    Если path начинается с /api/layers/direct-basket/ — отрезается префикс.

    Если path начинается с /api/ — отрезается /api.

    Убирается trailing slash.

    Разбивается на [name, sub].

Пример:

    /api/layers/direct-basket/pmi → name = 'pmi', sub = ''.

    /api/layers/direct-basket/pmi/stats → name = 'pmi', sub = 'stats'.

    /api/pmi/ → name = 'pmi', sub = ''.

Ограничения:

    Поддерживает только 8 модулей из BASKET_MAP. Для новых — добавьте в маппинг.

    Не поддерживает фильтры и сортировку (в отличие от articles-api.mjs).

    Не поддерживает пагинацию.

Как работает (пошагово)

    handler(req, res) принимает HTTP-запрос.

    Парсит url.pathname.

    Проверяет, начинается ли path с /api/layers/direct-basket/ или /api/.

    Отрезает префикс, убирает trailing slash.

    Разбивает на [name, sub].

    Если name нет в BASKET_MAP — возвращает 404 с списком доступных.

    Загружает файл из data/basket/{name}.json.

    Если файла нет — возвращает { error: 'not_found', name, file }.

    Если sub = 'status' — возвращает health-check.

    Если sub = 'stats' — возвращает агрегаты (количество записей, даты).

    Иначе — возвращает данные как есть.

Формат ответа для status:
json

{
  "status": "online",
  "count": 31,
  "source": "basket/pmi.json",
  "generated_at": "2026-11-02T08:35:00.000Z"
}

Формат ответа для stats:
json

{
  "stats": {
    "count": 31,
    "date_from": null,
    "date_to": null
  },
  "source": "basket/pmi.json"
}

Пример использования

Прямой вызов:
bash

curl "http://127.0.0.1:3117/api/layers/direct-basket/pmi"
curl "http://127.0.0.1:3117/api/layers/direct-basket/pmi/stats"
curl "http://127.0.0.1:3117/api/layers/direct-basket/yield-curve/status"

Через LEGACY_ALIASES:
bash

curl "http://127.0.0.1:3117/api/pmi/"
curl "http://127.0.0.1:3117/api/yield-curve/"

Что вернёт:
json

{
  "schema": "crucix.basket.v1",
  "meta": {
    "id": "pmi",
    "source": "ISM PMI (demo)",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "series": [
    { "date": "2026-10-01", "value": 52.3 },
    { "date": "2026-09-01", "value": 51.8 }
  ]
}

Практические рекомендации

    CACHE_TTL = 60 — 60 секунд. Не увеличивайте без необходимости: данные в корзине могут обновляться.

    Поддержка двух форматов URL — /api/layers/direct-basket/pmi и /api/pmi/. Это важно: роутер может использовать LEGACY_ALIASES для обратной совместимости.

    BASKET_MAP — добавьте новые модули, если они исключены из слоёв, но нужны на дашбордах.

    /status — health-check. Если файла нет, status = 'degraded'.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    Не удаляйте файлы из data/basket/ — они нужны для этого модуля.

    404 с списком доступных — если запрошен неизвестный name, возвращается { error: 'unknown_basket', name, available: [...] }. Это помогает отладке.

    error: 'not_found' — если файла нет. Не путать с 404: это 200 с полем error.

    conn.close() — не применимо (это JS, не Python). Но кеш очищается при перезапуске сервера.

    file — имя файла в корзине. Если файла нет, возвращается { error: 'not_found', name, file }.

    generated_at — время ответа. Полезно для отладки.

    schema — crucix.basket.v1. Стандарт для всех файлов в корзине.

Связанные модули

    server/build-registry.mjs — генерирует реестр, исключает модули из LAYER_EXCLUDE_SET.

    server/router.mjs — использует LEGACY_ALIASES для редиректа.

    apis/sources/direct-basket-fallback.mjs — этот файл.

    data/basket/*.json — данные для чтения.

    dashboard/public/dashboard-5in1.html — использует эти API.

    dashboard/public/widgets/real-chart.js — визуализирует данные.


