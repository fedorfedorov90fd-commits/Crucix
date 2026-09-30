# Event Map — история создания

Начат: 2026-09-27 10:43:54

## 27.09.2026 10:45 — Шаг 3: layers.js установлен

- Файл: event-map/js/layers.js
- Источник: /api/registry/layers?mapType=events
- Слоёв: 84
- Строк: 94
- Проверка: node --check → SYNTAX OK
- Содержимое: window.allLayers = [...] + CustomEvent crucix:layers-loaded
- НЕТ функций toggle/render/panel (они в отдельных файлах)
- Старые 24 файла в event-map/js/_legacy/ (архив)

## 27.09.2026 10:50 — Шаг 5: layers-panel.js установлен

- Файл: event-map/js/layers-panel.js
- Задача: рендер панели, toggle, поиск, enableAll/disableAll
- Слушает: crucix:layers-loaded
- Шлёт: crucix:panel-rendered, crucix:layer-toggled, crucix:layer-enabled, crucix:layer-disabled
- Экспорт в window: renderLayerPanel, toggleLayer, enableAllLayers, disableAllLayers, filterLayers, toggleLayerPanel
- Проверка: node --check → SYNTAX OK

## 27.09.2026 11:00 — Шаг 6: config.js установлен

- Файл: event-map/js/config.js
- Задача: определить window.CrucixMap (mapType, apiEndpoint, категории, vizTypes, тайлы, лимиты, features)
- Загружается ПЕРВЫМ
- Проверка: node --check → SYNTAX OK

## 27.09.2026 11:10 — Шаг 7: core.js установлен

- Файл: event-map/js/core.js
- Задача: i18n (t, setLanguage, LANG_DATA), глобальное состояние (window.CrucixState), уведомления (showNotification)
- Загружается ВТОРЫМ (после config.js)
- НЕ знает о карте, слоях, панели
- Экспорт в window: t, setLanguage, showNotification, LANG_DATA, currentLang (getter)
- Шлёт событие: crucix:lang-changed
- Проверка: node --check → SYNTAX OK

## 27.09.2026 11:10 — Шаг 7: core.js установлен

- Файл: event-map/js/core.js
- Задача: i18n (t, setLanguage, LANG_DATA), глобальное состояние (window.CrucixState), уведомления (showNotification)
- Загружается ВТОРЫМ (после config.js)
- НЕ знает о карте, слоях, панели
- Экспорт в window: t, setLanguage, showNotification, LANG_DATA, currentLang (getter)
- Шлёт событие: crucix:lang-changed
- Проверка: node --check → SYNTAX OK

## 27.09.2026 12:30 — Шаги 8-9: formats-registry.js + formats-spatial.js установлены

### formats-registry.js (118 строк)
- Реестр всех форматов OSINT по таксономии 5+1
- Разделы: A serverResponseFormats (8), B dimensions (6), C compositions (14), D nestingFormats (5), E sourceFormats (6), F coordinateFormats (6), G errorFormats (7)
- meta.observations — реальные факты по 8 слоям (acled 200, aviation 200, botnets 200, cii 503, earthquakes 500, currents 503, conflicts 404, cyber 500)
- Только данные. Не парсит, не хранит.
- Проверка: node --check → SYNTAX OK

### formats-spatial.js (74 строки)
- Справочник правил парсинга S (Space)
- _default: GeoJSON FeatureCollection, coordinates [lng, lat], extraFrom properties
- _array: fallback плоский массив
- _swapped: fallback [lat, lng]
- byLayer: пустой (все живые S-слои нормализованы сервером)
- Только правила парсинга. errorHandling и limits УБРАНЫ — они в renderer.js
- Проверка: node --check → SYNTAX OK


## 27.09.2026 12:35 — Шаг 10: layers.js перегенерирован с полем route

