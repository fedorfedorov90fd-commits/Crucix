README-EVENT-MAP_ru.md
Файл: docs/help/ru/README-EVENT-MAP_ru.md
English: docs/help/en/README-EVENT-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Event Map

Роль в системе 5 карт

Измерения данных

Визуальные каналы

Файловая структура карты

Описание файлов

Значение mapType

Список слоёв

Категории слоёв

Поток данных при загрузке

Фильтрация слоёв

Взаимодействие с Base Map

Связанные документы

1. Назначение Event Map
Event Map — карта событий. Отображает точечные события с координатами и временем. Каждое событие — отдельный маркер на карте с попапом при клике.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/

2. Роль в системе 5 карт
Event Map обрабатывает пространственное и временное измерения данных. Отвечает на вопрос где и когда произошло событие. Использует только визуальный канал marker (кружки на карте).

В системе 5 карт Crucix Event Map — одна из пяти специализированных карт. Наследуется от Base Map через паттерн Template Method.

3. Измерения данных
Event Map работает со следующими измерениями:

Пространственное — координаты событий, географическая привязка.

Временное — дата и время события, хронология.

Количественное как атрибут — значение события (value), влияет на цвет и размер маркера.

Семантическое как атрибут — название события (label), регион (region).

4. Визуальные каналы
Event Map использует попарно сепарабельные визуальные каналы:

Position — координаты маркера на карте.

Color hue — цвет маркера по значению или статусу.

Размер маркера — по значению value: до 18 радиуса для критических, до 12 для обычных.

5. Файловая структура карты
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/ содержит:

index.html — 209 строк, mapType='events'

js/layers-events.js — 131 строка

js/event-map.js — 33 строки

css/event-map.css — 21 строка

Итого 4 файла, 44 КБ, 394 строки.

6. Описание файлов
index.html — HTML страницы Event Map. Содержит задание window.CrucixMap = { mapType: 'events', name: 'Event Map', version: '1.0.0' } перед подключением скриптов. Подключает стили и скрипты Base Map и свои специализированные. Содержит кнопки map-switcher с активным Event Map. Содержит элементы разметки: header topbar, nav nav-dashboards, layer-panel, map-container, legend, stats, ssi-panel, timeline-panel.

js/layers-events.js — специализированный файл слоёв. Устанавливает window.CrucixMap.mapConfig с mapType='events', списком категорий и vizType='marker'. Содержит массив window.CrucixMap.eventsCoreIds — ядро event-слоёв. Содержит функцию window.CrucixMap.eventsFilter, вызывающую window.getLayersForMap('events') из Base Map.

js/event-map.js — специализированная логика Event Map. Устанавливает window.CrucixMap.eventMapHooks с функцией afterInit. Оборачивает window.initMap, чтобы после инициализации карты вывести в консоль количество видимых слоёв.

css/event-map.css — специализированные стили Event Map. Минимальные, потому что основная визуализация — стандартные маркеры Base Map. Содержит анимацию event-marker-pulse и стиль event-map-legend-accent.

7. Значение mapType
Event Map использует window.CrucixMap.mapType = 'events'.

Это значение читается в js/layers.js Base Map внутри функции getLayersForMap(mapType). Возвращает массив слоёв, у которых vizType === 'marker' и категория входит в EVENT_CATEGORIES.

Это значение читается в js/init.js Base Map внутри функции loadData. Через window.getLayersForMap(mapType) получается отфильтрованный список слоёв, которые затем рендерятся в панели слоёв.

Это значение подсвечивает активную кнопку в map-switcher в HTML.

8. Список слоёв
Event Map получает около 103 слоёв из общего реестра 195 слоёв Base Map.

Ядро event-слоёв в js/layers-events.js:

Военный — military, conflict-zones, exercises, military-bases, military-exercises, notam, nuclear-monitor, gps-jamming.

Геополитика — geopolitical, acled, gdelt-geo, map-layer-social, map-layer-sanctions.

Кибер — cisa, shodan, github, cve, cyber-attacks, darkweb, ddos, malware, phishing, ransomware, botnets, cisa-cyber, map-layer-cyber.

Космос — space, aurora, oneweb, satellites, space-data, space-debris, starlink, spaceports.

Здоровье — health, who-health, covid-health, epidemics.

Энергетика — energy, energy-grid, pipelines, power-grid, oil-energy, map-layer-energy.

Транспорт — opensky, aviation, opensky-transport, ships, shipping-lanes, shipping-route, ports, ports-maritime, railways, highways, maritime.

Экология — usgs, weather, air-quality, climate, earthquakes, fires, firms, floods, forests, noaa, ocean, safecast, thermal, usgs-eco, viirs, agriculture, drought, volcanoes, wildfires.

Новости — hackernews, mediacloud, reddit, gdelt.

Инфраструктура — crucix-power-grid, crucix-pipelines, crucix-datacenters, crucix-undersea-cables, crucix-telecom, crucix-transport-hub, crucix-ports-infra, crucix-airports, crucix-water-systems, crucix-nuclear-facilities.

Разведка — crucix-radar, crucix-satellite-recon, crucix-sigint, crucix-humint, crucix-osint, crucix-imint, crucix-masint, crucix-geoint, crucix-electronic-warfare, crucix-drone-recon, crucix-communication-intercept.

