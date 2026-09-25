# 01. Конфигурация SmartScroll

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/config/smartscroll.json

## Назначение

Управляет всеми модулями комплекта SmartScroll.

## Структура

Верхний уровень:
- version
- mode: auto, external, local
- collect_interval_ms
- max_story_age_hours
- max_events_per_story

Блок external:
- base_url
- api_key
- timeout_ms
- retries
- retry_delay_ms

Блок local:
- collect_interval_ms
- max_story_age_hours
- max_events_per_story
- dedup_threshold
- story_similarity_threshold
- summary_sentences
- storage_dir
- cleanup_interval_ms

Блок sources:
- rss
- telegram

Блок entity_model:
- story_node_type
- event_node_type
- prefix

## Связи

Читается модулями 02, 03, 04, 05, 16.
Определяет параметры для 07, 08, 10, 11, 12.
