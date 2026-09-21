# narrative-drift

## Description
Narrative drift analyzer. Compares official statements with physical action data. Divergence is a sign of operational preparation or concealment.

## Sources (10)
- news.json, gdelt_news.json - news flow
- interfax.json, ria.json, tass.json - Russian sources
- bbc.json - Western source
- acled.json - conflicts
- military-exercises.json - exercises
- notam.json - airspace closures
- gps-jamming.json - EW

## Class
File: apis/sources/narrative-drift.mjs

Method computeDrift():
1. Tokenization of statements (stop words removed).
2. Match statement themes with action types (THEME_ACTIONS).
3. Drift coefficient: imbalance * themeFactor.
4. imbalance = actions / max(statements, 1).
5. themeFactor = 1 + themeConflict * 0.5.

## Analyzer
File: scripts/analyzers/narrative-drift.mjs
Run: node scripts/analyzers/narrative-drift.mjs
Output: data/analytics/specialist/narrative-drift.json

## Endpoints
- GET /api/layers/narrative-drift
- GET /api/layers/narrative-drift/stats
- GET /api/layers/narrative-drift/drifts
- GET /api/layers/narrative-drift/by-country
- GET /api/layers/narrative-drift/top
- GET /api/layers/narrative-drift/featurecollection

## Parameters
- ?n=10 - count
- ?minScore=1.5 - minimum score
- ?level=critical - level filter
- ?country=USA - country filter

## Levels
critical >= 3, high >= 1.5, medium >= 0.7, low < 0.7.

## Colors
critical #7f1d1d, high #dc2626, medium #f97316, low #eab308.

## Strategic purpose
Objective divergence analysis for ANY side. Western platforms cannot have this module because it would expose their own contradictions.
