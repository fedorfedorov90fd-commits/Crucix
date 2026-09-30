# 06. Base Collector

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/base-collector.mjs

## Purpose

Base class for all SmartScroll collectors.
Defines common contract and helper methods.

## Class

BaseCollector

## Methods

- collect() - abstract collection method. Subclasses must implement
- hashId(input) - generate stable ID
- _fetch(url, opts) - HTTP request with timeout via AbortController

## Fields

- url, channel, name, category, enabled, timeoutMs

## Subclasses

- RSSCollector - 07-rss-collector.md
- TelegramCollector - 08-telegram-collector.md

## Extension

To add a new source, inherit BaseCollector and implement collect().