Военный crucix — crucix-units, crucix-equipment, crucix-personnel, crucix-bases, crucix-movements, crucix-supply-lines, crucix-air-defense, crucix-naval, crucix-aviation-mil, crucix-missile, crucix-target-list.

Кибер crucix — crucix-cyber-nodes, crucix-cyber-links, crucix-cyber-attacks, crucix-cyber-infrastructure, crucix-cyber-anomalies, crucix-cyber-attribution, crucix-cyber-scan, crucix-cyber-darkweb.

Космос crucix — crucix-satellites, crucix-orbits, crucix-space-debris, crucix-space-launch, crucix-gps-jamming, crucix-space-weather.

Социальные crucix — crucix-social-unrest, crucix-border-crossings, crucix-media-narrative, crucix-earthquakes, crucix-fires, crucix-floods, crucix-anomalies-geo, crucix-weather.

9. Категории слоёв
Категории, попадающие в Event Map (EVENT_CATEGORIES в js/layers.js Base Map):

military

geopolitical

cyber

space

health

energy

transport

ecological

news

infrastructure

intelligence

threats

social

Слои с этими категориями и vizType='marker' входят в Event Map.

10. Поток данных при загрузке
Шаг 1. Пользователь открывает event-map/index.html.

Шаг 2. HTML выполняется: <script>window.CrucixMap = { mapType: 'events', name: 'Event Map', version: '1.0.0' }</script>.

Шаг 3. Загружается ../base-map/js/core.js — глобальные переменные, LANG_DATA, setLanguage, showNotification, openHelp.

Шаг 4. Загружается ../base-map/js/countries.js — 175 стран.

Шаг 5. Загружается ../base-map/js/layers.js — 195 слоёв в window.allLayers, определение функции getLayersForMap, IIFE применяет фильтр по window.CrucixMap.mapType и получает 103 слоя.

Шаг 6. Загружается js/layers-events.js — устанавливает mapConfig с категориями и eventsCoreIds с ядром event-слоёв.

Шаг 7. Загружается ../base-map/js/layers-dynamic.js — дополняет слои из /api/registry/layers.

Шаг 8. Загружается ../base-map/js/markers.js — override generateAllMarkers по window.CrucixMap.generateOnly.

Шаг 9. Загружается ../base-map/js/map-controls.js — загрузка границ стран, choropleth, applyChoropleth.

Шаг 10. Загружается ../base-map/js/copy-data.js?v=3 — копирование данных.

Шаг 11. Загружается ../base-map/js/heat-timeline.js — тепловая карта и хронология.

Шаг 12. Загружается ../base-map/js/ssi.js — SSI и легенда.

Шаг 13. Загружается ../base-map/js/refresh.js — автообновление.

Шаг 14. Загружается ../base-map/js/logger.mjs (type=module) — логирование.

Шаг 15. Загружается ../base-map/js/cii.js — CII-индекс.

Шаг 16. Загружается js/event-map.js — post-init hook.

Шаг 17. Загружается ../base-map/js/init.js — последний, запускает карту через DOMContentLoaded, вызывает initMap и loadData.

Шаг 18. В loadData:

getFilteredLayers через getLayersForMap('events') возвращает 103 слоя

renderLayerPanel(103) отрисовывает панель слоёв

window.CrucixMap.generateOnly = список 103 id

generateAllMarkers генерирует маркеры только для видимых слоёв

updateMarkers отрисовывает маркеры на карте

calculateSSI считает индекс напряжённости

loadCountryBoundaries загружает границы и подписи стран

Шаг 19. Карта готова.

11. Фильтрация слоёв
Функция getLayersForMap('events') в js/layers.js Base Map фильтрует window.allLayers по правилу:

l.vizType === 'marker' && EVENT_CATEGORIES.includes(l.category)

EVENT_CATEGORIES определён как массив из 13 категорий: military, geopolitical, cyber, space, health, energy, transport, ecological, news, infrastructure, intelligence, threats, social.

Если у слоя vizType 'marker' и категория входит в этот массив — слой попадает в Event Map.

Слои с vizType 'choropleth' не попадают в Event Map даже если их категория входит в EVENT_CATEGORIES. Они попадают в Metrics Map.

12. Взаимодействие с Base Map
Event Map использует следующие компоненты Base Map:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp, goToDashboard

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount, updateMapLayers

../base-map/js/layers-dynamic.js — динамический адаптер

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries, applyChoropleth, COUNTRY_NAME_MAP

../base-map/js/copy-data.js — copyAllData

../base-map/js/heat-timeline.js — toggleHeat, toggleTimeline

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js — startAutoRefresh, stopAutoRefresh

../base-map/js/cii.js — updateCII

../base-map/js/init.js — initMap, loadData

Стили Base Map: core.css, header.css, layers-panel.css, map.css, responsive.css.

CSS cii.css подключается в HTML Event Map для панели CII.

13. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README Base Map: docs/help/ru/README-BASE-MAP_ru.md.

README других карт:

docs/help/ru/README-METRICS-MAP_ru.md

docs/help/ru/README-SEMANTIC-MAP_ru.md

docs/help/ru/README-NETWORK-MAP_ru.md

docs/help/ru/README-FORECAST-MAP_ru.md

Английские версии: docs/help/en/README-EVENT-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.
