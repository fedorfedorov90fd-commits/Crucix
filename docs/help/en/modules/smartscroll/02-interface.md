# 02. Common Interface

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-interface.mjs

## Purpose

Defines contract v3 for all SmartScroll sources.
External adapter and local engine implement the same interface.

## Methods

- fetchStories(opts) - get story list
  - Params: since, limit, topics
  - Returns: array of Story
- fetchStoryDetail(storyId) - get story details
  - Params: storyId
  - Returns: Story
- fetchTimeline(storyId) - get story timeline
  - Params: storyId
  - Returns: array of TimelineEntry
- healthCheck() - check source state
  - Returns: ok, mode, details

## Data types

Story:
- id, title, summary, status
- start_time, end_time
- entities, events, related_stories

StoryEvent:
- id, source, published_at, title, body
- entities, story_id, related_stories

TimelineEntry:
- time, title, body, source

## Relations

- Implemented by: 03-external-adapter.md, 05-local-engine.md
- Used by: 04-local-index.md, 16-event-ingestion.md
