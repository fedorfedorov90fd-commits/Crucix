# 03. External Adapter

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll.mjs

## Purpose

Connection to external SmartScroll API.
Implements SmartScrollInterface contract.

## Class

SmartScrollAdapter extends SmartScrollInterface

## Methods

- fetchStories(opts) - GET /api/v1/stories
- fetchStoryDetail(storyId) - GET /api/v1/stories/:id
- fetchTimeline(storyId) - GET /api/v1/stories/:id/timeline
- healthCheck() - GET /api/v1/health

## Resilience mechanisms

- Timeout via AbortController
- Retries with exponential backoff
- Handling 429 and 5xx with retry
- Authorization via Authorization: Bearer header

## Relations

- Reads config: 01-config.md
- Implements interface: 02-interface.md
- Used by factory: 04-local-index.md
