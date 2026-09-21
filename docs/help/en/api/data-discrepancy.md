# data-discrepancy

## Description
Data discrepancy analyzer. Compares values of the same indicator for the same country across different sources. Divergence is a sign of methodological difference or concealment.

## Sources (6)
- worldbank-latest.json - World Bank (194 countries)
- rest-countries.json - country reference
- fred-real.json - economic series
- who.json - World Health Organization
- happiness.json - happiness index
- freedom.json - freedom index

## Class
File: apis/sources/data-discrepancy.mjs

Algorithm:
1. Group values by (country, indicator) pair.
2. For each group - mean value per source.
3. Median and MAD over the means.
4. Relative spread: (max - min) / |median| * 100.
5. Z-score of the most deviating source.
6. discrepancyScore = (spreadPct / 20) + zScore.

## Analyzer
File: scripts/analyzers/data-discrepancy.mjs
Run: node scripts/analyzers/data-discrepancy.mjs
Output: data/analytics/specialist/data-discrepancy.json

## Endpoints
- GET /api/layers/data-discrepancy
- GET /api/layers/data-discrepancy/stats
- GET /api/layers/data-discrepancy/discrepancies
- GET /api/layers/data-discrepancy/by-country
- GET /api/layers/data-discrepancy/by-indicator
- GET /api/layers/data-discrepancy/top

## Parameters
- ?n=10 - count
- ?minScore=1.5 - minimum score
- ?level=critical - level filter
- ?country=USA - country filter
- ?indicator=population - indicator filter

## Levels
critical: spreadPct >= 50, high: spreadPct >= 20, medium: < 20.

## Colors
critical #7f1d1d, high #dc2626, medium #f97316.

## Strategic purpose
Objective discrepancy analysis of official data for ANY side. Western platforms cannot have this module because it would expose contradictions in their own statistics.
