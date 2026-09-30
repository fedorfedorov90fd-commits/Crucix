README-METRICS-MAP_ru.md
Файл: docs/help/ru/README-METRICS-MAP_ru.md
English: docs/help/en/README-METRICS-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Metrics Map

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

Функция applyChoropleth

Взаимодействие с Base Map

Связанные документы

1. Назначение Metrics Map
Metrics Map — карта метрик. Отображает количественные срезы по странам через закраску полигонов (choropleth). Значения метрик привязываются к странам и регионам, цвет заливки зависит от значения.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/

2. Роль в системе 5 карт
Metrics Map обрабатывает количественное измерение данных. Отвечает на вопрос сколько. Использует визуальные каналы position и size или color intensity для choropleth.

В системе 5 карт Crucix Metrics Map — одна из пяти специализированных карт. Наследуется от Base Map через паттерн Template Method.

3. Измерения данных
Metrics Map работает со следующими измерениями:

Количественное — значения метрик (инфляция, ВВП, безработица, индексы ESG, демография).

Пространственное — привязка метрик к странам через название страны.

Временное как атрибут — период метрики.

4. Визуальные каналы
Metrics Map использует попарно сепарабельные визуальные каналы:

Position — географическая позиция страны на карте.

Color intensity — насыщенность заливки по значению метрики. Формула: normalized = (value - min) / (max - min). Цвет интерполируется между зелёным (низкие значения) и красным (высокие).

Канал заливки (choropleth) — основной в Metrics Map.

5. Файловая структура карты
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/ содержит:

index.html — 179 строк, mapType='metrics'

js/layers-metrics.js — 85 строк

js/metrics-map.js — 69 строк

css/metrics-map.css — 39 строк

Итого 4 файла, 36 КБ, 372 строки.

6. Описание файлов
index.html — HTML страницы Metrics Map. Содержит задание window.CrucixMap = { mapType: 'metrics', name: 'Metrics Map', version: '1.0.0' } перед подключением скриптов. Подключает стили и скрипты Base Map и свои специализированные. Содержит кнопки map-switcher с активным Metrics Map. Не подключает heat-timeline.js и cii.js, потому что для метрик важнее choropleth, а не тепловая карта или CII.

js/layers-metrics.js — специализированный файл слоёв. Устанавливает window.CrucixMap.mapConfig с mapType='metrics', vizType='choropleth'. Содержит массив window.CrucixMap.metricsCoreIds — ядро метрических слоёв. Содержит функцию window.CrucixMap.metricsFilter, вызывающую window.getLayersForMap('metrics') из Base Map.

js/metrics-map.js — специализированная логика Metrics Map. Устанавливает window.CrucixMap.metricsHooks с функцией afterLayerLoad. Оборачивает window.loadLayer, чтобы после загрузки слоя с vizType='choropleth' вызвать window.applyChoropleth из map-controls.js Base Map. Оборачивает window.initMap, чтобы после инициализации автоматически загрузить первый choropleth-слой.

css/metrics-map.css — специализированные стили Metrics Map. Плавная заливка для choropleth (transition fill 0.5s), вертикальная шкала metrics-scale, стиль для значения метрики в попапе.

7. Значение mapType
Metrics Map использует window.CrucixMap.mapType = 'metrics'.

Это значение читается в js/layers.js Base Map внутри функции getLayersForMap(mapType). Возвращает массив слоёв, у которых vizType === 'choropleth'.

Это значение читается в js/init.js Base Map внутри функции loadData. Через window.getLayersForMap(mapType) получается отфильтрованный список слоёв.

Это значение подсвечивает активную кнопку в map-switcher в HTML.

8. Список слоёв
Metrics Map получает около 46 слоёв из общего реестра 195 слоёв Base Map. Все слои с vizType='choropleth'.

Ядро метрических слоёв в js/layers-metrics.js:

Экономика — inflation, unemployment, gdp, pmi, recession, trade-balance, fred, bls, comtrade, debt-gdp, consumer-confidence.

Финансы choropleth — dxy, tips, hy-spread, copper-gold, gold-oil, gold-silver, yield-curve, big-mac, big-mac-alt, big-mac-main, uranium.

ESG — esg, happiness, happiness-alt, population, refugees, urbanization, who, covid, healthcare, education, freedom, hdi, inequality, poverty, press-freedom.

Геополитика choropleth — social-unrest, corruption, democracy, country-instability, resilience-index.

Угрозы choropleth — cve-threat.

Здоровье choropleth — who-health, covid-health, healthcare-health.

Энергетика choropleth — eia, nuclear, renewable, oil-gas.

Кибер choropleth — cve-cyber.

Военный choropleth — military-spending, war-preparation.

Другие choropleth — internet, mobile.

Новости choropleth — google-trends.

