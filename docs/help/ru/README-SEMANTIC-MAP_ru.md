README-SEMANTIC-MAP_ru.md
Файл: docs/help/ru/README-SEMANTIC-MAP_ru.md
English: docs/help/en/README-SEMANTIC-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Semantic Map

Роль в системе 5 карт

Измерения данных

Визуальные каналы

Файловая структура карты

Описание файлов

Значение mapType

Список слоёв

Типы семантических сигналов

Поток данных при загрузке

Фильтрация слоёв

Раскраска по тональности

Взаимодействие с Base Map

Связанные документы

1. Назначение Semantic Map
Semantic Map — карта смыслов. Отображает текстовые данные из новостных источников и результаты их семантического анализа: темы, тональность, кластеры, ключевые сущности. Каждый маркер — отдельный текстовый источник, цвет маркера зависит от тональности текста.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/

2. Роль в системе 5 карт
Semantic Map обрабатывает семантическое измерение данных. Отвечает на вопрос что написано и как. Использует визуальный канал color categorical по тональности текста.

В системе 5 карт Crucix Semantic Map — одна из пяти специализированных карт. Наследуется от Base Map через паттерн Template Method.

3. Измерения данных
Semantic Map работает со следующими измерениями:

Семантическое — темы, ключевые сущности, тональность текста.

Пространственное — координаты источника новости (если заданы).

Временное — дата публикации.

Количественное как атрибут — значение тональности (число от -1 до 1) или категория (positive, negative, neutral, fake).

4. Визуальные каналы
Semantic Map использует попарно сепарабельные визуальные каналы:

Position — координаты источника на карте.

Color categorical — цвет маркера по тональности:

positive — зелёный #22c55e

negative — красный #ef4444

neutral — жёлтый #eab308

fake — фиолетовый #ff00ff

Метка в попапе — темы, сущности, источник, тональность.

5. Файловая структура карты
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/ содержит:

index.html — 170 строк, mapType='meanings'

js/layers-meanings.js — 56 строк

js/semantic-map.js — 70 строк

css/semantic-map.css — 42 строки

Итого 4 файла, 36 КБ, 338 строк.

6. Описание файлов
index.html — HTML страницы Semantic Map. Содержит задание window.CrucixMap = { mapType: 'meanings', name: 'Semantic Map', version: '1.0.0' } перед подключением скриптов. Подключает стили и скрипты Base Map и свои специализированные. Содержит кнопки map-switcher с активным Semantic Map. Содержит сокращённую навигацию только по новостным дашбордам.

js/layers-meanings.js — специализированный файл слоёв. Устанавливает window.CrucixMap.mapConfig с mapType='meanings'. Содержит массив window.CrucixMap.meaningsCoreIds — ядро семантических слоёв (текстовые новости и AI). Содержит объект window.CrucixMap.semanticTypes с типами семантических сигналов (topic, sentiment, entity, narrative, fake). Содержит функцию window.CrucixMap.meaningsFilter, вызывающую window.getLayersForMap('meanings').

js/semantic-map.js — специализированная логика Semantic Map. Устанавливает window.CrucixMap.semanticHooks с функциями:

getSentimentColor — цвет маркера по значению тональности

buildPopup — специфичный попап с темами, сущностями, источником, тональностью

Оборачивает window.initMap для post-init вывода в консоль количества видимых слоёв.

css/semantic-map.css — специализированные стили Semantic Map. Содержит стили маркеров по тональности (semantic-marker-positive, semantic-marker-negative, semantic-marker-neutral, semantic-marker-fake), легенду тем, стиль текста в попапе.

7. Значение mapType
Semantic Map использует window.CrucixMap.mapType = 'meanings'.

Это значение читается в js/layers.js Base Map внутри функции getLayersForMap(mapType). Возвращает массив слоёв, у которых id входит в SEMANTIC_IDS или категория ai.

Это значение читается в js/init.js Base Map внутри функции loadData. Через window.getLayersForMap(mapType) получается отфильтрованный список слоёв.

Это значение подсвечивает активную кнопку в map-switcher в HTML.

8. Список слоёв
Semantic Map получает около 10 слоёв из общего реестра 195 слоёв Base Map.

Ядро семантических слоёв в js/layers-meanings.js:

Новости текстовые — bbc, rss, tass, ria, interfax, gdelt-news, hackernews, mediacloud, reddit.

