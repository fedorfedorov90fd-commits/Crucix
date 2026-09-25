# 13. Timeline Builder

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/apis/sources/smartscroll-local/processing/timeline.mjs

## Purpose

Building chronology of story events.

## Class

TimelineBuilder

## Methods

- build(events) - sort by time, remove duplicates
- groupByDay(events) - group by days

## Output format

- time, title, body (up to 500 chars), source

## Relations

- Used by: 05-local-engine.md
- Called via API: 16-event-ingestion.md