Crucix choropleth — crucix-pattern-life, crucix-banking, crucix-population-flow, crucix-refugees, crucix-phone-activity.

Композитный — strategic-risk-composite.

9. Категории слоёв
Metrics Map включает слои всех категорий, у которых vizType='choropleth':

economics

finance

esg

geopolitical

threats

health

energy

cyber

military

other

news

intelligence

social

Главное условие — vizType='choropleth'. Категория вторична.

10. Поток данных при загрузке
Шаг 1. Пользователь открывает metrics-map/index.html.

Шаг 2. HTML выполняется: <script>window.CrucixMap = { mapType: 'metrics', name: 'Metrics Map', version: '1.0.0' }</script>.

Шаг 3. Загружается ../base-map/js/core.js — глобальные переменные.

Шаг 4. Загружается ../base-map/js/countries.js — 175 стран.

Шаг 5. Загружается ../base-map/js/layers.js — 195 слоёв, IIFE применяет фильтр по window.CrucixMap.mapType и получает 46 choropleth-слоёв.

Шаг 6. Загружается js/layers-metrics.js — устанавливает mapConfig с vizType='choropleth' и metricsCoreIds.

Шаг 7. Загружается ../base-map/js/layers-dynamic.js — дополняет слои из API.

Шаг 8. Загружается ../base-map/js/markers.js — override generateAllMarkers.

Шаг 9. Загружается ../base-map/js/map-controls.js — загрузка границ стран, applyChoropleth.

Шаг 10. Загружается ../base-map/js/copy-data.js?v=3.

Шаг 11. Загружается ../base-map/js/ssi.js — SSI и легенда.

Шаг 12. Загружается ../base-map/js/refresh.js.

Шаг 13. Загружается ../base-map/js/logger.mjs (module).

Шаг 14. Загружается js/metrics-map.js — override loadLayer для применения applyChoropleth.

Шаг 15. Загружается ../base-map/js/init.js — запускает карту.

Шаг 16. В loadData:

getFilteredLayers через getLayersForMap('metrics') возвращает 46 слоёв

renderLayerPanel(46) отрисовывает панель слоёв

generateAllMarkers генерирует маркеры (для choropleth-слоёв маркеров обычно нет)

loadCountryBoundaries загружает границы и подписи стран

applyChoropleth вызывается при клике на слой или автоматически при переключении

Шаг 17. Карта готова.

11. Фильтрация слоёв
Функция getLayersForMap('metrics') в js/layers.js Base Map фильтрует window.allLayers по правилу:

l.vizType === 'choropleth'

Если у слоя vizType='choropleth' — слой попадает в Metrics Map. Категория не важна, поэтому в Metrics Map попадают слои всех категорий, у которых заливка является основным способом отображения.

Слои с vizType='marker' не попадают в Metrics Map даже если их категория — economics или finance. Они попадают в Event Map.

12. Функция applyChoropleth
Функция window.applyChoropleth(data) определена в ../base-map/js/map-controls.js Base Map.

Входные данные: объект FeatureCollection или массив features, где каждая запись содержит название страны и значение метрики.

Логика закраски:

Шаг 1. Для каждой страны в GeoJSON-слое границ находится соответствующая запись по названию.

Шаг 2. Вычисляется минимум и максимум значений по всем странам.

Шаг 3. Нормализация значения: normalized = (value - min) / (max - min).

Шаг 4. Интерполяция цвета:

r = 34 + (255 - 34) * normalized

g = 205 - 180 * normalized

b = 80 - 70 * normalized

Шаг 5. Применение стиля: fillColor = rgb(r, g, b), fillOpacity = 0.75, color = '#ffffff', weight = 1.2.

Страны без данных получают серый цвет '#3a3a4a' с fillOpacity = 0.4.

После применения вызывается window.updateLegend() для обновления легенды.

13. Взаимодействие с Base Map
Metrics Map использует следующие компоненты Base Map:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount

../base-map/js/layers-dynamic.js — динамический адаптер

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries, applyChoropleth, resetChoropleth, COUNTRY_NAME_MAP

../base-map/js/copy-data.js — copyAllData

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js — startAutoRefresh, stopAutoRefresh

../base-map/js/init.js — initMap, loadData

Стили Base Map: core.css, header.css, layers-panel.css, map.css, responsive.css.

Не используются в Metrics Map: heat-timeline.js (нет тепловой карты), cii.js (нет панели CII).

14. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README Base Map: docs/help/ru/README-BASE-MAP_ru.md.

README других карт:

docs/help/ru/README-EVENT-MAP_ru.md

docs/help/ru/README-SEMANTIC-MAP_ru.md

docs/help/ru/README-NETWORK-MAP_ru.md

docs/help/ru/README-FORECAST-MAP_ru.md

Английские версии: docs/help/en/README-METRICS-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.
