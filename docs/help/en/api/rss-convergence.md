# rss-convergence

## Description
Detection of convergent stories - news topics independently picked up by 5+ sources within a 6-hour window. Multi-source confirmation of significance.

## Difference from related modules
- adaptive-news-clustering - clustering by meaning WITHOUT time.
- source-coordination - coordination (2+ sources within 30 minutes, sim>0.7). Anomaly.
- rss-convergence - mass adoption (5+ sources within 6 hours, sim>0.5). Normal.

## Sources (4 files, ~574 records)
- rss-latest.json - 500 records (main RSS stream)
- rss.json - 34 records
- newsapi-latest.json - 10 records
- newsapi-real.json - 30 records

## Class
File: apis/sources/rss-convergence.mjs
Algorithm:
1. Tokenization of titles and descriptions (ru+en stop words).
2. TF-IDF vectors over all articles.
3. Clustering: cosine similarity > 0.5.
4. 6-hour window from oldest article in cluster.
5. Threshold: minimum 5 unique sources.
6. Score: sqrt(sources) x avgSim x (window / timeSpan).

## Analyzer
File: scripts/analyzers/rss-convergence.mjs
Run: node scripts/analyzers/rss-convergence.mjs
Output: data/analytics/semantic/rss-convergence.json

## Endpoints
- GET /api/layers/rss-convergence
- GET /api/layers/rss-convergence/stats
- GET /api/layers/rss-convergence/stories
- GET /api/layers/rss-convergence/top
- GET /api/layers/rss-convergence/by-source
- GET /api/layers/rss-convergence/story/:id
- GET /api/layers/rss-convergence/features

## Parameters
- ?n=10 - count
- ?minScore=3 - minimum convergenceScore
- ?minSources=10 - minimum sources
- ?level=critical - level filter
- ?source=tass - source within story

## Levels
critical >= 5, high >= 3, medium >= 1.5, low < 1.5.

## Strategic purpose
Mass media convergence is a classic significance signal. If 10 sources picked up one topic in 6 hours - it matters. This is what World Monitor has (RSS convergence), and now Crucix has it too - over 574 records from 15+ sources.
