# Crucix — Устав автономии карт (Metrics Map)

**Версия:** 1.0
**Дата:** 2026-09-28
**Принцип:** FULL ISOLATION (Nygard 2007, Bulkhead Pattern)

## R1: Ноль cross-map зависимостей
Ни один `<script>`, `<link>`, `fetch` не ходит в `../other-map/`.
Исключение: `<a href>` — навигация между картами (не зависимость).

## R2: Локальные данные
`world.geojson` лежит в `data/`, `fetch('data/world.geojson')`.

## R3: Только свои слои
`layers.js` содержит ровно 75 слоёв Metrics Map (economics/finance/esg/cyber/energy/health/social/geopolitical/military/threats/intelligence/news/other).
Чужих слоёв (semantic, forecast, network, event) — 0.

## R4: Своя конфигурация
`maps-config.js`, `presets.json` — только для Metrics Map.

## R5: manifest.json
`local_cross_map: 0`. `failure_domain: 1`.

## R6: Failure domain = 1
Сбой в Metrics Map не влияет на Event/Semantic/Forecast/Network.

## ЧЕК-ЛИСТ ВЕРИФИКАЦИИ
```bash
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest\|//\s'
grep -c 'id:' js/layers.js                # → 75
grep -n 'data/world.geojson' js/map-controls.js  # → найдено
ls -la data/world.geojson                 # → существует
text

### `presets/presets.json`

```json
{
  "presets": [
    {
      "id": "crucix-metrics-default",
      "name": "Все категории",
      "description": "Все 13 категорий, Jenks, палитры по умолчанию",
      "enabledLayers": [
        "inflation", "unemployment", "gdp", "pmi", "recession",
        "dxy", "yield-curve", "hy-spread", "copper-gold",
        "happiness", "population", "refugees",
        "country-instability", "social-unrest", "corruption",
        "military-spending", "war-preparation",
        "cyber-threat-index-api", "cve-cyber",
        "eia", "oil-gas", "renewable", "nuclear",
        "internet", "mobile"
      ],
      "theme": "default"
    },
    {
      "id": "crucix-metrics-economics",
      "name": "Экономика",
      "description": "PMI, оптимизм, ожидания, рецессия",
      "enabledLayers": [
        "pmi", "recession", "inflation", "unemployment", "gdp",
        "business-optimism-api", "consumer-expectations-api",
        "pmi-api", "recession-api"
      ],
      "theme": "default"
    },
    {
      "id": "crucix-metrics-finance",
      "name": "Финансы и энергия",
      "description": "Финансовые индексы + энергетика",
      "enabledLayers": [
        "dxy", "yield-curve", "hy-spread", "copper-gold",
        "gold-oil", "gold-silver", "uranium",
        "copper-gold-ratio-api", "hy-spread-api", "ovx-api",
        "sp500-vix-api", "vxx-api", "yield-curve-api",
        "crypto-fear-api", "rublev-dubai-api",
        "wti-brent-spread-api",
        "eia", "oil-gas", "renewable"
      ],
      "theme": "default"
    },
    {
      "id": "crucix-metrics-esg",
      "name": "ESG",
      "description": "Экология, социальные, здравоохранение",
      "enabledLayers": [
        "happiness", "happiness-alt", "population", "refugees",
        "urbanization", "who", "covid", "hdi",
        "who-health", "covid-health", "healthcare-health"
      ],
      "theme": "default"
    },
    {
      "id": "crucix-metrics-threats",
      "name": "Угрозы",
      "description": "Кибер, военный, уязвимости",
      "enabledLayers": [
        "cyber-threat-index-api", "cve-cyber",
        "military-spending", "war-preparation",
        "cve-threat", "country-instability",
        "strategic-risk-composite"
      ],
      "theme": "default"
    }
  ]
}
