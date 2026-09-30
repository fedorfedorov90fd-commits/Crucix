# 01. SmartScroll Configuration

[Back to INDEX](./INDEX.md)

## Location

/home/ta8_/Рабочий стол/Crucix/config/smartscroll.json

## Purpose

Controls all SmartScroll package modules.

## Structure

Top level:
- version
- mode: auto, external, local
- collect_interval_ms
- max_story_age_hours
- max_events_per_story

Block external:
- base_url
- api_key
- timeout_ms
- retries
- retry_delay_ms

Block local:
- collect_interval_ms
- max_story_age_hours
- max_events_per_story
- dedup_threshold
- story_similarity_threshold
- summary_sentences
- storage_dir
- cleanup_interval_ms

Block sources:
- rss
- telegram

Block entity_model:
- story_node_type
- event_node_type
- prefix

## Relations

Read by modules 02, 03, 04, 05, 16.
Defines parameters for 07, 08, 10, 11, 12.
