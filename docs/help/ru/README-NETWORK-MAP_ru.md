README-NETWORK-MAP_ru.md
Файл: docs/help/ru/README-NETWORK-MAP_ru.md
English: docs/help/en/README-NETWORK-MAP_en.md
Версия: 1.0
Дата: 27 сентября 2026
Статус: внутренний архитектурный документ

Оглавление
Назначение Network Map

Роль в системе 5 карт

Отличие от остальных четырёх карт

Измерения данных

Визуальные каналы

Файловая структура карты

Описание файлов

Значение mapType

Демонстрационные данные графа

Модуль GraphView

Модуль GraphPanel

Модуль relations

Поток данных при загрузке

Связанные документы

1. Назначение Network Map
Network Map — карта связей. Отображает граф сущностей: узлы и рёбра. Узлы — это сущности (страны, организации, персоны, события, кибератаки, санкции). Рёбра — это связи между сущностями (контроль, атака, атрибуция, участие, нахождение рядом). Каждая связь имеет тип и вес.

Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/

2. Роль в системе 5 карт
Network Map обрабатывает реляционное измерение данных. Отвечает на вопрос с кем связано и как. Использует визуальный канал position на плоскости force-directed графа и shape для типа узла.

В системе 5 карт Crucix Network Map — одна из пяти специализированных карт.

3. Отличие от остальных четырёх карт
Network Map — единственная карта, которая не использует Leaflet. Вместо географической карты используется Canvas-граф с силовым размещением узлов (force-directed layout).

В HTML вместо <div id="map"></div> используется <canvas id="graph-canvas"></canvas>.

В js не подключаются: ../base-map/js/layers-dynamic.js, ../base-map/js/markers.js, ../base-map/js/map-controls.js, ../base-map/js/copy-data.js, ../base-map/js/heat-timeline.js, ../base-map/js/cii.js, ../base-map/js/init.js.

Вместо init.js используется собственный js/network-map.js, который загружается как ES-модуль.

Не используются стили map.css, потому что нет Leaflet-карты. Используются core.css, header.css, layers-panel.css, responsive.css и собственный network-map.css.

4. Измерения данных
Network Map работает со следующими измерениями:

Реляционное — связи между сущностями, типы связей, веса.

Временное как атрибут — временные метки связей и событий.

Семантическое как атрибут — тип узла (country, organization, person, vessel, aircraft, event, facility, infrastructure, sanction, crypto_wallet, ip_address, domain, apt, cve, malware).

Количественное как атрибут — riskScore узла, credibility узла.

5. Визуальные каналы
Network Map использует попарно сепарабельные визуальные каналы:

Position — координаты узла на плоскости Canvas, определяются силовым алгоритмом.

Shape — форма узла (круг определённого радиуса).

Size — радиус узла по riskScore (minRadius плюс нормализованное значение riskScore).

Color — цвет узла по типу сущности. Всего 15 цветов в DEFAULT_COLORS.node.

Highlight — белая обводка при hover или selected.

Label — текстовая метка при zoom больше 1.4 или при hover.

6. Файловая структура карты
Каталог /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/ содержит:

index.html — 213 строк, mapType='relations'

js/network-map.js — 165 строк

js/layers-relations.js — 44 строки

js/graph-view.js — 414 строк

js/graph-panel.js — 208 строк

js/relations.js — 383 строки

css/network-map.css — 102 строки

Итого 7 файлов, 84 КБ, 1529 строк.

7. Описание файлов
index.html — HTML страницы Network Map. Задаёт window.CrucixMap = { mapType: 'relations', name: 'Network Map', version: '1.0.0' }. Подключает стили Base Map: core.css, header.css, layers-panel.css, responsive.css. Подключает собственный network-map.css. Не подключает Leaflet и большинство скриптов Base Map. Подключает только core.js, countries.js, layers.js, ssi.js, refresh.js. Подключает свой layers-relations.js. Загружает network-map.js как ES-модуль. Содержит кнопки map-switcher с активным Network Map. Содержит собственные кнопки: Перестроить граф, Подписи, Центр. Содержит <canvas id="graph-canvas"> вместо <div id="map">. Содержит боковую панель #side-panel для досье.

js/layers-relations.js — специализированный файл слоёв. Устанавливает window.CrucixMap.mapConfig с mapType='relations', флагами isGraph: true и usesCanvas: true. Содержит массив window.CrucixMap.relationsCoreIds — ядро слоёв связей (country-instability, resilience-index, strategic-risk-composite). Содержит функцию window.CrucixMap.relationsFilter.

