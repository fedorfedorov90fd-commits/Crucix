# collector-helper

Назад к INDEX

Назначение

Утилита saveRaw — единственная точка записи сырья сборщиков в Crucix. Сохраняет данные в data/raw/, регистрирует накладную в data/warehouse/incoming/ и, при устаревшем флаге backwardCompat, дублирует запись в basket напрямую.

Расположение

scripts/collectors/lib/collector-helper.mjs

Экспорт

Функция saveRaw(id, data, options).

Методы, параметры, ответ

saveRaw(id, data, options)

Параметры:

id (string, обязательно) — идентификатор товара. Латиница, цифры, дефис.

data (any, обязательно) — сырые данные, сериализуются в JSON.

options (object, опционально):

collector — имя сборщика. По умолчанию collect-id.mjs.

source — название источника.

source_url — точный URL запроса.

license — лицензия (public-domain, cc-by, cc-zero).

format_hint — подсказка формата (timeseries, points, regions, events, hierarchical, catalog).

value_unit, value_type, value_scale — параметры значения.

period, granularity — период и гранулярность.

record_count — ожидаемое число записей.

backwardCompat (boolean, по умолчанию true) — писать ли в basket/id.json.

notes — свободное поле.

Возвращает: объект с полями raw_file, incoming_file, basket_file, checksum, bytes, id.

Флаг backwardCompat

Флаг backwardCompat управляет записью в basket напрямую.

backwardCompat: false (правильное значение):

Сборщик пишет только в data/raw/.

Регистрирует накладную в data/warehouse/incoming/.

Basket обновляется через кладовщика (scripts/warehouse/managerbasket.mjs) при нормализации.

Соответствует правилу 14.1 контракта v3: Сборщик в basket не пишет.

backwardCompat: true (устаревшее значение):

Сборщик пишет в data/raw/, накладную и напрямую в data/basket/id.json.

Перезаписывает basket-файл целиком при каждом запуске.

Нарушает правило 14.1.

Симптом: если сборщик вернул 0 записей — basket-файл обнуляется.

Архитектурный долг, оставленный для совместимости со сборщиками до контракта v3.

Правило: новые сборщики обязаны использовать backwardCompat: false. Существующие — миграция в плане.

Зависимости

fs/promises — работа с файлами.

crypto — sha256-хеш.

Внутренние: atomicWrite, nowIso, timestampSuffix, upsertItem.

Связи

Используется: все сборщики в scripts/collectors/collect-*.mjs (118 файлов).

Использует: файловую систему (data/raw/, data/warehouse/incoming/, data/basket/).

Обновляется параллельно: managerbasket.mjs (читает накладные, пишет basket).

Ограничения

Не валидирует data по схеме crucix.basket.v1 — валидация в validate.mjs.

Не проверяет соответствие record_count реальному количеству записей.

Не управляет tiered-политикой raw (fresh, working, archive) — это в кладовщике.

Пример

import saveRaw из ./lib/collector-helper.mjs.

const items = await fetchFromApi();

await saveRaw('my-collector', items, { collector: 'collect-my-collector.mjs', source: 'My API', source_url: 'https://api.example.com/v1/items', license: 'public-domain', format_hint: 'events', value_type: 'count', granularity: 'event', record_count: items.length, backwardCompat: false });

См. также

collect-rsshub.md — сборщик, использующий backwardCompat: true.

INDEX.md — центральный навигатор.
