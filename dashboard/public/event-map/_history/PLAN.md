# Event Map — план капитального построения

Дата: 27.09.2026
Принцип: каждый файл — одна задача. Ноль конфликтов. Ноль объединений.

## Файловая структура (целевая)

event-map/
├── index.html               ← 40-60 строк, 3 script-тега
├── css/ (6 файлов)
│   ├── core.css            ← переменные, body, скроллбар
│   ├── header.css          ← топбар, навигация карт
│   ├── map.css             ← карта, легенда, статистика, SSI
│   ├── layers-panel.css    ← панель слоёв
│   ├── responsive.css      ← адаптив
│   └── notifications.css   ← toast
├── js/
│   ├── config.js           ← mapType, apiEndpoint, zoom, tileUrl
│   ├── core.js             ← i18n, showNotification, состояние карты
│   ├── countries.js        ← справочник стран
│   ├── layers.js           ← 84 реальных id event-map (генерён из реестра)
│   ├── layers-panel.js     ← рендер панели слоёв
│   ├── markers.js          ← точки Leaflet
│   ├── map-controls.js     ← границы, зум, подписи
│   ├── ssi.js              ← Strategic Severity Index
│   ├── heat-timeline.js    ← тепловая карта + хронология
│   ├── cii.js              ← Conflict Intensity Index
│   ├── copy-data.js        ← экспорт данных
│   ├── refresh.js          ← автообновление
│   ├── preset.js           ← пресеты слоёв
│   ├── renderer.js         ← маршрутизация marker vs choropleth
│   ├── logger.js           ← лог-панель
│   └── init.js             ← точка входа, порядок загрузки
├── _legacy/ (24 старых файла — архив)
└── _history/ (BUILD_LOG.md, PLAN.md — журнал создания)

## Порядок загрузки в index.html (критично)

1. config.js      — задаёт window.CrucixMap
2. core.js        — утилиты, i18n, state
3. countries.js   — данные стран
4. layers.js      — window.allLayers = 84 слоя
5. layers-panel.js — рендер панели (ждёт data-ready)
6. markers.js     — отрисовка точек
7. map-controls.js — границы
8. ssi.js / heat-timeline.js / cii.js / copy-data.js / refresh.js / preset.js / renderer.js / logger.js
9. init.js        — запускает Leaflet, вызывает renderLayerPanel

## События CustomEvent (контракт между модулями)

Каждый модуль шлёт и слушает события через document.dispatchEvent / addEventListener.
Никаких window.allLayers перезаписей. Никаких гонок.

- crucix:layers-loaded      — layers.js закончил загрузку
- crucix:panel-rendered     — layers-panel.js отрисовал
- crucix:marker-added       — markers.js добавил точку
- crucix:marker-removed     — markers.js убрал точку
- crucix:state-changed      — core.js обновил state

## Проверка после каждого файла

1. node --check <файл>                — синтаксис
2. wc -l <файл>                       — размер
3. grep по 3 маркерам                 — содержимое
4. Запись в _history/BUILD_LOG.md

## Что удаляется навсегда

- layers-dynamic.js — источник race condition (уже в _legacy/)
- maps-config.js — заменён справочником в core.js

## Что НЕ делаем

- Не объединять файлы
- Не универсализировать
- Не заталкивать логику на сервер
- Не использовать window.allLayers как общий транспорт (только чтение)

## ПРИНЦИП ИЗОЛЯЦИИ (утверждён 27.09.2026)

1. Каждая карта — самодостаточна. Никаких `../` ссылок между картами.
2. Все файлы карты (js, css, справочники) живут ВНУТРИ её папки.
3. Каждая карта имеет СВОЙ ЛИЧНЫЙ АРСЕНАЛ файлов. Не «дубли», а личный арсенал — собственный инструментарий, используемый строго одной картой.
4. Если у одной карты сломался файл — остальные не тронуты, продолжают работать.
5. Со временем карты разойдутся в специфике. Одинаковые сейчас имена файлов (formats-spatial.js) станут точнее (например, formats-spatial-markers.js у event-map vs formats-spatial-choropleth.js у metrics-map).
6. 6 измерений T/S/C/R/X + dispatcher — общая таксономия, но КОД в каждой карте свой.

### formats-*.js — личный арсенал event-map

6 файлов внутри event-map/js/:
- formats-timeseries.js — T (временные ряды)
- formats-spatial.js — S (точки, GeoJSON)
- formats-categorical.js — C (регионы, индексы по стране)
- formats-relational.js — R (графы связей)
- formats-textual.js — X (тексты, новости)
- formats-dispatch.js — dispatcher (вложенные структуры)

Каждый — ПЛОСКАЯ ТАБЛИЦА ПРАВИЛ (вариант A). Логика применения — в renderer.js.
