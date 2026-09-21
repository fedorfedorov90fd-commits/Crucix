# logistics-anomalies

## Description
Logistics anomaly analyzer. Detects transport accumulation before an event. Physical movements cannot be hidden at the source level.

## Data sources
- aviation.json - aviation (ADS-B)
- dark-ships.json - dark ships (AIS)
- ships.json - regular ships (AIS)
- military-exercises.json - military exercises
- notam.json - airspace closures
- infrastructure.json - 114 critical infrastructure objects

## Calculator class
File: apis/sources/logistics-anomalies.mjs
Algorithm:
1. Baseline: median + MAD over event counts in 150 km grid cells.
2. Robust Z-score: (count - median) / (1.4826 * MAD). Threshold 1.5.
3. Clustering: haversine radius 200 km.

## Analyzer
File: scripts/analyzers/logistics-anomalies.mjs
Run: node scripts/analyzers/logistics-anomalies.mjs
Output: data/analytics/specialist/logistics-anomalies.json

## Endpoints
- GET /api/layers/logistics-anomalies
- GET /api/layers/logistics-anomalies/stats
- GET /api/layers/logistics-anomalies/anomalies
- GET /api/layers/logistics-anomalies/clusters
- GET /api/layers/logistics-anomalies/by-type
- GET /api/layers/logistics-anomalies/by-region
- GET /api/layers/logistics-anomalies/top
- GET /api/layers/logistics-anomalies/featurecollection

## Query parameters
- ?n=10 - count
- ?minScore=2.0 - minimum score
- ?type=dark-ship - type filter
- ?region=Europe - region filter
- ?level=critical - level (critical/high/medium/low)

## Levels
critical >= 5, high >= 3, medium >= 2, low >= 1.5.

## Colors
critical #7f1d1d, high #dc2626, medium #f97316, low #eab308.

## Strategic purpose
Logistics is a physical process. Even with media blackout, ADS-B, AIS, NOTAM data remain. Logistics anomaly is an early sign of operational preparation.
