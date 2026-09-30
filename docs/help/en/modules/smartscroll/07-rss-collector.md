# 07. RSS Collector

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/rss-collector.mjs

## Purpose

Parsing RSS 2.0 and Atom. Primary parser: rss-parser (if available in node_modules), fallback: built-in regex parser. Supports encoding detection from XML declaration for correct handling of windows-1251 and koi8-r sources.

## Class

RSSCollector extends BaseCollector

## Algorithm

1. HTTP request to RSS feed with User-Agent header
2. Read response as ArrayBuffer — not text, to preserve raw bytes before decoding
3. Detect encoding via method `_detectEncoding(buffer)`: parse XML declaration from first 256 bytes of response
4. Decode via method `_decodeBuffer(buffer)`: apply TextDecoder with determined encoding
5. Attempt parsing via rss-parser (if available in node_modules)
6. On rss-parser absence or error — fallback to built-in regex parser
7. Find item elements (RSS 2.0) or entry elements (Atom)
8. Extract fields: title, link, description, pubDate
9. Clean CDATA and HTML entities
10. Validate date: reject older than 10 years and more than 24 hours in the future
11. Return array of events

## Methods

- `collect()` — main method to gather events from feed
- `_getParser()` — dynamic import of rss-parser, result caching
- `_detectEncoding(buffer)` — determine encoding from XML declaration
- `_decodeBuffer(buffer)` — decode ArrayBuffer to string
- `_fromParsed(parsed)` — convert rss-parser output to event format
- `_parseXml(xml)` — regex XML parsing
- `_parseItem(itemXml)` — extract fields from a single item
- `_validateDate(dateStr)` — date check (not older than 10 years, not more than 24 hours in future)
- `_cleanHtml(s)` — HTML cleaning
- `_decodeHtml(s)` — HTML entity decoding

## Encoding detection

Method `_detectEncoding` reads first 256 bytes of the response, extracts encoding attribute value from XML declaration. Supported encodings:

- windows-1251 / cp1251 → windows-1251
- koi8-r / koi8r → koi8-r
- utf-8 / utf8 → utf-8
- No encoding or unknown encoding → utf-8

This is critical for Russian sources (iz.ru, some regional feeds) that serve content in windows-1251. Without detection, Node.js decodes them via standard text() as UTF-8, resulting in corrupted titles.

## rss-parser integration

Method `_getParser` attempts dynamic import of rss-parser from node_modules. On success, creates an instance with timeout settings. Result is cached in `this._parser` — repeated calls return the already created instance. If rss-parser is unavailable, `_getParser` returns false, and collect falls back to built-in regex parser.

## Event format

- id - hash from link
- source - rss:name
- published_at - ISO date
- title, body, url, category

## Limitations

- Event body truncated to 5000 chars
- Fallback parser based on regular expressions
- Future dates (more than 24 hours ahead) rejected
- Dates older than 10 years rejected

## Relations

- Inherits: 06-base-collector.md
- Used by: 05-local-engine.md