js/network-map.js — главный модуль инициализации. Экспортирует async-функцию initNetworkMap. Внутри:

Импортирует GraphView из './graph-view.js'

Импортирует GraphPanel из './graph-panel.js'

Импортирует relationsModule из './relations.js'

Создаёт экземпляр GraphView с настройками (repulsion 10000, springLength 110, springStrength 0.025, damping 0.85, minRadius 5, maxRadius 20)

Создаёт экземпляр GraphPanel с containerId 'side-panel'

Подписывается на событие node:selected

Загружает данные через loadGraphData (сначала пытается API /api/layers/entity-graph/nodes, при неудаче использует DEMO_GRAPH)

Устанавливает данные через graphView.setData

Запускает анимацию graphView.start

Скрывает loading overlay

Экспортирует объект window.networkMap с методами refit, reload, rebuildGraph, clearGraph, toggleLabels

js/graph-view.js — класс GraphView. Force-directed рендеринг графа на Canvas. Не имеет внешних зависимостей. Собственный физический движок. Основные методы: init, setData, clear, start, stop, highlight, resetView, refit, getStats. Обрабатывает события мыши: hover, drag, pan, zoom, dblclick. Содержит объект DEFAULT_COLORS с цветами 15 типов узлов.

js/graph-panel.js — класс GraphPanel. Боковая панель досье выбранного узла. Работает с API /api/layers/entity-graph/node/{id}. Методы: init, show, hide, openNode. Рендерит досье с секциями: Идентификация, Оценка, Описание, Свойства, Связи, Координаты. Содержит кнопку Открыть на карте.

js/relations.js — модуль связей и графа. Строит связи между объектами по гео-правилам. Основные константы: OBJECT_TYPES с 40 типами объектов, LINK_TYPES с 10 типами связей. Функции: addNode, addLink, haversine, buildGraphFromLayers, showNodeLinks, loadLayerIntoGraph, rebuildGraph, setupGraphInteractions. Экспорт в window.relations.

css/network-map.css — специализированные стили Network Map. Стили graph-container, graph-canvas, боковой панели dossie, загрузочного overlay.

8. Значение mapType
Network Map использует window.CrucixMap.mapType = 'relations'.

Это значение читается в js/layers.js Base Map внутри функции getLayersForMap(mapType). Возвращает массив слоёв, у которых id входит в NETWORK_IDS.

Это значение используется в map-switcher для подсветки активной кнопки.

Значение 'relations' отличается от остальных: Network Map — единственная карта, у которой mapConfig имеет флаг isGraph: true и usesCanvas: true.

9. Демонстрационные данные графа
В js/network-map.js определён объект DEMO_GRAPH, который используется как fallback, если API /api/layers/entity-graph/nodes недоступен.

Состав DEMO_GRAPH.nodes (10 узлов):

usa — США — тип country — riskScore 45

rus — Россия — тип country — riskScore 78

chn — Китай — тип country — riskScore 52

eu — ЕС — тип organization — riskScore 38

nato — НАТО — тип organization — riskScore 42

un — ООН — тип organization — riskScore 25

sanctions_ofac — OFAC Sanctions — тип sanction — riskScore 65

conflict_ua — Конфликт в Украине — тип event — riskScore 88

apt28 — APT28 — тип apt — riskScore 82

cve_2024_1234 — CVE-2024-1234 — тип cve — riskScore 60

Состав DEMO_GRAPH.edges (12 рёбер):

usa → nato — тип controls — вес 3

usa → eu — тип linked_to — вес 2

rus → chn — тип linked_to — вес 2

eu → nato — тип part_of — вес 3

un → usa — тип linked_to — вес 1

un → rus — тип linked_to — вес 1

sanctions_ofac → rus — тип controls — вес 4

conflict_ua → rus — тип attacked_by — вес 5

conflict_ua → nato — тип linked_to — вес 3

apt28 → rus — тип attributed_to — вес 4

apt28 → usa — тип attacked_by — вес 3

cve_2024_1234 → apt28 — тип linked_to — вес 2

Демо-данные позволяют проверить работу графа до появления реального API.

10. Модуль GraphView
Класс GraphView экспортируется из js/graph-view.js.

Ключевые возможности:

Force-directed физика (repulsion, spring length, spring strength, damping)

