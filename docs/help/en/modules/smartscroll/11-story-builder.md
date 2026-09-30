# 11. Story Builder

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/story-builder.mjs

## Purpose

Clustering events into stories by similarity metric on entities, titles, and bodies. Calculating heuristic credibility weight of a story (bias_rank_weight) based on source geopolitical polarity and syndication detection.

## Class

StoryBuilder

## Methods

- `addToStories(newEvents, existingStories)` — assign events to existing stories or create new ones
- `_similarity(event, story)` — calculate similarity between event and story
- `detectSyndication(text)` — detect reprint markers in text
- `_getStoryPoles(story)` — collect set of poles from all story events
- `_hasSyndicationInStory(story)` — check syndication presence in story
- `_computeBiasRank(story)` — calculate story bias_rank_weight
- `_rebuildIndex(stories)` — rebuild inverted index
- `_indexStory(story, idx)` — add story to index
- `_candidates(event)` — fast candidate lookup
- `_updateRelatedStories(story, allStories)` — update relations between stories
- `getIndexStats()` — index statistics

## Algorithm

1. Rebuild inverted index on entities from existing stories
2. For each new event — fast candidate lookup through index (only stories sharing at least one entity). Complexity O(1) per event instead of O(N) over all stories
3. Calculate similarity metric for each candidate via `_similarity`:
   - entity similarity (Jaccard) × weight 0.5
   - title similarity (Jaccard on words) × weight 0.3
   - body similarity (Jaccard on 4-word shingles) × weight 0.2
   - Cross-pole boost +0.05 if event and story from different poles
4. If story similarity above threshold found — event added to story, entities, start_time, related_stories updated
5. If no story found — new story created with new id
6. After processing all events — bias_rank_weight calculated for each story via `_computeBiasRank`

## Similarity metric

Event-to-story similarity is computed as weighted sum of three components:

- Entity similarity (weight 0.5) — Jaccard on entity sets
- Title similarity (weight 0.3) — Jaccard on words longer than 2 chars
- Body similarity (weight 0.2) — Jaccard on 4-word shingles

Additional Cross-pole boost +0.05 is applied if event pole differs from story poles. Boost is small and positive — does not break existing threshold. Logic: independent corroboration of an event from two poles is academically stronger than repetition within one pole.

Default similarity threshold — 0.35.

## Inverted index

For fast candidate lookup, structure `_entityIndex` is used — Map from entity (lowercase) to set of story indices in array. When processing an event, `_candidates(event)` collects all story indices containing at least one event entity. This reduces comparisons from O(N) to O(K), where K is the number of stories with shared entities.

## Syndication detection

Method `detectSyndication(text)` searches for reprint markers by 10 regular expressions:

- по материалам (based on materials)
- по сообщению (per report)
- по данным (per data)
- according to
- reported by
- sources said / sources told
- citing
- цитирует (cites)
- ссылкой на (with reference to)
- ref to / reference to

Method `_hasSyndicationInStory(story)` checks all story events for these markers in title or body.

## Credibility weight (bias_rank_weight)

Method `_computeBiasRank(story)` calculates heuristic story credibility weight in range from 0 to 1 based on three factors:

- number of events in story
- source polarities (cross-pole or same-pole)
- syndication presence

Formula:

- cross-pole without syndication → 0.9
- cross-pole with syndication → 0.5
- same-pole (multiple sources of one pole) → 0.6
- single source → 0.3
- no events → 0

Value is written to `bias_rank_weight` field of each story. Used as a ranking weight for sorting stories, not as a credibility verdict.

## Relations between stories

Method `_updateRelatedStories(story, allStories)` creates relations between stories when 3 or more shared entities are present. Relations stored in `related_stories` field of both stories.

## Output format

- id — story identifier of form story_N
- title — title of first story event
- summary — summary (filled later by summarizer)
- status — story status (active)
- start_time — time of first event
- end_time — time of last event
- entities — array of unique entities from all story events
- events — array of events
- related_stories — array of related story ids
- bias_rank_weight — heuristic credibility weight (0-1)

## Relations

- Input: 10-dedup.md
- Output: 12-summarizer.md, 14-story-store.md
- Reads pole field from: 09-normalizer.md
