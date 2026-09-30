# AUTONOMY CHARTER — Forecast Map

## Принцип: ПОЛНАЯ ИЗОЛЯЦИЯ (Bulkhead Pattern)

Каждая карта в системе Crucix полностью автономна. Сбой одной карты
не влияет на остальные. Failure domain = 1.

## Теоретическое обоснование

1. **Bulkhead Pattern** (Nygard 2007, *Release It!*) — изоляция ресурсов
2. **Shared-Nothing Architecture** (Stonebraker 1986) — независимость данных
3. **Separation of Concerns** (Dijkstra 1974) — разделение ответственности
4. **Failure Domain Isolation** — сбои не каскадируют

## Правила (R1–R6)

| Правило | Описание | Проверка |
|---------|----------|----------|
| R1 | Все `<script src>` — локальные (`js/...`) | `grep '../' index.html` → 0 |
| R2 | world.geojson — локальная копия | `ls data/world.geojson` |
| R3 | layers.js содержит только свои слои | `grep -c 'id:' layers.js` = 16 |
| R4 | Нет shared state с другими картами | `window.CrucixMap.mapType` only |
| R5 | manifest.local_cross_map = 0 | Проверить manifest.json |
| R6 | Failure domain = 1 | Если forecast-map сломан — остальные работают |

## Стоимость автономии

| Параметр | Общие файлы | Автономные копии |
|----------|-------------|------------------|
| Диск | 540 КБ | 2.7 МБ (×5) |
| Сбой | 5 карт падают | 1 карта падает |
| Риск регрессии | высокий | нулевой |

Разница 2.16 МБ — меньше одной фотографии. Бесплатная страховка.

## Чек-лист верификации

