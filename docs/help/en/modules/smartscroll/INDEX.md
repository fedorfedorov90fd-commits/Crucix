# SmartScroll — Integration Package for Crucix

Package version: 1.0.0

## Purpose

SmartScroll is a module for collecting, deduplicating, clustering and summarizing news streams from RSS and Telegram. Output: stories, timelines, summaries integrated into the Crucix knowledge graph.

Three operation modes:

- external — connection to external SmartScroll API.
- local — autonomous local engine without external dependencies.
- auto — auto-switch: tries external, falls back to local on failure.

## File relation map

config/smartscroll.json
    ->
apis/sources/smartscroll-interface.mjs
    ->
    apis/sources/smartscroll.mjs (external adapter)
    apis/sources/smartscroll-local/index.mjs (factory)
            ->
            apis/sources/smartscroll-local/engine.mjs (core)
                    ->
                    scripts/collectors/lib/rss-collector.mjs
                    scripts/collectors/lib/telegram-collector.mjs
                    apis/sources/smartscroll-local/processing/normalizer.mjs
                    apis/sources/smartscroll-local/processing/dedup.mjs
                    apis/sources/smartscroll-local/processing/story-builder.mjs
                    apis/sources/smartscroll-local/processing/summarizer.mjs
                    apis/sources/smartscroll-local/processing/timeline.mjs
                    apis/sources/smartscroll-local/storage/story-store.mjs
    ->
apis/ingest/event-ingestion-api.mjs
    ->
apis/entity-model/story-layer.mjs
    ->
data/basket/smartscroll-stories.json

## Module documentation list

- 01. Configuration
- 02. Common interface
- 03. External adapter
- 04. Source factory
- 05. Local engine core
- 06. Base collector
- 07. RSS collector
- 08. Telegram collector
- 09. Normalizer
- 10. Deduplicator
- 11. Story builder
- 12. Summarizer
- 13. Timeline builder
- 14. Story store
- 15. Entity model
- 16. Pipeline integration
