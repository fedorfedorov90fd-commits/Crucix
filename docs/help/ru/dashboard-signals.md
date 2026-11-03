Файл: dashboard-signals.md
markdown

# Дашборд сигналов: dashboard-signals.html

## Простое объяснение (для новичков)

Этот файл — «главный экран» аналитика. На одной странице собраны все ключевые сигналы системы: алерты, частотные темы, распределение по группам, матрица источников, графики, карта, граф, последние статьи и таблица источников.

**Что на странице (9 секций):**

1. **Ticker** — бегущая строка с критическими алертами. Если что-то важное произошло — вы увидите это первым.
2. **Word Cloud** — облако частотных тем. Чем чаще тема упоминается, тем крупнее слово.
3. **Pie** — круговая диаграмма распределения статей по группам (`russian`, `western`, `neutral`).
4. **Source Matrix** — матрица «источник × тема». Видно, кто о чём пишет.
5. **Real Chart** — график распределения алертов по типам и серьёзности.
6. **RSS-Map** — карта с геолокациями новостей. Точки — события, цвет — группа.
7. **RSS-Graph** — граф связей между темами. Force-directed, узлы можно перетаскивать.
8. **Articles** — список последних 20 статей с цветными ярлыками групп.
9. **Sources Table** — таблица источников с количеством статей и временем последней публикации.

**Зачем это нужно:**

Аналитик открывает одну страницу и сразу видит полную картину: что происходит, кто пишет, о чём молчат, где синхронность. Не нужно переключаться между десятью вкладками. Это «приборная панель» всей системы.

**Аналогия:**

Это как приборная панель в самолёте. Все ключевые индикаторы — на одном экране. Пилот не должен бегать по кабине, чтобы проверить каждый прибор. Один взгляд — и понятно, что происходит.

---

## Научная база (для специалистов)

Дашборд реализует паттерн **single-page dashboard** с девятью независимыми виджетами, собранными в единый интерфейс. Каждый виджет — изолированный модуль ES6, который делает свой `fetch` и рендерит свою часть страницы. Ошибка в одном виджете не ломает остальные.

**Архитектура:**

- **Статический HTML** — без серверного рендеринга. Открывается локально в браузере.
- **CSS Grid** — `grid-template-columns: 1fr 1fr` и `grid-template-columns: repeat(3, 1fr)` для сетки. Адаптивность через `@media (max-width: 992px)` — одна колонка на узких экранах.
- **Тёмная тема** — `background: #0a0a1a`. Стандарт для профессиональных терминалов, снижает нагрузку на глаза при длительной работе.
- **Фиксированные панели** — `topbar` (верхняя панель) и `nav-dashboards` (навигация). `position: fixed` — чтобы не исчезали при скролле.
- **Модули ES6** — каждый виджет подключается через `<script type="module">`. Это обеспечивает изоляцию: переменные одного виджета не конфликтуют с другим.

**Виджеты и их источники данных:**

1. **`ticker.js`** — `GET /api/layers/alerts?severity=high` — критические алерты. Бегущая строка с деталями.
2. **`wordcloud.js`** — `GET /api/layers/articles?limit=500` — частотные темы. Слова масштабируются по частоте.
3. **`pie.js`** — `GET /api/layers/articles/stats` — распределение по группам (`russian`, `western`, `neutral`).
4. **`source-matrix.js`** — `GET /api/layers/sources` + `GET /api/layers/articles` — матрица «источник × тема».
5. **`real-chart.js`** — `GET /api/layers/alerts/stats` — график алертов по типам и серьёзности.
6. **`rss-map.js`** — `GET /api/layers/articles?limit=500` — карта с геолокациями. Leaflet.
7. **`rss-graph.js`** — `GET /api/layers/articles?limit=500` — граф связей. D3.js force-directed.
8. **`articles.js`** — `GET /api/layers/articles?limit=20` — список последних статей.
9. **`sources-table.js`** — `GET /api/layers/sources` — таблица источников.