- Источник: /api/registry/layers?mapType=events
- Формат: { id, route, name, category, color, icon, vizType }
- route — для fetch /api/layers/<route> (без -api суффикса)
- id — для UI/toggle (moduleId)
- wildcard-дубли отфильтрованы
- Проверка: node --check → SYNTAX OK
- Причина: fetch('/api/layers/acled-api') → 404, правильный route = '/api/layers/acled'


## 27.09.2026 12:50 — Шаги 11-15: 5 форматов установлены

- formats-timeseries.js (58 строк) — T, VALUE_FIELDS из серверного timeseries.mjs
- formats-categorical.js (54 строки) — C, регионы + ISO3, choropleth
- formats-relational.js (46 строк) — R, NOT_IMPLEMENTED_SERVER_SIDE, заготовка
- formats-textual.js (46 строк) — X, NOT_IMPLEMENTED_SERVER_SIDE, заготовка
- formats-dispatch.js (54 строки) — dispatcher, UNWRAP_KEYS + detectors + routes + basketShapeMap
- Все 5: только данные, не код, логика в renderer.js
- Проверка: node --check → SYNTAX OK у всех 5

ИТОГО В event-map/js/ ФАЙЛОВ ФОРМАТОВ: 7
- formats-registry.js (реестр A-G)
- formats-spatial.js (S)
- formats-timeseries.js (T)
- formats-categorical.js (C)
- formats-relational.js (R)
- formats-textual.js (X)
- formats-dispatch.js (dispatcher)


## 27.09.2026 13:15 — Шаг 16: countries.js установлен

- Файл: event-map/js/countries.js
- Источник: data/reference/countries.json (фильтровано для event-map)
- Размер: 60781 байт (было 358447 в исходнике — в 5.9 раза меньше)
- Стран: 250
- Алиасов: 1037
- Индексы: by_alpha2, by_region_un, by_subregion_un, by_alias_lower
- Убрано: numeric, bbox, capital, languages, former_names, status, name_local
- Оставлено: iso3, alpha2, name_en, name_ru, lat, lon
- Проверка: node --check → SYNTAX OK
- Принцип: ЛИЧНЫЙ АРСЕНАЛ event-map (не ссылка на серверный файл)
- Обновление: вручную перегенерацией


## 27.09.2026 13:25 — Шаг 17: renderer.js установлен

- Файл: event-map/js/renderer.js
- Задача: применить правила formats-* к ответу сервера
- Не fetch. Не рисует. Не знает про Leaflet.
- Читает: FORMATS_REGISTRY, FORMATS_DISPATCH, FORMATS_SPATIAL, FORMATS_TIMESERIES, FORMATS_CATEGORICAL
- detectFormat: FeatureCollection → 'geojson-featurecollection'; basket.v1 + shape → 'crucix-basket-v1-*'; Array → 'flat-array'; wrapped → 'wrapped-array'
- getByPath: парсит пути типа 'geometry.coordinates[0]'
- parseSpatial (S), parseTimeseries (T), parseCategorical (C)
- renderLayerResponse(layerId, data): диспетчер — определяет dimension (S/T/C/R/X), применяет нужный парсер, возвращает {points, series, regions, documents, meta, dimension, format}
- Экспорт: window.CrucixRenderer = { detectFormat, renderLayerResponse, getByPath, firstOf }
- Проверка: node --check → SYNTAX OK (219 строк, 7 функций)


## 27.09.2026 13:35 — Шаг 18: markers.js установлен

- Файл: event-map/js/markers.js (181 строка, 12 функций/событий)
- Задача: рисовать точки Leaflet по данным слоя
- Слушает: crucix:layer-enabled, crucix:layer-disabled (шлёт layers-panel.js)
- Шлёт: crucix:marker-added, crucix:marker-removed
- fetchLayerData: fetch(layer.route) — по route, не по id (иначе 404)
- Читает ответ через window.CrucixRenderer.renderLayerResponse
- Рисует только если result.dimension === 'S' и points.length > 0
- L.circleMarker с popup (title, category, country, time, severity)
- Группа хранится в CrucixState.markersByLayer[layerId]
- Обработка ошибок: 404/503 → skip_silent; 500/4xx → skip_warn (notify через showNotification)
- Экспорт: window.CrucixMarkers = { drawPoints, removeLayer, fetchLayerData }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 13:45 — Шаг 19: map-controls.js установлен

