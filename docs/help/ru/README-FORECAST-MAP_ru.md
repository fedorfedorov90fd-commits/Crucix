README-FORECAST-MAP_ru.md
Файл: docs/help/ru/README-FORECAST-MAP_ru.md
English: docs/help/en/README-FORECAST-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Forecast Map

Роль в системе 5 карт

Измерения данных

Визуальные каналы

Файловая структура карты

Описание файлов

Значение mapType

Список слоёв

Уровни вероятности

Поток данных при загрузке

Фильтрация слоёв

Вероятностные хуки

Взаимодействие с Base Map

Связанные документы

1. Назначение Forecast Map
Forecast Map — карта прогнозов. Отображает вероятностные прогнозы и сценарии: угрозы, аномалии, индекс напряжённости, предсказания кибератак, композитные стратегические риски. Каждое прогностическое событие — маркер с цветом, отражающим уровень вероятности.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/

2. Роль в системе 5 карт
Forecast Map обрабатывает прогностическое измерение данных. Отвечает на вопрос что будет. Использует визуальный канал color divergent по уровню вероятности.

В системе 5 карт Crucix Forecast Map — одна из пяти специализированных карт. Наследуется от Base Map через паттерн Template Method.

3. Измерения данных
Forecast Map работает со следующими измерениями:

Прогностическое — вероятности, сценарии, предсказания.

Пространственное — координаты прогностического события.

Временное как атрибут — дата прогноза, целевой горизонт.

Количественное как атрибут — значение вероятности от 0 до 100.

4. Визуальные каналы
Forecast Map использует попарно сепарабельные визуальные каналы:

Position — координаты прогностического маркера.

Color divergent — цвет маркера по уровню вероятности:

critical — до 100 процентов — #ff0040

high — от 60 до 80 — #ff4400

elevated — от 40 до 60 — #ff8800

medium — от 20 до 40 — #ffcc00

low — до 20 — #22c55e

Пульсация маркера — анимация по уровню вероятности через getPulseRadius.

Метка в попапе — вероятность, сценарий, регион, время.

5. Файловая структура карты
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/ содержит:

index.html — 179 строк, mapType='forecasts'

js/layers-forecasts.js — 72 строки

js/forecast-map.js — 77 строк

css/forecast-map.css — 76 строк

Итого 4 файла, 36 КБ, 404 строки.

6. Описание файлов
index.html — HTML страницы Forecast Map. Содержит задание window.CrucixMap = { mapType: 'forecasts', name: 'Forecast Map', version: '1.0.0' } перед подключением скриптов. Подключает стили и скрипты Base Map и свои специализированные. Содержит кнопки map-switcher с активным Forecast Map. Содержит сокращённую навигацию по дашбордам Угрозы, AI, Центр. Подключает heat-timeline.js, потому что тепловая карта важна для прогностической визуализации. Не подключает cii.js.

js/layers-forecasts.js — специализированный файл слоёв. Устанавливает window.CrucixMap.mapConfig с mapType='forecasts'. Содержит массив window.CrucixMap.forecastsCoreIds — ядро прогностических слоёв. Содержит объект window.CrucixMap.probabilityLevels с 5 уровнями вероятности (critical, high, elevated, medium, low). Содержит функцию window.CrucixMap.forecastsFilter, вызывающую window.getLayersForMap('forecasts').

js/forecast-map.js — специализированная логика Forecast Map. Устанавливает window.CrucixMap.forecastHooks с функциями:

getProbabilityLevel(value) — уровень вероятности по значению

getPulseRadius(value) — радиус пульсации маркера

buildPopup(props) — специфичный попап с вероятностью и сценарием

Оборачивает window.initMap для post-init проверки и опционального автовключения тепловой карты.

css/forecast-map.css — специализированные стили Forecast Map. Содержит анимацию forecast-pulse для пульсации маркеров по вероятности, стили 5 уровней вероятности, легенду вероятностей, стиль вероятности в попапе, стиль радиальных зон.

7. Значение mapType
Forecast Map использует window.CrucixMap.mapType = 'forecasts'.

Это значение читается в js/layers.js Base Map внутри функции getLayersForMap(mapType). Возвращает массив слоёв, у которых id входит в FORECAST_IDS, или категория 'threats', или id содержит 'forecast'.

Это значение читается в js/init.js Base Map внутри функции loadData. Через window.getLayersForMap(mapType) получается отфильтрованный список слоёв.

Это значение подсвечивает активную кнопку в map-switcher в HTML.

8. Список слоёв
Forecast Map получает около 12 слоёв из общего реестра 195 слоёв Base Map.

Ядро прогностических слоёв в js/layers-forecasts.js:

Прогностическое ядро — predict (прогноз атак), anomalies (аномалии), ssi (индекс напряжённости), intelligence (разведка как прогностический фактор).

Угрозы — cyber-attacks-threat, ddos-threat, malware-threat, phishing-threat, ransomware-threat, cve-threat, botnets-threat.

Композитный — strategic-risk-composite.

9. Уровни вероятности
Объект window.CrucixMap.probabilityLevels описывает 5 уровней вероятности:

critical — от 80 до 100 — цвет #ff0040 — метка Критический

high — от 60 до 80 — цвет #ff4400 — метка Высокий

elevated — от 40 до 60 — цвет #ff8800 — метка Повышенный

