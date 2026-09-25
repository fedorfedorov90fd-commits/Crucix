# 05. Local Engine Core

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/engine.mjs

## Purpose

Manages full processing cycle:
collection, normalization, deduplication, clustering, summarization, storage.
Collects per-stage timing metrics for diagnostics.

## Class

SmartScrollLocalEngine extends SmartScrollInterface

## Full cycle

1. _initCollectors() - initialize collectors from config
2. _collectCycle() - internal processing cycle
3. runCycle() - public entry point for a full cycle
4. _cleanup() - remove outdated stories

## Per-stage metrics

Each cycle stage is timed separately:
- collect - collection from all collectors
- normalize - event normalization
- dedup - deduplication
- cluster - clustering into stories
- summarize - summary generation
- store - saving to storage

Last 100 samples per stage are kept.
Method getMetrics() returns:
- cycles_total - total number of cycles
- cycles_failed - number of failed cycles
- totals - accumulated event and story counters
- stages - per-stage stats (count, avg_ms, min_ms, max_ms, last_ms)
- last_cycle - metrics of the last cycle

## Interface methods

- fetchStories(opts) - read from storage
- fetchStoryDetail(id) - read single story
- fetchTimeline(id) - build timeline
- healthCheck() - engine state
- getMetrics() - performance metrics

## Control

- start() - start autonomous cycle
- stop() - stop
- runCycle() - one-off full cycle

## Dependencies

- Collectors: 06-base-collector.md, 07-rss-collector.md, 08-telegram-collector.md
- Processing: 09-normalizer.md, 10-dedup.md, 11-story-builder.md, 12-summarizer.md, 13-timeline.md
- Storage: 14-story-store.md