AI — intelligence.

Все эти слои дают текстовые данные, которые можно анализировать через NLP: тональность, темы, кластеры, ключевые сущности.

9. Типы семантических сигналов
Объект window.CrucixMap.semanticTypes описывает возможные семантические сигналы:

topic — тема — цвет #5bc0f8

sentiment — тональность — цвет #f59e0b

entity — сущность — цвет #aa44ff

narrative — нарратив — цвет #22c55e

fake — фейк — цвет #ef4444

Эти типы используются в будущих расширениях Semantic Map для расширенного NLP-анализа.

10. Поток данных при загрузке
Шаг 1. Пользователь открывает semantic-map/index.html.

Шаг 2. HTML выполняется: <script>window.CrucixMap = { mapType: 'meanings', name: 'Semantic Map', version: '1.0.0' }</script>.

Шаг 3. Загружается ../base-map/js/core.js — глобальные переменные.

Шаг 4. Загружается ../base-map/js/countries.js — 175 стран.

Шаг 5. Загружается ../base-map/js/layers.js — 195 слоёв, IIFE применяет фильтр и получает около 10 семантических слоёв.

Шаг 6. Загружается js/layers-meanings.js — устанавливает mapConfig с meaningsCoreIds и semanticTypes.

Шаг 7. Загружается ../base-map/js/layers-dynamic.js.

Шаг 8. Загружается ../base-map/js/markers.js — override generateAllMarkers.

Шаг 9. Загружается ../base-map/js/map-controls.js.

Шаг 10. Загружается ../base-map/js/copy-data.js?v=3.

Шаг 11. Загружается ../base-map/js/ssi.js.

Шаг 12. Загружается ../base-map/js/refresh.js.

Шаг 13. Загружается ../base-map/js/logger.mjs (module).

Шаг 14. Загружается js/semantic-map.js — устанавливает semanticHooks.

Шаг 15. Загружается ../base-map/js/init.js — запускает карту.

Шаг 16. В loadData:

getFilteredLayers возвращает около 10 семантических слоёв

renderLayerPanel(10) отрисовывает панель слоёв

generateAllMarkers генерирует маркеры для видимых слоёв

updateMarkers отрисовывает маркеры с раскраской по тональности

loadCountryBoundaries загружает границы и подписи стран

Шаг 17. Карта готова.

11. Фильтрация слоёв
Функция getLayersForMap('meanings') в js/layers.js Base Map фильтрует window.allLayers по правилу:

SEMANTIC_IDS.includes(l.id) || l.category === 'ai'

SEMANTIC_IDS определён как массив из 9 новостных источников: bbc, rss, tass, ria, interfax, gdelt-news, hackernews, mediacloud, reddit.

Если у слоя id входит в SEMANTIC_IDS или категория='ai' — слой попадает в Semantic Map.

Остальные новостные слои (например, google-trends с vizType='choropleth') в Semantic Map не попадают.

12. Раскраска по тональности
Функция window.CrucixMap.semanticHooks.getSentimentColor(sentiment) определяет цвет маркера:

Если sentiment — число:

больше 0.3 — зелёный #22c55e (позитив)

меньше -0.3 — красный #ef4444 (негатив)

в диапазоне от -0.3 до 0.3 — жёлтый #eab308 (нейтрал)

Если sentiment — строка, используется объект-словарь:

positive — зелёный

negative — красный

neutral — жёлтый

fake — фиолетовый

Функция используется при рендеринге маркеров для визуализации тональности текста.

13. Взаимодействие с Base Map
Semantic Map использует следующие компоненты Base Map:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel

../base-map/js/layers-dynamic.js

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries

../base-map/js/copy-data.js — copyAllData

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js

../base-map/js/init.js — initMap, loadData

Стили Base Map: core.css, header.css, layers-panel.css, map.css, responsive.css.

Не используются: heat-timeline.js, cii.js — потому что семантическая карта не использует тепловую карту и CII-индекс.

14. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README Base Map: docs/help/ru/README-BASE-MAP_ru.md.

README других карт:

docs/help/ru/README-EVENT-MAP_ru.md

docs/help/ru/README-METRICS-MAP_ru.md

docs/help/ru/README-NETWORK-MAP_ru.md

docs/help/ru/README-FORECAST-MAP_ru.md

Английские версии: docs/help/en/README-SEMANTIC-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.