**Ключевые архитектурные решения:**

- **API и static на одном порту** — CORS не нужен. Деплой тривиален.
- **`@fastify/static@7`** — не 8, потому что Fastify 4.x несовместим с v8 (`FST_ERR_PLUGIN_VERSION_MISMATCH`).
- **API-routes регистрируются до static** — иначе `/stats` может перекрыться файлом.
- **`decorateReply: false`** в fastify-static — иначе конфликт с другими плагинами.
- **`widgets/_template.html`** — заглушка для адаптации под основной шаблон (1091 строка).
- **Интерпретация в виджетах** — если `russian×western=0`, виджет объясняет «два информационных мира», а не просто показывает пустой угол.

**Ограничения:**

- При большом количестве виджетов страница может тормозить. Ленивая загрузка через `IntersectionObserver` — решение.
- Виджеты не синхронизированы: каждый делает свой `fetch`. Если API медленный — страница грузится долго.
- Тёмная тема — не для всех. Для светлой темы — переопределите CSS-переменные.
- `limit=500` — компромисс между полнотой и скоростью. Больше — тормозит рендеринг.

---

## Как работает (пошагово)

1. Страница загружается в браузере.
2. Подключаются стили (тёмная тема).
3. Подключаются библиотеки: Leaflet (карты), Plotly (графики), D3 (графы).
4. Рендерится `topbar` — верхняя панель с кнопками «← НА ГЛАВНУЮ», «📡 Реестр», «❓ HELP».
5. Рендерится `nav-dashboards` — список дашбордов (Центр аналитики, Сигналы, Новости, Экономика, Финансы, Военный, Геополитика, Кибер, AI).
6. Загружаются виджеты (каждый делает свой `fetch`).
7. Каждый виджет обрабатывает ошибки: если API недоступен — показывает сообщение, страница продолжает работать.
8. При ошибке в одном виджете — остальные продолжают работать.

**Структура HTML (сокращённо):**

