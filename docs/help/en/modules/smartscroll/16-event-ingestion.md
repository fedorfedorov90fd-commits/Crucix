# 16. Pipeline Integration

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/ingest/event-ingestion-api.mjs

## Purpose

Single entry point for SmartScroll events into Crucix pipeline.
Includes built-in HTTP server with endpoints for the dashboard.

## Module functions

- ingestStories(opts) - ingest stories into graph
- runCollectCycle() - full collection cycle from sources
- getTimeline(storyId) - proxy to source
- getStoryDetail(storyId) - proxy to source
- healthCheck() - pipeline state
- setGraphAdapter(adapter) - connect knowledge graph
- startIngestionLoop(intervalMs) - autonomous loop
- startHttpServer(port) - start HTTP server

## HTTP endpoints

- GET /health - source and graph state
- GET /metrics - performance metrics (local or auto mode only)
- GET /stats - summary: stories and events count
- GET /stories?limit=N&since=ISO - list of stories
- GET /stories/:id - single story details
- GET /stories/:id/timeline - story timeline
- POST /run?limit=N - ingest stories into graph
- POST /collect - full collection cycle from sources

## Result format of ingestStories

- imported - number of imported stories
- deduped - number of removed duplicates
- skipped - number of skipped
- errors - array of errors

## Result format of runCollectCycle

- collected - number of collected events
- unique - number of unique after deduplication
- stories - number of stories
- duration_ms - cycle duration

## Run as script

Environment variables:
- SMARTSCROLL_HTTP_PORT - HTTP server port (default 3157)

Command:
node apis/ingest/event-ingestion-api.mjs

## Graph connection

import { setGraphAdapter } from './apis/ingest/event-ingestion-api.mjs';
setGraphAdapter({
  async addNode(node) { /* graph */ },
  async addEdge(edge) { /* graph */ },
  async resolveEntity(name) { /* resolver */ },
});

## Relations

- Imports: 04-local-index.md, 10-dedup.md, 15-story-layer.md
- Writes to basket via: scripts/collectors/collect-smartscroll.mjs