medium — от 20 до 40 — цвет #ffcc00 — метка Средний

low — от 0 до 20 — цвет #22c55e — метка Низкий

Функция getProbabilityLevel(value) возвращает объект уровня по значению. Функция getPulseRadius(value) возвращает радиус пульсации: 40 для критического, 30 для высокого, 22 для повышенного, 15 для среднего, 10 для низкого.

10. Поток данных при загрузке
Шаг 1. Пользователь открывает forecast-map/index.html.

Шаг 2. HTML выполняется: <script>window.CrucixMap = { mapType: 'forecasts', name: 'Forecast Map', version: '1.0.0' }</script>.

Шаг 3. Загружается ../base-map/js/core.js — глобальные переменные.

Шаг 4. Загружается ../base-map/js/countries.js — 175 стран.

Шаг 5. Загружается ../base-map/js/layers.js — 195 слоёв, IIFE применяет фильтр по window.CrucixMap.mapType='forecasts' и получает около 12 слоёв.

Шаг 6. Загружается js/layers-forecasts.js — устанавливает mapConfig с forecastsCoreIds и probabilityLevels.

Шаг 7. Загружается ../base-map/js/layers-dynamic.js.

Шаг 8. Загружается ../base-map/js/markers.js — override generateAllMarkers.

Шаг 9. Загружается ../base-map/js/map-controls.js — границы стран.

Шаг 10. Загружается ../base-map/js/copy-data.js?v=3.

Шаг 11. Загружается ../base-map/js/heat-timeline.js — тепловая карта, важная для прогностической визуализации.

Шаг 12. Загружается ../base-map/js/ssi.js.

Шаг 13. Загружается ../base-map/js/refresh.js.

Шаг 14. Загружается ../base-map/js/logger.mjs (module).

Шаг 15. Загружается js/forecast-map.js — устанавливает forecastHooks и оборачивает initMap.

Шаг 16. Загружается ../base-map/js/init.js — запускает карту.

Шаг 17. В loadData:

getFilteredLayers через getLayersForMap('forecasts') возвращает около 12 слоёв

renderLayerPanel(12) отрисовывает панель слоёв

generateAllMarkers генерирует маркеры только для видимых слоёв

updateMarkers отрисовывает маркеры с раскраской по вероятности

calculateSSI считает индекс напряжённости

loadCountryBoundaries загружает границы и подписи стран

Шаг 18. Карта готова.

11. Фильтрация слоёв
Функция getLayersForMap('forecasts') в js/layers.js Base Map фильтрует window.allLayers по правилу:

FORECAST_IDS.includes(l.id) || l.category === 'threats' || (l.id && l.id.includes('forecast'))

FORECAST_IDS определён как массив из 4 слоёв ядра: predict, anomalies, ssi, intelligence.

Если у слоя id входит в FORECAST_IDS, или категория='threats', или id содержит подстроку 'forecast' — слой попадает в Forecast Map.

Остальные угрозы в других картах (например, cyber-attacks-threat с vizType='marker') в Forecast Map тоже попадают, потому что их категория='threats'.

12. Вероятностные хуки
Функция window.CrucixMap.forecastHooks.getProbabilityLevel(value) возвращает уровень вероятности по числовому значению:

Шаг 1. Перебор по всем уровням из probabilityLevels.

Шаг 2. Если value в диапазоне [lvl.min, lvl.max) — возврат этого уровня с ключом.

Шаг 3. Если ни один уровень не подходит — возврат low.

Функция getPulseRadius(value) возвращает радиус пульсации для CSS-анимации:

больше или равно 80 — 40

больше или равно 60 — 30

больше или равно 40 — 22

больше или равно 20 — 15

меньше 20 — 10

Функция buildPopup(props) формирует HTML для попапа с полями:

label — название прогноза

value или probability — вероятность в процентах

уровень вероятности с цветом

region — регион

timestamp — время

scenario — сценарий развития

13. Взаимодействие с Base Map
Forecast Map использует следующие компоненты Base Map:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel

../base-map/js/layers-dynamic.js

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries

../base-map/js/copy-data.js — copyAllData

../base-map/js/heat-timeline.js — toggleHeat, toggleTimeline

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js

../base-map/js/init.js — initMap, loadData

Стили Base Map: core.css, header.css, layers-panel.css, map.css, responsive.css.

Не используется: cii.js — потому что прогностическая карта ориентирована на вероятности, а не на индекс нестабильности стран.

14. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README Base Map: docs/help/ru/README-BASE-MAP_ru.md.

README других карт:

docs/help/ru/README-EVENT-MAP_ru.md

docs/help/ru/README-METRICS-MAP_ru.md

docs/help/ru/README-SEMANTIC-MAP_ru.md

docs/help/ru/README-NETWORK-MAP_ru.md

Английские версии: docs/help/en/README-FORECAST-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.

Документ подготовлен как внутреннее архитектурное описание Forecast Map проекта Crucix. Все названия карт функциональны и не отсылают к продуктам конкурентов.

Все 6 файлов README на русском языке завершены:

README-5-MAPS_ru.md

README-BASE-MAP_ru.md

README-EVENT-MAP_ru.md

README-METRICS-MAP_ru.md

README-SEMANTIC-MAP_ru.md

README-NETWORK-MAP_ru.md

README-FORECAST-MAP_ru.md
