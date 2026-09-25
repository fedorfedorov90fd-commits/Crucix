# 09. Normalizer

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/normalizer.mjs

## Purpose

Bringing raw events to unified format and extracting entities.

## Class

Normalizer

## Methods

- normalize(raw) - normalize single event
- normalizeBatch(raws) - batch normalization

## Processing

1. Text cleaning: remove line breaks, non-breaking spaces, collapse spaces
2. Entity extraction via patterns:
   - abbreviations (2-6 uppercase)
   - proper names
   - dates
   - event identifiers (e.g. flight MH370)
3. Stop word filtering
4. Limit: 30 entities per event

## Output format

- id, source, published_at, title, body
- entities, story_id, related_stories, url, category

## Relations

- Used by: 05-local-engine.md
- Result passed to: 10-dedup.md