- Файл: event-map/js/map-controls.js (170 строк, 8 функций/событий)
- Задача: Leaflet init, границы стран, подписи, choropleth
- initMap: L.map + L.tileLayer из window.CrucixMap
- loadBoundaries: world.geojson (177 фич), fallback на GitHub
- applyChoropleth: покраска стран по значению через CRUCIX_COUNTRIES
- resolveToIso3: ISO3 напрямую → by_alpha2 → by_alias_lower
- Слушает: crucix:choropleth-request
- Шлёт: crucix:map-ready, crucix:boundaries-loaded
- Экспорт: window.CrucixMapBase = { initMap, loadBoundaries, applyChoropleth, resolveToIso3 }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 13:55 — Шаг 20: ssi.js установлен

- Файл: event-map/js/ssi.js (122 строки, 9 функций/событий)
- Задача: Strategic Severity Index по активным слоям и маркерам
- Формула: baseSSI = min(50, layerScore*2) + intensitySSI = min(50, markerScore/20)
- Веса категорий: military 1.5, geopolitical 1.4, cyber/threats 1.3, intelligence 1.2, ecological 1.1, space/health/energy 1.0, infrastructure/social 0.9, transport 0.8, news 0.7, default 0.5
- Слушает: crucix:layer-toggled, crucix:marker-added, crucix:marker-removed
- Шлёт: crucix:ssi-updated
- Обновляет: #ssi-panel (видимый при SSI>0), #ssi-value, #ssi-fill (цвет по уровню)
- Экспорт: window.CrucixSSI = { calculateSSI, getSSI }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:05 — Шаг 21: heat-timeline.js установлен

- Файл: event-map/js/heat-timeline.js (145 строк, 8 функций/событий)
- Задача: две связанные фичи — тепловая карта + хронология
- Один файл — потому что данные одни (точки активных слоёв)
- collectActivePoints: собирает [lat, lng] из CrucixState.markersByLayer
- toggleHeat: L.heatLayer если подключен leaflet.heat, fallback — большие полупрозрачные круги
- toggleTimeline: группировка точек по дню, панель с горизонтальными барами
- Шлёт: crucix:heat-toggled, crucix:timeline-toggled
- Экспорт: window.CrucixHeatTimeline = { toggleHeat, toggleTimeline, collectActivePoints }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:15 — Шаг 22: cii.js установлен

- Файл: event-map/js/cii.js (119 строк, 9 функций/событий)
- Задача: Conflict Intensity Index по конфликтным слоям
- CONFLICT_CATEGORIES = ['military', 'geopolitical', 'threats', 'cyber']
- Формула: layerScore = min(40, conflictLayers*4) + markerScore = min(60, conflictMarkers/3.5)
- Отличие от SSI: НЕ fetch, считает по локальным маркерам
- Панель #cii-panel создаётся в этом файле (в HTML её нет)
- Слушает: crucix:layer-toggled, crucix:marker-added, crucix:marker-removed
- Шлёт: crucix:cii-updated
- Экспорт: window.CrucixCII = { toggleCII, updateCII, getCII }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:25 — Шаг 23: copy-data.js установлен

- Файл: event-map/js/copy-data.js (131 строка, 5 функций)
- Задача: экспорт в буфер обмена + скачивание .txt
- buildReport: mapType, time, всего/активных слоёв, SSI, CII, маркеры по слоям, активные слои
- copyAllData: navigator.clipboard с fallback через textarea + execCommand
- downloadReport: Blob + URL.createObjectURL + <a download>
- Экспорт: window.CrucixCopy = { copyAllData, downloadReport, buildReport }
- Алиас window.copyAllData (для onclick в HTML)
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:35 — Шаг 24: refresh.js установлен