```html
<header class="topbar">...</header>
<nav class="nav-dashboards">...</nav>
<main class="main-content">
  <div class="page-title">🚨 Сигналы — все анализаторы на одной странице</div>
  <div class="page-subtitle">silence + taxonomy-gaps + narrative-framing + alerts + articles + sources</div>
  <div class="section-title">1. Ticker — критические алерты</div>
  <div id="ticker"></div>
  <div class="grid-2">
    <div>
      <div class="section-title">2. Word Cloud — частотные темы</div>
      <div id="wordcloud"></div>
    </div>
    <div>
      <div class="section-title">3. Pie — распределение по типам</div>
      <div id="pie"></div>
    </div>
  </div>
  <div class="section-title">4. Source Matrix — сравнение тем</div>
  <div id="source-matrix"></div>
  <div class="section-title">5. Real Chart — распределение алертов</div>
  <div id="real-chart"></div>
  <div class="section-title">6. RSS-Map — география тем</div>
  <div id="rss-map"></div>
  <div class="section-title">7. RSS-Graph — связи тем</div>
  <div id="rss-graph"></div>
  <div class="section-title">8. Articles — последние 20 статей</div>
  <div id="articles"></div>
  <div class="section-title">9. Sources Table — источники</div>
  <div id="sources-table"></div>
</main>
<script type="module" src="/widgets/ticker.js"></script>
<script type="module" src="/widgets/wordcloud.js"></script>
<script type="module" src="/widgets/pie.js"></script>
<script type="module" src="/widgets/source-matrix.js"></script>
<script type="module" src="/widgets/real-chart.js"></script>
<script type="module" src="/widgets/rss-map.js"></script>
<script type="module" src="/widgets/rss-graph.js"></script>
<script type="module" src="/widgets/articles.js"></script>
<script type="module" src="/widgets/sources-table.js"></script>

Пример использования

Открыть страницу:
text

http://127.0.0.1:3117/dashboard-signals

Что появится:

    Верхняя панель с кнопками навигации.

    Навигация по дашбордам.

    Заголовок «🚨 Сигналы — все анализаторы на одной странице».

    9 секций с виджетами.

Что можно делать:

    Кликнуть на тикер — увидеть детали алерта.

    Навести на слово в облаке — увидеть частоту.

    Кликнуть на точку на карте — увидеть заголовок новости.

    Перетащить узел в графе — распутать сложный участок.

    Отсортировать таблицу источников по количеству статей.

    Перейти на другой дашборд через навигацию.

Пример запроса к API, который использует виджет:
bash

curl "http://127.0.0.1:3117/api/layers/alerts?severity=high"
curl "http://127.0.0.1:3117/api/layers/articles?limit=20"
curl "http://127.0.0.1:3117/api/layers/sources"

Практические рекомендации

    grid-2 и grid-3 — адаптивная сетка. При ширине < 992px — одна колонка. Не забудьте @media.

    Фиксированные панели — position: fixed. При скролле остаются на месте. Это важно для длинных дашбордов.

    Модули ES6 — <script type="module">. Не используйте <script> без type="module" — не будет изоляции.

    API и static на одном порту — CORS не нужен. Деплой тривиален.

    @fastify/static@7 — не 8. Fastify 4.x несовместим с v8.

    API-routes регистрируются до static — иначе /stats может перекрыться файлом.

    decorateReply: false в fastify-static — иначе конфликт с другими плагинами.

    Ленивая загрузка — если виджетов много, используйте IntersectionObserver. Иначе страница тормозит.

    Fallback на ошибки — каждый виджет обрабатывает ошибки fetch. Страница не падает, если один API недоступен.

    limit=500 — для wordcloud, rss-map, rss-graph нужно много данных. Не уменьшайте без необходимости.

    Тёмная тема — background: #0a0a1a. Стандарт для профессиональных терминалов.

    d3.min.js локально — dashboard/public/lib/d3.min.js. Не используйте CDN — может быть заблокирован.

    Leaflet и Plotly — подключены через CDN (unpkg.com, cdn.plot.ly). Если они недоступны — виджеты, которые их используют, покажут ошибку. Остальные работают.

    page-subtitle — краткое описание страницы. Полезно для новых пользователей.

    nav-dashboards — список дашбордов. При добавлении нового — добавьте кнопку в навигацию.

    badge LIVE — индикатор «живого» режима. Не убирайте — это визуальный маркер, что данные обновляются.

    Ссылка на /registry — в подзаголовке. Ведёт на полный реестр API и виджетов. Полезна для отладки.

Связанные модули

Виджеты:

    dashboard/public/widgets/ticker.js — бегущая строка.

    dashboard/public/widgets/wordcloud.js — облако слов.

    dashboard/public/widgets/pie.js — круговая диаграмма.

    dashboard/public/widgets/source-matrix.js — матрица источников.

    dashboard/public/widgets/real-chart.js — график.

    dashboard/public/widgets/rss-map.js — карта.

    dashboard/public/widgets/rss-graph.js — граф.

    dashboard/public/widgets/articles.js — список статей.

    dashboard/public/widgets/sources-table.js — таблица источников.

API:

    apis/sources/alerts-api.mjs — алерты.

    apis/sources/articles-api.mjs — статьи.

    apis/sources/sources-api.mjs — источники.

    apis/sources/rss-stats-api.mjs — агрегаты.

    apis/sources/silence-api.mjs — разрывы.

    apis/sources/taxonomy-gaps-api.mjs — тематические gaps.

    apis/sources/narrative-framing-api.mjs — поляризация.

Конфиги:

    config/feeds.json — список фидов.

    config/alert.json — пороги для алертов.

Дашборды:

    dashboard/public/dashboard-5in1.html — центр аналитики.

    dashboard/public/dashboard-news.html — новости.

    dashboard/public/dashboard-narrative.html — нарративы.

    dashboard/public/dashboard-coordination.html — координация.

    dashboard/public/dashboard-network.html — граф.