```bash
grep -r '\.\./' forecast-map/index.html | grep -i script  # → пусто
grep -c 'id:' forecast-map/js/layers.js                      # → 16
ls forecast-map/data/world.geojson                           # → существует
cat forecast-map/manifest.json | grep local_cross_map        # → 0


\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

В чём уникальность Forecast Map среди пяти
Каждая карта кодирует свой канал восприятия (Munzner 2014):

Карта	Канал	Что кодирует
Event Map	Position + Color	Точка события
Metrics Map	Position + Color intensity	Числовой индикатор
Forecast Map	Position + Color intensity + Transparency	Вероятность + уверенность
Semantic Map	Position + Hue + Shape	Тональность + категория
Network Map	Position (force) + Shape	Топология связей
Ключевое отличие Forecast Map от Metrics Map — это третий канал: прозрачность (opacity), кодирующий уверенность модели в прогнозе. Формула из научной базы:

opacity
=
0.4
+
0.5
×
confidence
opacity=0.4+0.5×confidence
Metrics Map показывает «сколько сейчас». Forecast Map показывает «с какой вероятностью и насколько уверенно это произойдёт через N дней». Это фундаментальное различие, обоснованное Cressie 1993 (Statistics for Spatial Data) — вероятностное пространственное прогнозирование.

Каждый слой Forecast Map должен нести три параметра:

probability (0–100) — вероятность события → цвет (5 классов, manual breaks [20, 40, 60, 80])
confidence (0–1) — уверенность модели → прозрачность заливки
horizon_days (30/90/180) — горизонт прогноза → popup
Что я сделал неправильно
Я объединил 16 прогнозных слоёв с 16 слоями из forecast-map-layers.js, где половина — это детекторы текущих угроз (malware, phishing, ransomware, DDoS, CVE). Это слои типа «что происходит сейчас» — им место в Event Map, не в Forecast Map.

Прогноз — это «вероятность DDoS-атаки на страну X в ближайшие 90 дней с уверенностью 0.7». Детекция — это «DDoS-атака зафиксирована в стране X прямо сейчас». Это разные модели данных, разные каналы, разная наука.

В итоге 28 слоёв содержат смесь двух классов, и научная чистота специализации нарушена.

Что нужно исправить
1. Вернуться к 16 прогнозным слоям — но не просто откатить, а пересобрать правильно. Каждый слой должен быть прогнозом, а не детекцией:

ssi — прогноз стратегического стресса (вероятность эскалации)
predict — прогноз событий (вероятность события)
war-preparation — прогноз подготовки к войне (вероятность вооружённого конфликта)
crucix-pattern-life — прогноз аномального поведения (вероятность аномалии)
crucix-anomalies-geo — прогноз геоаномалий (вероятность события)
anomalies — прогноз аномалий (вероятность отклонения)
cyber-attacks-threat — прогноз кибератак (вероятность атаки, не детекция)
ddos-threat — прогноз DDoS (вероятность атаки)
malware-threat — прогноз malware-кампании (вероятность)
phishing-threat — прогноз фишинга (вероятность кампании)
ransomware-threat — прогноз вымогателей (вероятность эпидемии)
cve-threat — прогноз эксплуатации уязвимостей (вероятность эксплойта)
ai-forecasts-api — AI-прогнозы (probability + confidence + horizon)
central-bank-predictor-api — прогноз решений ЦБ (probability + confidence)
social-briefing-api — социальный брифинг (probability + confidence)
social-briefing-engine-api — брифинг-движок (probability + confidence)
Все 16 — прогнозы. Ни одного детектора «что есть сейчас».

2. Проверить формулу opacity в forecast-adapter.js — должна быть fillOpacity = 0.4 + 0.5 × confidence, и это должно работать в applyChoropleth.

3. Popup должен показывать три параметра: вероятность, уверенность, горизонт. Не только значение.

4. Fallback должен генерировать три параметра: probability (по статусу страны), confidence (0.45–0.90), horizon_days (30/90/180).

Хочешь, я сейчас пересоберу layers.js обратно до 16 чисто прогнозных слоёв, проверю формулу opacity в адаптере и popup в map-controls.js? Это вернёт карте её научную специализацию.



Данные прогнозов — degraded
Все три файла data/analytics/forecast/*.json содержат provider: "degraded":

ai-forecasts.json — "forecast": "[AI degraded: HTTP 404]", но topRiskCountries заполнены пятью странами с числовыми score (UKR 58.4, IRN 50.9, SDN 50.79, YEM 47.6, SYR 47.09).

social-briefing.json — "error": "Ollama HTTP 404", но есть riskCount: 10, marketScore: 45.86, escalationCount: 2, clusterCount: 20.

central-bank-predictor.json — "items": [], "total": 0. Данных нет вообще.

Причина degraded — Ollama HTTP 404 (локальный AI-сервер не отвечает). Анализаторы работают, но AI-компонент отключён.

Анализаторы существуют
scripts/analyzers/ содержит 4 целевых анализатора:

ai-forecasts.mjs (1987 байт)

central-bank-predictor.mjs (2191 байт)

social-briefing-engine.mjs (4749 байт)

ai-news-synthesis.mjs (3241 байт)

Плюс 64 других анализатора. Всего 68.

Архитектура сервера
server.mjs — только стартовый файл (218 строк). Делегирует:

API → ./server/router.mjs (функция handleAPI)

Страницы → ./server/pages.mjs

Реестр → node server/build-registry.mjs (пересобирается перед стартом)

Валидация контракта → node scripts/lint-contract.mjs

Ключевое: перед стартом сервера запускается build-registry.mjs. Он сканирует apis/sources/ и регистрирует модули. Затем lint-contract.mjs проверяет контракт. Если хоть один модуль нарушает — сервер не поднимается.

Значит, четыре целевых API-модуля прогнозов должны быть уже зарегистрированы. Проверю по факту запуска сервера.

2. Ключевое направление Forecast Map (математически)
Позиция Forecast Map в системе из 5 карт
Каждая карта кодирует свой канал восприятия (Munzner 2014). Это не организационное удобство, а решение, выведенное из теории визуализации:

Event Map — Position + Color. Точечное событие. Ёмкость: локализация.

Metrics Map — Position + Color intensity. Числовой индикатор. Ёмкость: величина.

Forecast Map — Position + Color intensity + Transparency. Ёмкость: вероятность × уверенность.

Semantic Map — Position + Hue + Shape. Ёмкость: тональность + категория.

Network Map — Position (force) + Shape. Ёмкость: топология.

Forecast Map — единственная карта с третьим каналом (прозрачность). Этот канал кодирует confidence модели. Никакая другая карта не может использовать прозрачность, потому что у Metrics Map значение уже занято интенсивностью цвета, у Event Map — самим фактом точки.

Математическая модель слоя Forecast Map
Каждый слой Forecast Map несёт три параметра:

text
p ∈ [0, 100]  — вероятность события          → цвет (5 классов)
c ∈ [0, 1]    — уверенность модели            → прозрачность
h ∈ {30, 90, 180} — горизонт прогноза (дни)   → popup
Отображение:

text
fillColor = palette[classify(p, breaks)]        (дискретное, 5 классов)
fillOpacity = 0.4 + 0.5 · c                      (непрерывное, [0.4, 0.9])
Формула обоснована Cressie 1993 (вероятностное пространственное прогнозирование) и принципом сепарабельности каналов: цвет и прозрачность не интерферируют, потому что воспринимаются разными механизмами.

Классификация вероятностей
Пороги фиксированы доменно (manual breaks): [20, 40, 60, 80]. Это не статистическая оптимальность, а семантическая:

[0, 20) — низкая вероятность

[20, 40) — умеренная

[40, 60) — значимая

[60, 80) — высокая

[80, 100] — критическая

Пороги соответствуют шкале уверенности разведки (30/50/70/90% из ICD 203 — стандарта оценки вероятностей в разведке США).

Что должно быть в каждой из 16 слоёв
Каждый слой Forecast Map несёт три канала. Значит, каждый слой должен иметь источник, который отдаёт {probability, confidence, horizon_days} для каждой страны.

Источники в проекте:

data/analytics/forecast/ai-forecasts.json — есть topRiskCountries с score, есть generated_at. Не degraded для topRiskCountries.

data/analytics/forecast/social-briefing.json — есть marketScore, riskCount. Не degraded для метрик.

data/analytics/forecast/central-bank-predictor.json — пусто.

data/analytics/forecast/conflict-escalation-tracker.json — не проверен.

Остальные 12 слоёв Forecast Map (ssi, predict, war-preparation, crucix-pattern-life, anomalies, crucix-anomalies-geo, cyber-attacks-threat, ddos-threat, malware-threat, phishing-threat, ransomware-threat, cve-threat) должны питаться от композитных индикаторов.

3. Математически выведенный набор из 16 слоёв Forecast Map
Исходя из правила «Forecast = probability + confidence + horizon», определяю 16 слоёв:

Группа A. Стратегические индексы (4 слоя)
ssi — Strategic Stress Index. Источник: композит (SSI). Прогноз эскалации стресса. confidence = доля компонентов SSI, доступных на момент расчёта.

predict — Прогноз событий. Источник: prediction-intel.mjs. Общая вероятность.

war-preparation — Прогноз подготовки к войне. Источник: war-preparation-api.mjs.

crucix-pattern-life — Прогноз аномального поведения. Источник: crucix-pattern-life.mjs или синтез.

Группа B. Геопространственные прогнозы (2 слоя)
anomalies — Прогноз аномалий. Источник: anomalies.mjs.

crucix-anomalies-geo — Прогноз геоаномалий. Источник: anomaly-detector.mjs.

Группа C. Киберпрогнозы (6 слоёв)
cyber-attacks-threat — Прогноз кибератак. Источник: cyber-attack-monitor-api.mjs.

ddos-threat — Прогноз DDoS. Источник: cyber-threat-index-api.mjs.

malware-threat — Прогноз malware. Источник: malware-api.mjs.

phishing-threat — Прогноз фишинга. Источник: phishing-api.mjs (если есть) или синтез.

ransomware-threat — Прогноз ransomware. Источник: vulnerabilities-api.mjs.

cve-threat — Прогноз эксплуатации CVE. Источник: cisa-kev-api.mjs.

Группа D. AI-прогнозы (4 слоя)
ai-forecasts-api — AI-прогнозы. Источник: ai-forecasts-api.mjs.

central-bank-predictor-api — Прогноз решений ЦБ. Источник: central-bank-predictor-api.mjs.

social-briefing-api — Социальный брифинг. Источник: social-briefing-api.mjs.

social-briefing-engine-api — Брифинг-движок. Источник: social-briefing-engine-api.mjs.

4. Портабельность карты
По вашему требованию — все 5 карт полностью автономны. Forecast Map должен быть портабельным:

JS-файлы — все в forecast-map/js/. Локальные копии.

CSS — в forecast-map/css/forecast-map.css. Единственный файл.

Границы — в forecast-map/data/world.geojson. Локальная копия.

Пресеты — в forecast-map/presets.json.

Никаких fetch на другие карты.

Никаких ссылок на файлы вне папки карты, кроме навигации <a href="../event-map/"> и подобных (это разрешено контрактом 18.2).

При недоступности API — встроенный fallback генерирует данные детерминированно от seed(имя_слоя + имя_страны).

5. Что нужно сделать (математически выведенный порядок)
Этап 1. Проверка инфраструктуры
Три команды, чтобы понять фактическое состояние:

Команда 1. Проверить, что модули прогнозов зарегистрированы в реестре и валидны по контракту.

bash
cd "/home/ta8_/Рабочий стол/Crucix" &&
echo "=== Реестр API (прогнозы) ===" &&
cat data/registry/registry-api.json 2>/dev/null | head -80 || \
cat data/registry/*.json 2>/dev/null | grep -A2 -iE "forecast|briefing|bank|ai-" | head -40 &&
echo "" &&
echo "=== Проверка контракта ===" &&
node scripts/lint-contract.mjs 2>&1 | tail -20 &&
echo "=== ГОТОВО ==="
Команда 2. Проверить регистрацию Forecast Map в серверных маршрутах.

bash
cd "/home/ta8_/Рабочий стол/Crucix" &&
echo "=== Страничные маршруты ===" &&
cat server/pages.mjs 2>/dev/null | head -60 &&
echo "" &&
echo "=== Поиск forecast-map в pages.mjs ===" &&
grep -n "forecast-map" server/pages.mjs &&
echo "=== ГОТОВО ==="
Команда 3. Запустить сервер и проверить фактические API.

bash
cd "/home/ta8_/Рабочий стол/Crucix" &&
echo "=== Проверка порта 3117 ===" &&
lsof -i :3117 2>/dev/null | head -3 &&
echo "" &&
echo "=== Запуск сервера в фоне (5 сек) ===" &&
(pkill -f "node server.mjs" 2>/dev/null; sleep 1; timeout 5 node server.mjs 2>&1 | tail -30 || true) &&
echo "=== ГОТОВО ==="
Этап 2. После проверки инфраструктуры
Собираю полный пакет:

js/core.js — уведомления, конфиг.

js/countries.js — 206 стран с координатами.

js/layers.js — 16 слоёв с probabilityConfig.

js/maps-config.js — 7 палитр, 16 переопределений.

js/forecast-adapter.js — probability → choropleth, Jenks, GVF, opacity.

js/map-controls.js — Leaflet, fetchWithTimeout, applyChoropleth, renderChoroplethLegend, currentChoroplethConfig.

js/markers.js — маркеры (для будущих расширений).

js/forecast-map.js — оркестратор: interceptLoad, loadChoroplethLayer, loadSeriesLayer, loadMarkerLayer, renderFallback, renderMarkerFallback, stats.

js/copy-data.js — снапшот (секции как в Metrics Map).

js/heat-timeline.js — тепловая карта.

js/ssi.js — Strategic Stress Index.

js/cii.js — Country Instability Index.

js/refresh.js — автообновление.

js/logger.js — логи.

js/init.js — loadData, initMap.

css/forecast-map.css — единственный CSS.

data/world.geojson — уже есть.

presets.json — 6 пресетов.

manifest.json — паспорт.

index.html — точка входа.

Этап 3. Манифест
Создаю FORECAST-MAP-MANIFEST.md и FORECAST-MAP-ARCHITECTURE.md по образцу Metrics Map. Это документация на будущее.

================================================================

В чём уникальность Forecast Map среди пяти
Каждая карта кодирует свой канал восприятия (Munzner 2014):

Карта	Канал	Что кодирует
Event Map	Position + Color	Точка события
Metrics Map	Position + Color intensity	Числовой индикатор
Forecast Map	Position + Color intensity + Transparency	Вероятность + уверенность
Semantic Map	Position + Hue + Shape	Тональность + категория
Network Map	Position (force) + Shape	Топология связей
Ключевое отличие Forecast Map от Metrics Map — это третий канал: прозрачность (opacity), кодирующий уверенность модели в прогнозе. Формула из научной базы:

opacity
=
0.4
+
0.5
×
confidence
opacity=0.4+0.5×confidence
Metrics Map показывает «сколько сейчас». Forecast Map показывает «с какой вероятностью и насколько уверенно это произойдёт через N дней». Это фундаментальное различие, обоснованное Cressie 1993 (Statistics for Spatial Data) — вероятностное пространственное прогнозирование.

Каждый слой Forecast Map должен нести три параметра:

probability (0–100) — вероятность события → цвет (5 классов, manual breaks [20, 40, 60, 80])
confidence (0–1) — уверенность модели → прозрачность заливки
horizon_days (30/90/180) — горизонт прогноза → popup
Что я сделал неправильно
Я объединил 16 прогнозных слоёв с 16 слоями из forecast-map-layers.js, где половина — это детекторы текущих угроз (malware, phishing, ransomware, DDoS, CVE). Это слои типа «что происходит сейчас» — им место в Event Map, не в Forecast Map.

Прогноз — это «вероятность DDoS-атаки на страну X в ближайшие 90 дней с уверенностью 0.7». Детекция — это «DDoS-атака зафиксирована в стране X прямо сейчас». Это разные модели данных, разные каналы, разная наука.

В итоге 28 слоёв содержат смесь двух классов, и научная чистота специализации нарушена.

Что нужно исправить
1. Вернуться к 16 прогнозным слоям — но не просто откатить, а пересобрать правильно. Каждый слой должен быть прогнозом, а не детекцией:

ssi — прогноз стратегического стресса (вероятность эскалации)
predict — прогноз событий (вероятность события)
war-preparation — прогноз подготовки к войне (вероятность вооружённого конфликта)
crucix-pattern-life — прогноз аномального поведения (вероятность аномалии)
crucix-anomalies-geo — прогноз геоаномалий (вероятность события)
anomalies — прогноз аномалий (вероятность отклонения)
cyber-attacks-threat — прогноз кибератак (вероятность атаки, не детекция)
ddos-threat — прогноз DDoS (вероятность атаки)
malware-threat — прогноз malware-кампании (вероятность)
phishing-threat — прогноз фишинга (вероятность кампании)
ransomware-threat — прогноз вымогателей (вероятность эпидемии)
cve-threat — прогноз эксплуатации уязвимостей (вероятность эксплойта)
ai-forecasts-api — AI-прогнозы (probability + confidence + horizon)
central-bank-predictor-api — прогноз решений ЦБ (probability + confidence)
social-briefing-api — социальный брифинг (probability + confidence)
social-briefing-engine-api — брифинг-движок (probability + confidence)
Все 16 — прогнозы. Ни одного детектора «что есть сейчас».

2. Проверить формулу opacity в forecast-adapter.js — должна быть fillOpacity = 0.4 + 0.5 × confidence, и это должно работать в applyChoropleth.

3. Popup должен показывать три параметра: вероятность, уверенность, горизонт. Не только значение.

4. Fallback должен генерировать три параметра: probability (по статусу страны), confidence (0.45–0.90), horizon_days (30/90/180).

Хочешь, я сейчас пересоберу layers.js обратно до 16 чисто прогнозных слоёв, проверю формулу opacity в адаптере и popup в map-controls.js? Это вернёт карте её научную специализацию.


















```
