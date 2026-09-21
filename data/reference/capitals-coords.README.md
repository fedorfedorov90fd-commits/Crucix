# Справочник координат столиц

Файл: `data/reference/capitals-coords.json`
Схема: `crucix.capitals.v1`
Версия справочника: 1.0.0
Дата создания: 2026-09-19

## Назначение

Единый справочник координат столиц и административных центров 250 стран и территорий мира. Используется потребителями (EPA, choropleth, региональные модели, timezone-логика) для получения точки столицы по коду ISO 3166-1 alpha-3.

## Структура файла

{
  schema: "crucix.capitals.v1",
  generated_at: "ISO-8601",
  source: "перечень источников",
  count: 250,
  stats: { wikidata, crucix_local, natural_earth, wikidata_territory, wikipedia, centroid, missing },
  capitals: {
    "RUS": {
      iso3, alpha2, name_en, name_ru, name_local,
      lat, lon, timezone, is_capital, note, source_coords
    }
  },
  indexes: { by_alpha2, by_name_lower }
}

## Поля записи

- iso3 — ISO 3166-1 alpha-3 (ключ).
- alpha2 — ISO 3166-1 alpha-2.
- name_en — английское название столицы.
- name_ru — русское название.
- name_local — локальное название (может быть null).
- lat, lon — координаты WGS84 (6+ знаков).
- timezone — IANA timezone (может быть неточен для стран с несколькими tz).
- is_capital — true.
- note — заметки (null у большинства).
- source_coords — источник координат: wikidata / crucix-local / natural-earth / wikidata-territory / wikipedia / centroid-fallback.

## Источники (5, приоритет сверху вниз)

1. **Wikidata SPARQL** (P298 iso3 → P36 capital → P625 coord) — 239 столиц.
2. **countries.json.capital** — 2 (HKG, MAC).
3. **Natural Earth ne_10m** (маппинг KOS→XKX, SAH→ESH) — 2 (XKX, ESH).
4. **Wikidata P625 территории** — 7 (UMI, BES, SJM, BVT, HMD, TKL, ATA).
5. **Wikipedia prop=coordinates** — 0 (не понадобился).

## Распределение

- wikidata: 239
- crucix_local: 2 (HKG, MAC)
- natural_earth: 2 (XKX, ESH)
- wikidata_territory: 7 (UMI, BES, SJM, BVT, HMD, TKL, ATA)
- wikipedia: 0
- centroid: 0
- missing: 0

## Индексы

- by_alpha2 — 249 записей (alpha2 → iso3).
- by_name_lower — 500 записей (name_en/name_ru/name_local → iso3, всё в нижнем регистре).

## Как обновлять

Генератор: `scripts/reference/build-capitals.mjs`
Запуск: `node scripts/reference/build-capitals.mjs`

Скрипт скачивает источники в `data/raw/reference/` (кэш с датой), собирает справочник, валидирует 250 записей, пишет результат. Все запросы без API-ключей (правило #39).

## Известные недоделки

Полный список — в `scripts/reference/build-capitals.TODO.md`.

Кратко:
1. timezone неточен для 20 стран с несколькими tz (RUS=Europe/Kirov вместо Europe/Moscow).
2. 7 территорий имеют координаты территории, а не столицы (у них нет столиц).
3. Проверка дубликатов устаревших кодов Wikidata не завершена вручную.
4. name_local заполнен не у всех.
5. Возможны другие особые случаи маппинга NE↔наши.

## Связанные файлы

- `data/reference/countries.json` — 250 стран с метаданными.
- `data/reference/subdivisions.json` — 102 административных единицы.
- `scripts/reference/build-capitals.mjs` — генератор.
- `scripts/reference/build-capitals.TODO.md` — список улучшений.
- `data/raw/reference/wikidata-capitals-YYYYMMDD.json` — кэш Wikidata.
- `data/raw/reference/ne_10m_populated_places-YYYYMMDD.geojson` — кэш Natural Earth.
- `data/raw/reference/dr5hn-countries-YYYYMMDD.json` — кэш dr5hn.

## Соглашения

- Все координаты WGS84.
- Все строки в name_* нормализованы (trim).
- Ключи capitals — всегда 3-буквенные iso3 (заглавные).
- Файл детерминирован: повторный запуск без изменений источников даёт идентичный файл.
