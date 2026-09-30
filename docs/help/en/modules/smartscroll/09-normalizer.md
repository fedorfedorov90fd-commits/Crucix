# 09. Normalizer

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/normalizer.mjs

## Purpose

Bringing raw events to unified format, extracting entities, and determining source geopolitical polarity. Normalization runs before deduplication, enabling polarity and entities to be used at all subsequent processing stages.

## Class

Normalizer

## Methods

- `normalize(raw)` — normalize single event
- `normalizeBatch(raws)` — batch normalization of event array
- `_loadPoleRules()` — load polarity rules from source-camps.json at initialization
- `_detectPole(source)` — determine source polarity by domain or name
- `_cleanText(text)` — text cleaning
- `_extractEntities(text)` — entity extraction by patterns
- `_normalizeDate(date)` — date to ISO conversion
- `_genId(raw)` — deterministic id generation

## Processing

1. Text cleaning via `_cleanText`: remove CRLF line breaks, non-breaking spaces, collapse repeated spaces, limit empty lines
2. Entity extraction via `_extractEntities` with four patterns:
   - abbreviations 2-6 uppercase letters
   - proper names (capital letter + 2-20 lowercase)
   - dates in "number month-word" format
   - event identifiers like "flight MH370" or "flight AA123"
3. Stop word filtering (Russian and English prepositions, conjunctions, pronouns)
4. Limit: no more than 30 entities per event
5. Source polarity detection via `_detectPole`
6. Date to ISO conversion via `_normalizeDate`
7. Assemble final record

## Polarity detection

Method `_loadPoleRules` at class initialization reads `apis/sources/source-camps.json` — a database of 67 sources distributed across three poles:

- russian — 31 sources
- western — 22 sources
- non_aligned — 14 sources

Rules are sorted by substring length in reverse order — more specific matches have priority. Result is cached in `this._poleRules`.

Method `_detectPole(source)` checks source name for substrings from the database. Priority rules handle known conflicts:

- forbes + .ru in source name → russian
- forbes + .com in source name → western

When no match is found — returns `unknown`.

## Output format

- id — deterministic hash from source, title, published_at
- source — source name (string)
- pole — geopolitical polarity: russian / western / non_aligned / unknown
- published_at — ISO date
- title — cleaned title
- body — cleaned body, up to 10000 chars
- entities — array of extracted entities (max 30)
- story_id — story id (null at normalization)
- related_stories — array of related story ids (empty at normalization)
- url — source link
- category — event category

## Relations

- Used by: 05-local-engine.md
- Result passed to: 10-dedup.md
- Reads: apis/sources/source-camps.json
- pole field used in: 11-story-builder.md
