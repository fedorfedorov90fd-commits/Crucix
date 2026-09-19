# vxx-api

## Description
API module vxx-api provides data on VXX (iPath Series B S&P 500 VIX Short-Term Futures ETN). Tracks short-term VIX futures. Rises with volatility growth, loses value on contango (decay ~5-10% per month).

Version 3.0.0 (2026-09-19). Contract CRUCIX v2 (Layer). Basket-loader v2.0.0.

## Endpoint
GET /api/layers/vxx

## Data sources
- data/basket/vxx.json — v1 (series + meta) or legacy (array)
- data/basket/vix.json — v1 (points) or legacy (array)

Collector: scripts/collectors/collect-vxx.mjs.

## Volatility regimes
- calm — below 20 — Calm — #22c55e
- normal — 20 to 30 — Normal — #84cc16
- elevated — 30 to 45 — Elevated — #eab308
- stress — 45 to 60 — Stress — #f97316
- panic — above 60 — Panic — #dc2626

## Response formats
- json (default) — FeatureCollection + series + stats + trends + volatility + decay + vix_comparison + current_regime
- csv — table
- series — time series only
- stats — aggregated statistics
- raw — raw points
- report — text report

## Filters
- ?regime=calm|normal|elevated|stress|panic
- ?since=YYYY-MM-DD and ?until=YYYY-MM-DD
- ?min_value=N and ?max_value=N
- ?limit=N and ?top=N
- ?sort=date-asc|date-desc|value-asc|value-desc

## Service subpaths
- GET / — summary
- GET /health — health-check (online/degraded)
- GET /status — state and last value
- GET /stats — aggregated statistics
- GET /count — numbers only
- GET /series — time series
- GET /latest — last value
- GET /recent?since= — recent points
- GET /top?n=N — top by value
- GET /bottom?n=N — bottom by value
- GET /regimes — grouping by regime
- GET /current-regime — current regime
- GET /calm — calm points
- GET /stress — stress + panic points
- GET /volatility — VXX volatility
- GET /decay — decay (roll cost)
- GET /contango — contango indicator (VXX vs VIX)
- GET /backwardation — backwardation indicator
- GET /vix-comparison — VXX vs VIX comparison
- GET /distribution — bucket distribution
- GET /timeline — dynamics by day
- GET /trends — trends (7 vs 7)
- GET /anomalies — anomalies (z-score > 2)
- GET /signals — trading signals
- GET /compare?dates=a,b,c — point comparison
- GET /filter-presets — preset filters
- GET /config — configuration
- GET /export — text report
- GET /reset-cache — reset cache
- GET /featurecollection — GeoJSON (VIX points)
- GET /render — render config
- GET /builtin — builtin fallback (25 points)

## Response example
The response contains fields: type (FeatureCollection), series (array of date+value+regime), stats (count, last_value, last_regime), current_regime (regime, value, date).

## Related modules
- Collector: scripts/collectors/collect-vxx.mjs
- Map layer: dashboard/public/geo-map/js/layers.js (id: vxx, category: finance)
- Basket-loader: apis/sources/lib/basket-loader.mjs

## Location
- API: apis/sources/vxx-api.mjs
- Help: docs/help/en/vxx-api.md
- Collector: scripts/collectors/collect-vxx.mjs
- Basket: data/basket/vxx.json

## Status
Version: 3.0.0
Updated: 2026-09-19
