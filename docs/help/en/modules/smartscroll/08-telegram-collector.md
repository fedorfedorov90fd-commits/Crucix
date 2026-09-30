# 08. Telegram Collector

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/scripts/collectors/lib/telegram-collector.mjs

## Purpose

Reading public Telegram channels through web preview t.me/s/<channel> without API keys and tokens.

## Class

TelegramCollector extends BaseCollector

## Algorithm

1. HTTP request to https://t.me/s/<channel>
2. Find message blocks by data-post attribute
3. Extract text from tgme_widget_message_text
4. Extract time from time datetime
5. Return array of events

## Event format

- id - hash from post id
- source - telegram:channel
- published_at - ISO date
- title - first 120 chars
- body - up to 5000 chars
- url - link to post

## Limitations

- Works only with public channels
- Private channels unavailable

## Relations

- Inherits: 06-base-collector.md
- Used by: 05-local-engine.md
