# collect-rsshub

Назад к INDEX

Назначение

Сборщик RSS-лент через OPML-каталог. Читает data/feeds/feeds.opml, парсит ленты, дедуплицирует по id, обрезает до 500 записей, сохраняет через saveRaw.

Расположение

scripts/collectors/collect-rsshub.mjs

Экспорт

Функция collectAllFeeds().

Особенности реализации

Читает data/feeds/feeds.opml (43 ленты).

Парсит RSS через regex (тег item, тег outline).

Дедуплицирует по id (md5 от link или title).

Сортирует по pubDate DESC.

Обрезает до 500 записей (slice 0 до 500).

Сохраняет через saveRaw('rsshub', output, { backwardCompat: true }).

Флаг backwardCompat

Значение: true.

Последствие: каждая запись перезаписывает data/basket/rsshub.json целиком.

Симптом: при возврате 0 записей (все фиды упали по timeout или rate limit) basket-файл обнуляется до пустого объекта (около 129 байт).

Пример обнуления (26.09.2026):

16:55 — 658 КБ, 500 items.

17:28 — 129 байт, 0 items.

21:02 — 129 байт, 0 items.

Причина обнуления — вызов из scripts/snapshot-rsshub.mjs (каждый час через systemd timer crucix-rsshub-snapshot.timer).

Правило: backwardCompat: true нарушает правило 14.1 контракта v3. Целевой сборщик — collect-rss-unified.mjs с backwardCompat: false.

Зависимости

fs/promises, path, url, crypto.

./lib/collector-helper.mjs — saveRaw.

Данные: data/feeds/feeds.opml.

Связи

Используется: scripts/snapshot-rsshub.mjs (каждый час через systemd timer).

Пишет: data/raw/rsshub-ts.json, data/warehouse/incoming/today.json, data/basket/rsshub.json (при backwardCompat: true).

Читается: apis/sources/rss-feeds-api.mjs, scripts/analyzers/rss-convergence.mjs.

Архив: data/analytics/rss-history/rsshub-ts.json (через snapshot-rsshub.mjs).

Ограничения

Regex-парсер без обработки кодировки (windows-1251 даёт битые заголовки).

Лимит 500 записей.

Не использует circuit breaker из feeds-status.json.

Нет параллельной обработки фидов.

backwardCompat: true нарушает правило 14.1.

См. также

collector-helper.md — утилита saveRaw и флаг backwardCompat.

INDEX.md — центральный навигатор.
