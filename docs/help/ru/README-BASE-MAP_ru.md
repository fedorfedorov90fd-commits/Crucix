README-BASE-MAP_ru.md
Файл: docs/help/ru/README-BASE-MAP_ru.md
English: docs/help/en/README-BASE-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Base Map

Роль в системе 5 карт

Файловая структура

Описание файлов CSS

Описание файлов JavaScript

Описание данных

Порядок загрузки скриптов

Паттерн Template Method

Что наследуется, что специализируется

Список карт-наследников

Ключевые функции

Как добавить новую карту

Связанные документы

1. Назначение Base Map
Base Map — общий шаблон для всех 5 специализированных карт Crucix. Содержит инфраструктуру, которая одинакова для всех карт: инициализация Leaflet, загрузка данных, рендеринг панели слоёв, генерация маркеров, границы стран, SSI, легенда, автопереключение языка, система пресетов, логирование.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/base-map/

2. Роль в системе 5 карт
Каждая из 5 карт (Event Map, Metrics Map, Semantic Map, Network Map, Forecast Map) наследуется от Base Map. Различие между картами — только значение window.CrucixMap.mapType. Всё остальное — общая инфраструктура из Base Map.

Порядок загрузки в HTML каждой карты: Base Map подключается первым, специализированный скрипт layers-[mapType].js дополняет конфигурацию, [mapType]-map.js задаёт специфику, init.js запускает карту.

3. Файловая структура
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/base-map/ содержит:

index.html — 263 строки, шаблон с 5 кнопками-переключателями

index.html.origin — 403 строки, реальный geo-map.html, эталонная копия

css/core.css — 159 строк

css/header.css — 257 строк

css/layers-panel.css — 385 строк

css/map.css — 252 строки

css/responsive.css — 191 строка

css/cii.css — 111 строк

js/core.js — 119 строк

js/countries.js — 109 строк

js/layers.js — 785 строк

js/layers-dynamic.js — 203 строки

js/markers.js — 160 строк

js/map-controls.js — 389 строк

js/copy-data.js — 274 строки

js/heat-timeline.js — 101 строка

js/ssi.js — 69 строк

js/refresh.js — 90 строк

js/cii.js — 113 строк

js/init.js — 166 строк

js/logger.mjs — 676 строк

js/preset-multi-map.js — 257 строк

js/popups.mjs — 51 строка

js/news-markers.mjs — 33 строки

data/world.geojson — 252 КБ

Итого 25 файлов, 540 КБ, 5213 строк.

4. Описание файлов CSS
css/core.css — базовые стили: сброс, типографика, общие кнопки, бейджи, скроллбары, общие классы для всех страниц.

css/header.css — стили верхней панели topbar. Содержит стили кнопок базового блока: ← НА ГЛАВНУЮ, 📋 КОПИРОВАТЬ, 📡 Список страниц, ❓ HELP, 📋 Логи, 📊 CII, 🌡️ Тепловая, 📅 Хронология, 📄 PDF, переключатель RU/EN, блок refresh-inline. Правило №25 RULES.txt запрещает менять эти стили и тексты.

css/layers-panel.css — стили правой панели слоёв. Содержит стили навигации по дашбордам, заголовка панели, сетки слоёв, кнопок слоёв, поиска по слоям, категорий слоёв, кнопки сворачивания панели.

css/map.css — стили карты, легенды, статистики, панели SSI, хронологии, попапов Leaflet, границ стран, подписей стран.

css/responsive.css — стили адаптивности для экранов до 992, 768, 480 пикселей.

css/cii.css — стили панели CII (Country Instability Index), обновляемой из js/cii.js.

5. Описание файлов JavaScript
js/core.js — глобальные переменные, объект переводов window.LANG_DATA (RU/EN), функции setLanguage, updateLanguage, showNotification, openHelp, goToDashboard.