- Файл: event-map/js/refresh.js (142 строки, 8 функций/совпадений)
- Задача: автообновление активных слоёв по таймеру
- Не fetch сам — использует CrucixMarkers.fetchLayerData + CrucixRenderer.renderLayerResponse + CrucixMarkers.drawPoints
- startAutoRefresh(seconds) + stopAutoRefresh + refreshAll + refreshLayer(layerId)
- Обновляет #refresh-timer (countdown)
- Алиасы для onclick: window.startAutoRefresh, window.stopAutoRefresh, window.refreshAll
- Экспорт: window.CrucixRefresh = { startAutoRefresh, stopAutoRefresh, refreshAll, refreshLayer, getInterval }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:45 — Шаг 25: preset.js установлен

- Файл: event-map/js/preset.js (157 строк, 13 функций/localStorage-совпадений)
- Задача: сохранение/загрузка наборов активных слоёв
- STORAGE_KEY = 'crucix-presets-event-map' (localStorage)
- saveCurrentAsPreset / applyPreset / deletePreset / listPresets / exportPreset / importPreset / getCurrentPreset
- applyPreset использует window.disableAllLayers + window.toggleLayer (экспорт из layers-panel.js)
- Экспорт: window.CrucixPresets = { saveCurrentAsPreset, applyPreset, deletePreset, listPresets, exportPreset, importPreset, getCurrentPreset }
- Проверка: node --check → SYNTAX OK


## 27.09.2026 14:55 — Шаг 26: logger.js установлен (22/22 — все файлы js/)

- Файл: event-map/js/logger.js (112 строк, 10 функций/событий)
- Задача: лог-панель (внутренняя консоль карты)
- MAX_LINES=200, toggleLogs() через кнопку LOGS
- createPanel / renderAll / addLine / log / warn / error
- Экспорт: window.CrucixLogger = { log, warn, error, toggleLogs, getLines, clear }
- Алиас window.toggleLogs
- Не перехватывает console.log глобально
- Проверка: node --check → SYNTAX OK

========================================
ИТОГО: 22 ИЗ 22 ФАЙЛОВ js/ ГОТОВЫ
========================================

Все файлы в event-map/js/:

ДАННЫЕ-СПРАВОЧНИКИ:
- config.js
- core.js
- countries.js
- layers.js
- formats-registry.js
- formats-spatial.js
- formats-timeseries.js
- formats-categorical.js
- formats-relational.js
- formats-textual.js
- formats-dispatch.js

ЛОГИКА-МОДУЛИ:
- layers-panel.js
- renderer.js
- markers.js
- map-controls.js
- ssi.js
- heat-timeline.js
- cii.js
- copy-data.js
- refresh.js
- preset.js
- logger.js

ОСТАЛОСЬ:
1. index.html — переписать (15 script-тегов → 22 новых + 3 CDN)
2. css/ — 6 файлов (проверить/дописать: core, header, map, layers-panel, responsive, cii)
3. Тест в браузере — открыть /event-map/, 84 слоя в панели, точки работают
4. Финальная запись — «event-map ГОТОВА под ноль»


## 27.09.2026 15:05 — Шаг 27: init.js установлен (23/23 — ВСЕ файлы js/ ГОТОВЫ)

- Файл: event-map/js/init.js (147 строк, 12 функций/событий)
- Задача: точка входа, порядок загрузки модулей, финальный запуск
- boot(): DOMContentLoaded → CrucixMapBase.initMap() → loadBoundaries() → waitForLayersLoaded() → renderLayerPanel() → setLanguage() → bindTopbarControls() → hideLoading() → setUpdateTime() → dispatch crucix:map-initialized
- Обработчики: #refresh-interval change → CrucixRefresh.startAutoRefresh, #refresh-now-btn click → CrucixRefresh.refreshAll, #layer-search input → filterLayers
- localStorage: crucix-refresh-event-map, crucix-lang-event-map
- Экспорт: window.CrucixInit = { boot }
- Проверка: node --check → SYNTAX OK

