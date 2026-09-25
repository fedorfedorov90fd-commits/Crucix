# 07. RSS Collector

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/rss-collector.mjs

## Purpose

Parsing RSS 2.0 and Atom without external dependencies.

## Class

RSSCollector extends BaseCollector

## Algorithm

1. HTTP request to RSS feed with User-Agent header
2. Remove comments
3. Find item elements (RSS 2.0) or entry elements (Atom)
4. Extract fields: title, link, description, pubDate
5. Clean CDATA and HTML entities
6. Return array of events

## Event format

- id - hash from link
- source - rss:name
- published_at - ISO date
- title, body, url, category

## Limitations

- Event body truncated to 5000 chars
- Parser based on regular expressions

## Relations

- Inherits: 06-base-collector.md
- Used by: 05-local-engine.md
