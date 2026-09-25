# 10. Deduplicator

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/dedup.mjs

## Purpose

Three-level event deduplication.

## Class

Deduplicator

## Levels

1. Exact content hash. Title plus first 500 chars of body.
2. Shingles and Jaccard. Comparison by 4-word shingles.
3. Levenshtein on titles. For short bodies under 200 chars.

## Method

deduplicate(newEvents, existingEvents) - returns only unique events.

## Threshold

Default 0.82. Configured in config.

## Relations

- Used by: 05-local-engine.md, 16-event-ingestion.md