========================================
ИТОГО: 23 ИЗ 23 ФАЙЛОВ js/ ГОТОВЫ
========================================

ОСТАЛОСЬ:
1. Правка markers.js — добавить обновление #marker-count
2. Правка heat-timeline.js — использовать существующий #timeline-panel
3. Переписать index.html (15 script → 23 наших + 3 CDN, убрать inline-дубли)
4. Запустить сервер / перезапустить
5. Открыть /event-map/ → ввести в строй:
   - enableAllLayers() — включить все 84 слоя
   - проверить маркеры на карте
   - проверить SSI, CII, timeline, heat
   - зафиксировать результат в BUILD_LOG


## 27.09.2026 15:15 — Шаг 28: markers-count.js установлен (24/24 — доп. файл)

- Файл: event-map/js/markers-count.js (87 строк, 7 функций/событий)
- Задача: обновлять #marker-count и #countries-count
- Отдельный от markers.js (одна задача — один файл)
- countAllMarkers: общее число маркеров по активным слоям
- countCountries: уникальные страны (по country/countryCode/iso3/iso_a3)
- Слушает: crucix:marker-added, crucix:marker-removed, crucix:layer-toggled
- Экспорт: window.CrucixMarkersCount = { update, countAllMarkers, countCountries }
- Проверка: node --check → SYNTAX OK

========================================
ИТОГО: 24 ФАЙЛА js/ (23 базовых + markers-count)
========================================


## 27.09.2026 15:25 — Шаг 29: index.html переписан + heat-timeline.js v2

- heat-timeline.js v2 (169 строк, SYNTAX OK) — использует существующий #timeline-panel из HTML
- index.html старый (420 строк) — бэкап в _history/index.html.bak-YYYYMMDD-HHMMSS
- index.html новый (~205 строк) — 24 script-тега js/ + 4 CDN (leaflet, leaflet-heat, markercluster, html2canvas)
- Убрано: inline window.CrucixMap (дубль config.js), layers-dynamic.js, maps-config.js, logger.mjs, popups.mjs, news-markers.mjs, inline toggleLayerPanel/filterLayers/toggleHeat/toggleTimeline/initMap
- Добавлено: css/cii.css, #layer-grid (вместо #layer-list), #ssi-value (вместо #ssi-label), 24 script-тега с onclick через window.* (безопасно)
- Все onclick в HTML — через window.* (защита от гонок загрузки)


## 27.09.2026 15:35 — Шаги 30-31: copy-button.js + фикс map-controls.js

### Изоляция кнопки Копировать (шаг 30)
- Новый файл: event-map/js/copy-button.js — ИЗОЛИРОВАННАЯ кнопка
- Отдельно от copy-data.js (тот больше не трогаем)
- Экспорт window.CrucixCopyButton = {copy, download, buildText, bind}
- Алиасы window.copyAllData, window.downloadReport
- bind() вешает listener на #copy-btn, убирает onclick атрибут
- ПРАВИЛО: НИКОГДА не трогать copy-button.js после создания

### Фикс map-controls.js (шаг 31)
- Проблема: t.addLayer is not a function при bindTooltip для фичи без геометрии
- Фикс: layer.bindTooltip обёрнут в try/catch
- Проверка: node --check → SYNTAX OK


## 27.09.2026 16:05 — Шаг 32: кнопка Копировать — единый владелец

- Причина: два обработчика на #copy-btn (copy-data.js + copy-button.js)
- Фикс A: index.html — убран onclick у #copy-btn
- Фикс B: copy-data.js — window.copyAllData отключён (комментарий-заглушка)
- Фикс C: copy-button.js — bind() без cloneNode, __crucixBound guard, один addEventListener
- Владелец кнопки: ТОЛЬКО copy-button.js
- ПРАВИЛО: не трогать copy-button.js больше НИКОГДА

