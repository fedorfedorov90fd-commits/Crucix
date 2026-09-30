# source-coordination

## Description
Source coordination analyzer. Detects cases where N formally independent sources publish a semantically similar headline within a narrow time window. Indicator of an information operation.

## Difference from related modules
- adaptive-news-clustering - clustering by meaning WITHOUT time analysis
- cross-stream-correlation - correlation between data streams, not between sources
- source-coordination - intersection of two dimensions: meaning + time

## Sources (2)
- news.json (34 records, fields: source, title, publishedAt)
- gdelt_news.json (35 records, fields: title, timestamp)

## Class
File: apis/sources/source-coordination.mjs

Algorithm:
1. Tokenization of headlines with stop-word removal (ru + en).
2. TF-IDF vector construction over all publications.
3. Clustering: publications are similar if cosine similarity > 0.7 AND time span <= 30 minutes.
4. Filter out same-source repeats within a cluster (coordination is different sources).
5. Score: coordinationScore = (sources/2) x (window/timeSpan) x avgSimilarity.

## Analyzer
File: scripts/analyzers/source-coordination.mjs
Run: node scripts/analyzers/source-coordination.mjs
Output: data/analytics/specialist/source-coordination.json

## Endpoints
- GET /api/layers/source-coordination
- GET /api/layers/source-coordination/stats
- GET /api/layers/source-coordination/clusters
- GET /api/layers/source-coordination/by-source
- GET /api/layers/source-coordination/top

## Parameters
- ?n=10 - count
- ?minScore=1.5 - minimum coordinationScore
- ?level=critical - level filter
- ?source=interfax - source included in cluster
- ?maxTimeSpanMin=60 - max time span

## Levels
critical >= 3, high >= 1.5, medium < 1.5.

## Colors
critical #7f1d1d, high #dc2626, medium #f97316.

## Strategic purpose
Detection of synchronous publications for ANY side. Western platforms cannot have this module because it would expose coordination of their own sources.