Canvas 2D рендеринг

Автоматическое масштабирование под device pixel ratio

Управление мышью: hover, drag узлов, pan, zoom колесом, dblclick для центрирования

Метки узлов при zoom больше 1.4

Подсветка выбранного узла белой обводкой

refit — автоподгонка под все узлы

getStats — статистика графа

Экспорт:

export class GraphView

export function getGraphView(options)

export function resetGraphView()

События:

node:selected — вызывается при выборе узла кликом

node:hovered — вызывается при наведении

11. Модуль GraphPanel
Класс GraphPanel экспортируется из js/graph-panel.js.

Ключевые возможности:

Боковая панель досье узла

Метод openNode загружает данные через API /api/layers/entity-graph/node/{id}

Рендерит секции: Идентификация, Оценка, Описание, Свойства, Связи, Координаты

Кнопка Открыть на карте

Класс риска по riskScore: critical (больше 75), high (больше 50), elevated (больше 25), low

Экспорт:

export class GraphPanel

export function getGraphPanel(options)

export function resetGraphPanel()

12. Модуль relations
Модуль js/relations.js строит граф связей между объектами на основе гео-правил.

Константы:

OBJECT_TYPES — 40 типов объектов с полями type и label

LINK_TYPES — 10 типов связей с полями label, color, directed

Функции:

addNode(feature, layerId) — добавить узел в граф

addLink(sourceId, targetId, linkType, props) — добавить связь

haversine(lat1, lon1, lat2, lon2) — расстояние между точками в километрах

buildGraphFromLayers() — построить граф из активных слоёв по 4 правилам:

объект рядом со спутником/радаром/БПЛА в радиусе 500 км — monitored_by

ЦОД/инфра рядом с кибератакой в радиусе 200 км — attacked_by

база рядом с трубой/маршрутом в радиусе 100 км — supplied_by

любые разные объекты в радиусе 50 км — near (топ-5 ближайших)

showNodeLinks(nodeId) — нарисовать линии связей на карте и вернуть HTML для попапа

loadLayerIntoGraph(layerId) — загрузить слой в граф

rebuildGraph() — перестроить граф из window.activeLayerIds

setupGraphInteractions() — перехват клика по объекту

Экспорт в window.relations.

13. Поток данных при загрузке
Шаг 1. Пользователь открывает network-map/index.html.

Шаг 2. HTML задаёт window.CrucixMap = { mapType: 'relations', ... }.

Шаг 3. Загружается ../base-map/js/core.js.

Шаг 4. Загружается ../base-map/js/countries.js.

Шаг 5. Загружается ../base-map/js/layers.js — 195 слоёв, IIFE применяет фильтр по mapType='relations' и получает около 3 слоёв (composite).

Шаг 6. Загружается js/layers-relations.js — устанавливает mapConfig с isGraph: true, usesCanvas: true, relationsCoreIds.

Шаг 7. Загружается ../base-map/js/ssi.js.

Шаг 8. Загружается ../base-map/js/refresh.js.

Шаг 9. HTML вызывает <script type="module">import { initNetworkMap } from './js/network-map.js'; window.addEventListener('load', () => initNetworkMap());</script>.

Шаг 10. Внутри initNetworkMap:

создаётся GraphView с containerId 'graph-canvas', вызывается await graphView.init()

создаётся GraphPanel с containerId 'side-panel'

подписка на событие node:selected

loadGraphData: пытается /api/layers/entity-graph/nodes?limit=200, при неудаче возвращает DEMO_GRAPH

graphView.setData(data)

graphView.start()

updateStats(nodes, edges)

скрыть loading overlay

экспорт window.networkMap

Шаг 11. Карта готова. Пользователь может двигать узлы, приближать/отдалять, кликать для открытия досье.

14. Связанные документы
Общий обзор системы 5 карт: docs/help/ru/README-5-MAPS.md.

README Base Map: docs/help/ru/README-BASE-MAP_ru.md.

README других карт:

docs/help/ru/README-EVENT-MAP_ru.md

docs/help/ru/README-METRICS-MAP_ru.md

docs/help/ru/README-SEMANTIC-MAP_ru.md

docs/help/ru/README-FORECAST-MAP_ru.md

Английские версии: docs/help/en/README-NETWORK-MAP_en.md.

Общий индекс справок: docs/help/INDEX.md.

Реестр страниц: docs/help/pages.json.

Правила проекта: RULES.txt.