js/countries.js — массив 175 стран window.ALL_COUNTRIES с полями id, name, status, color, lat, lng.

js/layers.js — реестр 195 слоёв window.allLayers, функция getLayersForMap(mapType), функции renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount, updateMapLayers.

js/layers-dynamic.js — динамический адаптер слоёв, читает /api/registry/layers и дополняет window.allLayers недостающими записями.

js/markers.js — функции generateMarkersForLayer, generateAllMarkers, updateMarkers. Override generateAllMarkers использует window.CrucixMap.generateOnly для ограничения генерации только видимыми слоями.

js/map-controls.js — загрузка границ стран из world.geojson, подписи стран, choropleth, функции loadCountryBoundaries, applyChoropleth, resetChoropleth, объект COUNTRY_NAME_MAP.

js/copy-data.js — функция copyAllData, собирает полный снапшот страницы.

js/heat-timeline.js — функции toggleHeat, toggleTimeline, buildTimeline.

js/ssi.js — функции calculateSSI, updateLegend, расчёт Strategic Stress Index и обновление легенды.

js/refresh.js — функции startAutoRefresh, stopAutoRefresh, refreshMapData, updateTimerDisplay, formatInterval.

js/cii.js — функции updateCII, updateCIIPanel, updateCountryColors, updateLegend, getCIIColor.

js/init.js — главный файл запуска. Функции getFilteredLayers через getLayersForMap, loadData, initMap. В loadData происходит фильтрация window.allLayers по mapType через window.getLayersForMap, рендеринг панели слоёв, генерация маркеров, обновление SSI, загрузка границ стран.

js/logger.mjs — модуль логирования window.crucixLogger, панель логов, экспорт.

js/preset-multi-map.js — система пресетов. Сохранён по правилу #1070 RULES.txt как нерабочий, но потенциально полезный.

js/popups.mjs — модуль попапов для клика по карте, функция showRegionPopup.

js/news-markers.mjs — модуль маркеров новостей, функция addNewsMarkers.

6. Описание данных
data/world.geojson — файл границ стран, 252 КБ, используется функцией loadCountryBoundaries в js/map-controls.js.

Дополнительно в каталоге dashboard/public/ лежит world.geojson — 252 КБ, потому что функция loadCountryBoundaries делает запрос fetch('/world.geojson'), и путь должен указывать на корень отдачи статики.

7. Порядок загрузки скриптов
Скрипты подключаются в HTML каждой карты в следующем порядке:

<script>window.CrucixMap = { mapType: '...' }</script> — задание типа карты до всех остальных скриптов

../base-map/js/core.js

../base-map/js/countries.js

../base-map/js/layers.js

js/layers-[mapType].js — специализированный файл карты

../base-map/js/layers-dynamic.js

../base-map/js/markers.js

../base-map/js/map-controls.js

../base-map/js/copy-data.js?v=3

../base-map/js/heat-timeline.js

../base-map/js/ssi.js

../base-map/js/refresh.js

../base-map/js/logger.mjs — module

../base-map/js/cii.js

js/[mapType]-map.js — специализированная логика карты

../base-map/js/init.js — последний, запускает карту

Порядок нельзя менять, потому что window.CrucixMap должен быть установлен до layers.js, а init.js должен выполняться после всех модулей.

8. Паттерн Template Method
Base Map реализует паттерн Template Method из книги Design Patterns (Gamma et al., 1994). Скелет алгоритма (инициализация карты, загрузка данных, рендеринг панели слоёв, генерация маркеров) определён в Base Map. Шаги, которые должны отличаться у каждой карты (какие слои показывать, какой рендеринг маркеров, какие виджеты), определяются специализированными файлами.

Функция window.getLayersForMap(mapType) — точка расширения. Она определена в js/layers.js Base Map, но применяется по значению window.CrucixMap.mapType, установленному специализированной картой.

9. Что наследуется, что специализируется
От Base Map наследуются:

Проекция карты, механизм zoom, тайловый слой

Механизм фильтрации слоёв getLayersForMap

Рендеринг панели слоёв, toggle логика, поиск по слоям

Генерация маркеров, ограничение generateOnly

Границы стран, choropleth, подписи

SSI, CII, легенда

Копирование данных

Тепловая карта, хронология

Автообновление

Логирование

Переключатель языка RU/EN

Переключатель карт map-switcher

Все стили CSS

Специализируется в каждой карте:

Значение window.CrucixMap.mapType

Список coreIds в js/layers-[mapType].js

Дополнительные хуки в js/[mapType]-map.js

Специфические CSS в css/[mapType].css

Дополнительные элементы в HTML, если нужны

10. Список карт-наследников
Event Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/ — mapType 'events'

Metrics Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/ — mapType 'metrics'

Semantic Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/ — mapType 'meanings'

Network Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/ — mapType 'relations', без Leaflet

Forecast Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/ — mapType 'forecasts'

Каждая карта содержит:

index.html — задаёт window.CrucixMap.mapType, подключает скрипты

js/layers-[mapType].js — устанавливает window.CrucixMap.mapConfig и массив coreIds

js/[mapType]-map.js — специфические хуки

css/[mapType].css — специфические стили

11. Ключевые функции
window.getLayersForMap(mapType) — возвращает массив слоёв для указанного типа карты. Правила фильтрации:

events — vizType='marker' плюс EVENT_CATEGORIES, около 103 слоёв

metrics — vizType='choropleth', около 46 слоёв

meanings — SEMANTIC_IDS плюс category='ai', около 10 слоёв

relations — NETWORK_IDS, около 3 слоёв

forecasts — FORECAST_IDS плюс category='threats', около 12 слоёв

window.renderLayerPanel(layers) — рендеринг панели слоёв. Группирует по category, сортирует категории по количеству, создаёт кнопки слоёв.

window.loadLayer(layerId) — toggle логика. Если слой активен, выключает его и убирает с карты. Если не активен, добавляет. Загружает данные через fetch('/api/layers/${layerId}') в формате GeoJSON и добавляет через L.geoJSON.

window.generateAllMarkers() — override, использует window.CrucixMap.generateOnly для ограничения только видимыми слоями.

window.applyChoropleth(data) — закраска стран по значениям метрик.

window.calculateSSI() — расчёт Strategic Stress Index.

window.updateLegend() — обновление легенды, включая активные слои.

12. Как добавить новую карту
Шаг 1. Создать каталог новой карты в /home/ta8_/Рабочий стол/Crucix/dashboard/public/{new-map}/.

Шаг 2. Создать index.html на основе шаблона существующей карты. Изменить title, задать window.CrucixMap = { mapType: '{new-type}' }, изменить активную кнопку в map-switcher.

Шаг 3. Создать js/layers-{new-type}.js с window.CrucixMap.mapConfig и списком coreIds.

Шаг 4. Создать js/{new-map}.js со специфическими хуками.

Шаг 5. Создать css/{new-map}.css со специфическими стилями.

Шаг 6. В файле js/layers.js Base Map добавить правило фильтрации для нового mapType в функцию getLayersForMap.

Шаг 7. В HTML всех 5 существующих карт добавить ссылку на новую карту в map-switcher.

Шаг 8. Зарегистрировать новую карту в docs/help/pages.json.

Шаг 9. Создать справки docs/help/ru/README-{NEW-MAP}_ru.md и docs/help/en/README-{NEW-MAP}_en.md.

13. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README специализированных карт:

docs/help/ru/README-EVENT-MAP_ru.md

docs/help/ru/README-METRICS-MAP_ru.md

docs/help/ru/README-SEMANTIC-MAP_ru.md

docs/help/ru/README-NETWORK-MAP_ru.md

docs/help/ru/README-FORECAST-MAP_ru.md

Английские версии: docs/help/en/README-*-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.
