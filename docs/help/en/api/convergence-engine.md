# convergence-engine

## Description
Universal signal convergence engine. Reads all files from 8 categories of data/analytics/ (detector, forecast, semantic, flow, market, specialist, index, space) and finds regions where multiple independent categories simultaneously produce a signal.

## Unique advantage
World Monitor has convergence only on RSS (news). Crucix - across all 59 analyzers from 30 sciences. This gives more reliable convergences: one measurement can err, four independent cannot.

## Algorithm
1. Read all analytics files (except _manifest, _catalog, _lineage, _health, _schema).
2. For each module compute a signal (log-normalization of finding count).
3. Group by region/country.
4. For each region count unique categories.
5. Convergence triggers at 3+ categories.
6. Score: sqrt(categories) x weightedSignal x diversityBoost.

## Category weights
- detector 1.0, forecast 1.0 - primary
- semantic 0.8, market 0.8 - confirming
- flow 0.7, specialist 0.7 - supporting
- index 0.6, space 0.5 - background

## Thresholds
- minCategories = 3 (minimum for convergence)
- minSignal = 0.05 (minimum module signal)
- Levels: critical >= 2.5, high >= 1.5, medium >= 0.8, low < 0.8

## Files
- scripts/analyzers/convergence-engine.mjs - analyzer
- apis/sources/convergence-engine.mjs - class ConvergenceEngine
- apis/sources/convergence-engine-api.mjs - API module
- data/analytics/specialist/convergence-engine.json - result

## Endpoints
- GET /api/layers/convergence-engine
- GET /api/layers/convergence-engine/stats
- GET /api/layers/convergence-engine/convergences
- GET /api/layers/convergence-engine/top
- GET /api/layers/convergence-engine/by-region/:region
- GET /api/layers/convergence-engine/by-category/:cat
- GET /api/layers/convergence-engine/modules
- GET /api/layers/convergence-engine/featurecollection

## Parameters
- ?n=10 - count
- ?minScore=1.5 - minimum convergenceScore
- ?minCategories=4 - minimum categories
- ?level=critical - level filter
- ?category=detector - category filter

## Run
node scripts/analyzers/convergence-engine.mjs

## Strategic purpose
Unique Crucix feature. Competitors with RSS convergence have no scientific core. Crucix connects 59 analyzers from 30 sciences.
